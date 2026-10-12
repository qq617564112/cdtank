/** Render each skin on the actual game model under uniform ambient light. */
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {createServer} from '/workspace/cdtank/node_modules/vite/dist/node/index.js';
import WebSocket from '/workspace/cdtank/node_modules/ws/index.js';
const workspace='/workspace/cdtank';
const role=process.argv[2], target=process.argv[3];
if(!role || !target)throw new Error('Usage: render.mjs TANK WORKSPACE [--only SUFFIX]');
const tankId=Number(role);
const output=target+'/output/imagegen/tank-api4k/'+role+'/renders';
const runtime=target+'/apps/web/public/tank-audit/api4k/'+role;
const temp='/tmp/cdtank-api4k/render-'+role+'-'+process.pid;
const definition=JSON.parse(await readFile(workspace+'/apps/shared/content/definitions/tanks/'+tankId+'.json','utf8'));
const rows=new Map();
for(const row of definition.resources.textureVariants){
 if(row.part!=='M'&&row.part!=='U')continue;
 const suffix=/[MU]_(\d+)\./.exec(row.filename)?.[1];
 if(!suffix)continue;
 const asset=row.textures.A.asset;
 if(!asset)continue;
 if(!rows.has(suffix))rows.set(suffix,{suffix,ids:{M:0,U:0,XY:0},assets:{}});
 const skin=rows.get(suffix);skin.ids[row.part]=row.recordId;skin.assets[row.part]=asset.split('/').at(-1);
}
const only=process.argv.indexOf('--only');
const selected=[...rows.values()].filter(s=>only<0 || s.suffix===process.argv[only+1]).sort((a,b)=>a.suffix.localeCompare(b.suffix));
const moduleSource = String.raw`
import {TankPreview} from '/tools/asset-viewer/tank-preview.ts';
const canvas=document.querySelector('canvas');
canvas.style.width='1000px';canvas.style.height='1000px';
const preview=new TankPreview(canvas);preview.playing=false;
function frame(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
async function renderAll(mode,tankId,ids,assets){
 const sample={};
 for(const part of ['M','U']){
  if(assets[part])sample[part]=(mode==='original'?'__source/':'__api/')+assets[part];
 }
 await preview.load(tankId,ids,sample);
 const result={};
 for(const view of ['left','center','right','top','front','rear']){
  preview.setView(view);await frame();result[view]=canvas.toDataURL('image/png');
 }
 canvas.style.width='1200px';canvas.style.height='900px';
 preview.setView('center');await frame();result.hero=canvas.toDataURL('image/png');
 canvas.style.width='1000px';canvas.style.height='1000px';await frame();
 return result;
}
window.tankHD={renderAll};
`;

