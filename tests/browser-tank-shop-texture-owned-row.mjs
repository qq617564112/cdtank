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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3596',logger:undefined});
const network=[];
const arrowBoundsOnly=process.argv.includes('--arrow-bounds-only');
const combinedNewScope=process.argv.includes('--combined-new-row-arrow-bounds');
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-shop-texture-owned-row-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-shop-texture-owned-row-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/browser-home-equipment-common-row-2026-10-05T14-42-06-024Z-checkpoint-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3596,vite:5626,cdp:9826},runId,scope:'UI59 same4bb3bc Texture ownedTankrow/name/type/days/selection/Close; noBUY/SELL/SelectRole/SAVE',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true,authority:'Saved ordinary TankShop BUY3/BUY4 from explicitly documented funds-only fixture; no role injection or new purchase'}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3596',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5626,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3596',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9826',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9826/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9826');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5626'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Tank"]');
  await waitUntil(s,`document.querySelector('[data-tank-shop-texture-tab]')?.matches(':enabled')`);
  await nativeClick(s,'[data-tank-shop-texture-tab]');
  await waitUntil(s,`document.querySelector('[data-tank-shop-owned-instance="1"] [data-home-owned-tank-name]')&&document.querySelector('[data-tank-shop-owned-instance="1"]')?.matches(':enabled')`);
  const owned=network.filter(n=>n.direction==='received'&&n.name==='OwnedRoles'&&n.success).at(-1)?.response;
  assert(owned); const records=owned.equipment.map(r=>({name:r.name,fields:new Map(r.fields)}));assert(records.length>0);assert(records.some(r=>r.fields.get(0x1c)===1&&r.fields.get(0x24)===3));
  const catalog=JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json','utf8'));
  const offers=catalog.tankTypes;assert(offers); const ui=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8'));
  const sets=ui.imagesets.filter(s=>s.attributes.Name==='tanke0'),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];
  evidence.records=records.map(r=>({instanceId:r.fields.get(0x1c),tankId:r.fields.get(0x24),durationMinutes:r.fields.get(0x34),name:r.name}));
  evidence.frames=[];evidence.screenshots=[];
  if (!arrowBoundsOnly) for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    for(const record of records){
      const instance=record.fields.get(0x1c),tankId=record.fields.get(0x24),minutes=record.fields.get(0x34);
      const offer=offers.find(o=>o.tankId===tankId);assert(offer);
      const expectedType=({1:'轻型坦克',2:'中型坦克',3:'重型坦克',4:'突击炮'})[offer.tankType]??'';
      const expectedDays=minutes===undefined?'':`（${Math.ceil((minutes>>>0)/1440)}天）`;
      const icon=set.images.find(i=>i.Name==='data\\ui\\tanke\\'+String(tankId).padStart(3,'0')+'.tga');assert(icon?.asset);
      await nativeClick(s,'[data-tank-shop-owned-instance="'+instance+'"]');
      const metrics=await evaluate(s,`(()=>{const r=document.querySelector('[data-tank-shop-owned-instance="${instance}"]'),rect=e=>e.getBoundingClientRect().toJSON(),image=r.querySelector('[data-home-owned-tank-icon]'),name=r.querySelector('[data-home-owned-tank-name]'),type=r.querySelector('[data-home-owned-tank-type]');return {scale:Math.min(innerWidth/800,innerHeight/600),row:rect(r),icon:rect(image),nameBounds:rect(name),typeBounds:rect(type),name:name.textContent,type:type.textContent,days:r.querySelector('[data-home-owned-tank-days]').textContent,textureSelected:document.querySelector('[data-tank-shop-texture-tab]').getAttribute('aria-pressed'),saveDisabled:document.querySelector('[data-tank-shop-texture-save]').disabled,asset:image.dataset.sourceAsset,selected:r.getAttribute('aria-selected'),focus:document.activeElement===r};})()`);
      const screenshot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-'+instance+'.png';await writeFile(path,Buffer.from(screenshot.data,'base64'));evidence.screenshots.push(path);evidence.frames.push({viewport:[width,height],instance,metrics,path});await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
      assert.equal(metrics.name,record.name);assert.equal(metrics.asset,icon.asset);assert.equal(metrics.type,expectedType);assert.equal(metrics.days,expectedDays);assert.equal(metrics.textureSelected,'true');assert(metrics.saveDisabled);assert.equal(metrics.selected,'true');assert(metrics.focus);

      assert(Math.abs(metrics.row.width-161*metrics.scale)<1);assert(Math.abs(metrics.row.height-56*metrics.scale)<1);
      assert(metrics.row.left>=0&&metrics.row.right<=width&&metrics.row.top>=0&&metrics.row.bottom<=height);
    }
  }
  if (arrowBoundsOnly || combinedNewScope) {
    evidence.scope=combinedNewScope ? 'UI59 new source owned rows threeRes and finite arrow bounds; noBUY/SAVE' : 'UI59 finite Texture arrow candidate bounds; no row geometry/BUY/SAVE';
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
    await nativeClick(s,'[data-tank-shop-owned-instance="1"]');
    const textures=JSON.parse(await readFile('recovery/output/web-assets/tank-textures.json','utf8'));
    const selection=()=>evaluate(s,`JSON.parse(document.querySelector('[data-tank-shop-texture-status]').dataset.textureSelection)`);
    const initial=await selection();evidence.arrowBounds=[];
    for(const [part,control] of [['U','Turret'],['M','Body'],['XY','Tread']]){
      const dec='[data-source-layout="ui/layouts/shop_tankpage_texture.xml"][data-source-control="btnDec'+control+'Texture"]';
      const inc='[data-source-layout="ui/layouts/shop_tankpage_texture.xml"][data-source-control="btnInc'+control+'Texture"]';
      if(!await evaluate(s,`document.querySelector(${JSON.stringify(inc)})?.matches(':enabled')`))continue;
      const options=textures.rows.filter(row=>row.tankId===3&&row.part===part&&(row.recordId===initial[part]||row.selectable&&row.textures.A.status==='resolved'&&!!row.textures.A.asset&&(part!=='XY'||row.textures.B?.status==='resolved'&&!!row.textures.B.asset)));
      const ids=[...new Set([initial[part],...options.map(row=>row.recordId)])];assert(ids.length>1);
      await nativeClick(s,dec);assert.equal((await selection())[part],ids[0]);
      for(let i=1;i<ids.length;i++){await nativeClick(s,inc);assert.equal((await selection())[part],ids[i]);}
      await nativeClick(s,inc);assert.equal((await selection())[part],ids.at(-1));
      for(let i=ids.length-2;i>=0;i--){await nativeClick(s,dec);assert.equal((await selection())[part],ids[i]);}
      await nativeClick(s,dec);assert.equal((await selection())[part],ids[0]);
      evidence.arrowBounds.push({part,ids,firstStops:true,lastStops:true});
    }
    assert(evidence.arrowBounds.length>0);
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopClose=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'));evidence.noBuySaveSlotOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
