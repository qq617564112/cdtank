import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
let decoder;
const network=[];
const ports=process.argv.slice(2).map(Number);
assert(ports.length===3&&ports.every(Number.isInteger),'Pass root-coordinated server/vite/CDP ports; prepared driver has no reserved defaults');
const [serverPort,vitePort,cdpPort]=ports;
decoder=new WsClient(serviceProto,{server:`ws://127.0.0.1:${serverPort}`,logger:undefined});
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-shop-owned-part-source-regions-'+runId;
const catalog=JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json','utf8'));
const source=JSON.parse(await readFile('recovery/output/tank-shop-part-parent-source.json','utf8'));
for(const row of source.slotCountLoader.rows)assert.equal(catalog.tankTypes.find(v=>v.tankId===row.tankId)?.partSlotCount,row.partSlotCount,'Root full21 slot metadata required before browser startup');
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-shop-owned-part-source-regions-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/browser-home-equipment-common-row-2026-10-05T14-42-06-024Z-checkpoint-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:serverPort,vite:vitePort,cdp:cdpPort},runId,scope:'UI58 new Owned part-sheet static backgrounds/count/source asset/placement/unmount/Close; dynamic images unbound; no old row suite or writes',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true,authority:'Saved ordinary TankShop BUY3/BUY4 from explicitly documented funds-only fixture; no role injection or new purchase'}};
async function stop(child){if(child?.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
let sequence = 0;
const pending = new Map();
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('[data-tank-shop-status]')?.value+' '+document.querySelector('[data-tank-shop-preview]')?.dataset.status);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')
          && !String(error).includes('Inspected target navigated or closed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
async function nativeClick(session, selector) {
  await command('Page.bringToFront', {}, session);await new Promise(r=>setTimeout(r,100));
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered '+e.outerHTML+' by '+document.elementFromPoint(x,y)?.outerHTML);return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:String(serverPort),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:vitePort,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:`ws://127.0.0.1:${serverPort}`,ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required',`--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,`Chromium${cdpPort}`);ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:`http://127.0.0.1:${vitePort}`},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Tank"]');
  await waitUntil(s,`document.querySelector('[data-tank-shop-owned-tab]')?.matches(':enabled')`);
  await nativeClick(s,'[data-tank-shop-owned-tab]');
  await waitUntil(s,`document.querySelector('[data-tank-shop-product-id="1"]')?.matches(':enabled')`);
  const owned=network.filter(n=>n.direction==='received'&&n.name==='OwnedRoles'&&n.success).at(-1)?.response;
  assert(owned);
  const records=owned.equipment.map(r=>({name:r.name,fields:new Map(r.fields)}));
  const ui=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8'));
  const layout=ui.layouts.find(l=>l.path.endsWith('shop_tankpage_part.xml'));
  const slots=['bgInternalPart0','bgInternalPart1','bgExternalPart0','bgExternalPart1','bgExternalPart2'];
  const dynamic=['picHatIcon','picMarkIcon','picInternalIcon0','picInternalIcon1','picExternalIcon0','picExternalIcon1','picExternalIcon2'];
  const selector=name=>'[data-source-layout="ui/layouts/shop_tankpage_part.xml"][data-source-control="'+name+'"]';
  const expectedControl=name=>{
    const control=layout.windows.find(w=>w.name===name);
    const rectangle=c=>c.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const box=rectangle(control);let left=box[0],top=box[1]+36;
    for(let parent=control.parent;parent;){const owner=layout.windows.find(w=>w.name===parent),r=rectangle(owner);left+=r[0];top+=r[1];parent=owner.parent;}
    const match=/^set:(\S+) image:(.+)$/.exec(control.properties.Image);
    const sets=ui.imagesets.filter(s=>s.attributes.Name===match[1]);
    const set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];
    const asset=set.images.find(i=>i.Name===match[2])?.asset;assert(asset);
    return {name,left,top,width:box[2]-box[0],height:box[3]-box[1],asset,originalImage:match[2],imageset:set.path};
  };
  evidence.frames=[];evidence.screenshots=[];
  evidence.sourceExpected=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    for(const [instance,tankId] of [[1,3],[2,4]]){
      assert(records.some(r=>r.fields.get(0x1c)===instance&&r.fields.get(0x24)===tankId));
      const sourceCount=source.slotCountLoader.rows.find(r=>r.tankId===tankId).partSlotCount;
      const published=catalog.tankTypes.find(r=>r.tankId===tankId)?.partSlotCount;
      assert.equal(published,sourceCount,'Root full-catalog named source field must be published before this actual');
      await nativeClick(s,'[data-tank-shop-product-id="'+instance+'"]');
      await waitUntil(s,`document.querySelector('[data-role-shop-list="tank"]')?.dataset.selectedTank==='${instance}'&&document.querySelector(${JSON.stringify(selector('bgHatIcon'))})`);
      const expected=['bgHatIcon','bgMarkIcon',...slots.slice(0,sourceCount)].map(expectedControl);
      await evaluate(s,`Promise.all(${JSON.stringify(expected.map(e=>e.asset))}.map(asset=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('Source image failed '+asset));image.src='/'+asset;})))`);
      await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const metrics=await evaluate(s,`(()=>{const names=${JSON.stringify(expected.map(e=>e.name))},selector=${selector.toString()},rect=e=>e.getBoundingClientRect().toJSON();return {scale:Math.min(innerWidth/800,innerHeight/600),controls:names.map(name=>{const e=document.querySelector(selector(name));return {name,rect:rect(e),left:parseFloat(e.style.left),top:parseFloat(e.style.top),asset:e.dataset.sourceAsset,imageAsset:e.querySelector('[data-source-image]')?.dataset.sourceAsset,visibility:getComputedStyle(e).visibility,display:getComputedStyle(e).display};}),hiddenSlots:${JSON.stringify(slots.slice(sourceCount))}.map(name=>({name,absent:!document.querySelector(selector(name))})),dynamic:${JSON.stringify(dynamic)}.map(name=>({name,absent:!document.querySelector(selector(name))}))};})()`);
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-'+instance+'.png';
      await writeFile(path,Buffer.from(shot.data,'base64'));
      evidence.frames.push({viewport:[width,height],instance,tankId,sourceCount,metrics,path});evidence.screenshots.push(path);
      evidence.sourceExpected=expected;
      await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
      for(const e of expected){const actual=metrics.controls.find(c=>c.name===e.name);assert.equal(actual.left,e.left);assert.equal(actual.top,e.top);assert.equal(actual.asset,e.asset);assert.equal(actual.imageAsset,e.asset);assert.notEqual(actual.visibility,'hidden');assert.notEqual(actual.display,'none');assert(Math.abs(actual.rect.width-e.width*metrics.scale)<1);assert(Math.abs(actual.rect.height-e.height*metrics.scale)<1);assert(actual.rect.left>=0&&actual.rect.right<=width&&actual.rect.top>=0&&actual.rect.bottom<=height);}
      assert(metrics.hiddenSlots.every(v=>v.absent));assert(metrics.dynamic.every(v=>v.absent));
      const anchor=metrics.controls[0],anchorExpected=expected[0];
      for(const e of expected){const actual=metrics.controls.find(c=>c.name===e.name);assert(Math.abs(actual.rect.left-anchor.rect.left-(e.left-anchorExpected.left)*metrics.scale)<1);assert(Math.abs(actual.rect.top-anchor.rect.top-(e.top-anchorExpected.top)*metrics.scale)<1);}
    }
  }
  await nativeClick(s,'[data-tank-shop-buy-tab]');
  await waitUntil(s,`!document.querySelector('[data-source-layout="ui/layouts/shop_tankpage_part.xml"]')`);
  evidence.buyReturnUnmount=true;
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopClose=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'));evidence.noBuySaveSlotOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