let chrome,vite,socket;let id=0;const pending=new Map();
function command(method,params={},sessionId){
 return new Promise((resolve,reject)=>{
  const key=++id;
  const timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP timeout: '+method));},180000);
  pending.set(key,{resolve,reject,timer});
  socket.send(JSON.stringify({id:key,method,params,sessionId}));
 });
}
async function evaluate(sessionId,expression){
 const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
 if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
 return r.result.value;
}
try{
 await mkdir(output,{recursive:true});await mkdir(temp,{recursive:true});
 const contentIndex=JSON.parse(await readFile(workspace+'/apps/shared/content/definitions/index.json','utf8'));
 contentIndex.tanks=['tanks/'+tankId+'.json'];contentIndex.pets=[];contentIndex.items=[];contentIndex.skills=[];
 vite=await createServer({
  configFile:false,root:workspace,publicDir:workspace+'/apps/web/public',cacheDir:temp+'/vite',
  optimizeDeps:{noDiscovery:true,include:['@babylonjs/core','@babylonjs/loaders/glTF','@babylonjs/core/Rendering/outlineRenderer','@babylonjs/core/Materials/clipPlaneMaterialHelper','@babylonjs/core/Materials/materialHelper.functions','@babylonjs/core/Shaders/outline.vertex','@babylonjs/core/Shaders/outline.fragment','@babylonjs/core/ShadersWGSL/outline.vertex','@babylonjs/core/ShadersWGSL/outline.fragment'],entries:[]},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null},
  plugins:[{name:'tank-api-render',configureServer(s){s.middlewares.use(async(req,res,next)=>{
   const path=(req.url||'').split('?')[0];
   try{
    if(path==='/__tank.html'){res.setHeader('Content-Type','text/html');res.end('<html><body style="margin:0"><canvas></canvas><script type="module" src="/__tank.js"></script></body></html>');return;}
    if(path==='/__tank.js'){res.setHeader('Content-Type','text/javascript');res.end(await s.transformRequest('/__tank-module.js').then(r=>r.code));return;}
    if(path==='/content/index.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(contentIndex));return;}
    if(path.startsWith('/content/')){res.setHeader('Content-Type','application/json');res.end(await readFile(workspace+'/apps/shared/content/definitions/'+path.slice(9)));return;}
    if(path.startsWith('/__source/')){res.setHeader('Content-Type','image/png');res.end(await readFile(workspace+'/art/original/tank-textures/role/'+role+'/'+path.slice(10)));return;}
    if(path.startsWith('/__api/')){res.setHeader('Content-Type','image/png');res.end(await readFile(runtime+'/'+path.slice(7)));return;}
   }catch(e){res.statusCode=500;res.end(String(e));return;}next();
  });},resolveId(id){if(id==='/__tank-module.js')return '\0tank-module';},load(id){if(id==='\0tank-module')return moduleSource;}}]
 });
 await vite.listen();const origin='http://127.0.0.1:'+vite.httpServer.address().port;
 chrome=spawn('/home/node/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+temp+'/chrome','about:blank'],
  {stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{
  let log='';const timer=setTimeout(()=>reject(new Error('Chrome launch timeout')),30000);
  chrome.stderr.on('data',c=>{log+=String(c);const m=/DevTools listening on (ws:\/\/[^\s]+)/.exec(log);if(m){clearTimeout(timer);resolve(m[1]);}});
  chrome.on('exit',()=>reject(new Error(log)));
 });
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 socket.on('message',raw=>{
  const m=JSON.parse(String(raw)),p=pending.get(m.id);
  if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
 });
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 await command('Page.enable',{},sessionId);await command('Runtime.enable',{},sessionId);
 socket.on('message',raw=>{
  const m=JSON.parse(String(raw));
  if(m.method==='Runtime.exceptionThrown')console.error('Browser:',JSON.stringify(m.params.exceptionDetails));
 });
 await command('Page.navigate',{url:origin+'/__tank.html'},sessionId);
 for(let i=0;i<400;i++){
  if(await evaluate(sessionId,'Boolean(window.tankHD)'))break;
  await new Promise(r=>setTimeout(r,300));
  if(i===399)throw new Error('Renderer did not load');
 }
 const rendered=[];
 for(const skin of selected){
  for(const part of ['M','U']){
   if(definition.resources.components.some(c=>c.part===part&&c.actions.length>0)&&!skin.assets[part]){
    skin.assets[part]=role+part+'_001.png';
   }
  }
  for(const mode of ['original','api4k']){
   const images=await evaluate(sessionId,
    'window.tankHD.renderAll('+JSON.stringify(mode)+','+tankId+','+JSON.stringify(skin.ids)+','+JSON.stringify(skin.assets)+')');
   const folder=output+'/'+skin.suffix;await mkdir(folder,{recursive:true});
   for(const [view,url]of Object.entries(images)){
    await writeFile(folder+'/'+mode+'-'+view+'.png',Buffer.from(url.split(',')[1],'base64'));
   }
   console.log('Rendered '+role+' '+skin.suffix+' '+mode);
  }
  rendered.push({suffix:skin.suffix,assets:skin.assets,views:['left','center','right','top','front','rear'],modes:['original','api4k']});
 }
 await writeFile(output+'/scope'+(only<0?'':'-'+process.argv[only+1])+'.json',JSON.stringify({tank:role,skins:rendered,ambientLight:true},null,2)+'\n');
}finally{
 for(const p of pending.values())clearTimeout(p.timer);
 socket?.close();
 if(chrome?.pid){chrome.kill();await new Promise(r=>chrome.once('exit',r));}
 await vite?.close();await rm(temp,{recursive:true,force:true});
}

