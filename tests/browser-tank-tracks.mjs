import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {TANKS} from '../apps/server/src/config.ts';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3261',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-tracks-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-tracks-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3261,vite:5421,cdp:9621},runId,scope:'All 21 tanks: pre-match owned account fixtures, normal React role selection / Create / Join / Ready, native W/S, actual X/Y mesh draws and A/B textures, dual authoritative snapshots and normal Leave; no active pose, damage or event injection'};
async function stop(child){if(child?.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
let sequence = 0;
const pending = new Map();
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser command timeout: '+method));},60000);
    pending.set(id, {resolve: value=>{clearTimeout(timer);resolve(value);}, reject: error=>{clearTimeout(timer);reject(error);}});
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
async function nativeSelect(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await nativeClick(session, selector);
  const press = async (key, code, windowsVirtualKeyCode) => {
    await command('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode}, session);
    await command('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode}, session);
  };
  await press('Home', 'Home', 36);
  for(let step=0;step<index;step++)await press('ArrowDown', 'ArrowDown', 40);
  await press('Enter', 'Enter', 13);
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3261',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'600'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5421,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3261',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9621',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9621/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9621');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PetShop','Shop','OwnedRoles','RoleProfile','SelectRole','Account','CreateRoom','Cpu','Ready','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5421',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:640,height:360,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const nativeRows=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows;
  const textures=JSON.parse(await readFile('recovery/output/web-assets/tank-textures.json','utf8')).rows;
  const tankAssets=JSON.parse(await readFile('recovery/output/web-assets/tanks.json','utf8'));
  const fields=value=>new Map(Object.entries(value).map(([key,value])=>[Number(key),value]));
  const selectedTextures=new Map(TANKS.map(tank=>{
    const parts=tankAssets.find(row=>row.id===tank.id).components.filter(row=>row.actions.length).map(row=>row.part);
    const selected=Object.fromEntries(['U','M','XY'].map(part=>{
      const row=textures.find(row=>row.tankId===tank.id&&row.part===part&&row.textures.A.asset&&(part!=='XY'||row.textures.B?.asset));
      return [part,part==='U'&&!parts.includes('U')?0:row?.recordId??0];
    }));
    assert(selected.XY,'Tank '+tank.id+' source A/B');return[tank.id,selected];
  }));
  store=new AccountStore(database);
  for(const page of pages){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const base=fields(nativeRows.find(row=>row.tankId===1&&row.part===0).base);
    base.set(0,73);base.set(8,1);base.set(0x2c,600);
    const equipment=TANKS.map(tank=>{
      const row=fields(nativeRows.find(row=>row.tankId===tank.id&&row.part===0).equipment);
      const ids=selectedTextures.get(tank.id);
      row.set(0x1c,1000+tank.id);row.set(0x24,tank.id);row.set(0x28,ids.U);row.set(0x2c,ids.M);row.set(0x30,ids.XY);
      return {name:'履带验收 '+tank.id,fields:row};
    });
    store.replaceRoleRecords(account.accountId,{base:[{name:'Explicit source pet1 fixture',fields:base}],equipment});
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);
    view.setUint32(0xa4,73,true);view.setUint32(0xa8,1001,true);
    store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  evidence.fixture={petId:1,ownedTankIds:TANKS.map(row=>row.id),sourceTextures:Object.fromEntries(selectedTextures)};
  const host=pages[0].sessionId,peer=pages[1].sessionId;
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);
      const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));
      const scene=engine.scenes[0];window.trackDraws=[];
      const attach=mesh=>mesh.onAfterRenderObservable?.add(()=>{
        let node=mesh,part,root;
        while(node){if(/-part-[XY]$/.test(node.name))part=node.name.slice(-1);if(/^player-[^-]+$/.test(node.name))root=node;node=node.parent;}
        if(!part||!root||!mesh.material?.metadata?.originalMV3)return;
        const texture=mesh.material.getActiveTextures()[0];
        const row={at:performance.now(),id:root.name.slice(7),tankId:root.metadata?.tankId,part,texture:texture?.url,action:root.metadata?.action};
        // Retain transitions plus regular samples, without recording every draw.
        const previous=window.trackDraws.findLast(r=>r.id===row.id&&r.part===part);
        if(!previous||previous.texture!==row.texture||previous.action!==row.action||row.at-previous.at>100)window.trackDraws.push(row);
      });
      scene.meshes.forEach(attach);scene.onNewMeshAddedObservable.add(attach);
      const {TankView}=await import('/src/assets/tanks/tank-view.ts');
      window.trackTicks=[];
      const advance=TankView.prototype.advanceAnimations;
      TankView.prototype.advanceAnimations=function(delta){
        const result=advance.call(this,delta);
        if(this.root.name.startsWith('player-')&&this.trackMovementPending){
          window.trackTicks.push({root:this.root.name,delta,phase:this.trackPhase,action:this.activeAction,
            parts:this.current?.components.map(c=>({part:c.part,material:c.assets.meshes.find(m=>m.material)?.material?.getClassName(),textures:c.assets.meshes.find(m=>m.material)?.material?.getActiveTextures().map(t=>t.url)}))});
        }
        return result;
      };
      window.trackScene=scene;
    })()`);
  }
  const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  const snapshots=session=>network.filter(e=>e.page===session&&e.name==='RoomSnapshot'&&e.direction==='received');
  const latest=session=>snapshots(session).at(-1)?.payload;
  async function key(session,code,down){
    const [key,virtual]=code==='KeyW'?['w',87]:['s',83];
    await command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key,code,windowsVirtualKeyCode:virtual},session);
  }
  evidence.tanks=[];
  const requested=process.env.CDTANK_TRACK_TANKS?.split(',').map(Number);
  for(const tank of TANKS.filter(tank=>!requested||requested.includes(tank.id))){
    console.log('Tracks tank '+tank.id+' '+tank.name);
    for(const session of [host,peer]){
      await nativeClick(session,'[data-room-card-home]');
      await waitUntil(session,`document.querySelector('[data-role-tab="tank"]')?.matches(':enabled')`);
      await nativeClick(session,'[data-role-tab="tank"]');
      await waitUntil(session,`document.querySelector('[data-owned-role="${1000+tank.id}"]')?.matches(':enabled')`);
      await nativeClick(session,`[data-owned-role="${1000+tank.id}"]`);
      const use='[data-home-role-page="tank"] [data-selected-instance]';
      if(await evaluate(session,`document.querySelector(${JSON.stringify(use)}).dataset.selectedInstance!=='${1000+tank.id}'`)){
        await waitUntil(session,`document.querySelector(${JSON.stringify(use)})?.matches(':enabled')`);
        await nativeClick(session,use);
        await waitUntil(session,`document.querySelector(${JSON.stringify(use)}).dataset.selectedInstance==='${1000+tank.id}'`);
      }
      await nativeClick(session,'[data-roles-close]');
    }
    await nativeClick(host,'[data-room-card-create]');
    await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);
    await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');
    await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);
    await nativeClick(host,'[data-room-create-confirm]');await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);
    const roomId=latest(host).roomId;
    await waitUntil(peer,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
    await command('Page.bringToFront',{},peer);
    const point=await evaluate(peer,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...point},peer);
    for(const session of [host,peer])await waitUntil(session,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.mapLoaded&&w.renderedPlayers===2})()`);
    await nativeClick(peer,'[data-waiting-ready]');await nativeClick(host,'[data-waiting-ready]');
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
    const ids={};for(const session of [host,peer])ids[session]=await evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world).playerId`);
    const result={tankId:tank.id,roomId,sourceTextures:selectedTextures.get(tank.id),pages:[]};evidence.current=result;
    for(const session of [host,peer]){
      await command('Page.bringToFront',{},session);await evaluate(session,`document.activeElement?.blur();window.trackDraws=[]`);
      const owner=ids[session],movement=[];
      for(const code of ['KeyW','KeyS']){
        const before=latest(session).players.find(row=>row.id===owner),start=network.length;
        await key(session,code,true);
        const source=textures.find(row=>row.recordId===selectedTextures.get(tank.id).XY&&row.tankId===tank.id);
        const drawDeadline=Date.now()+15000;
        let seen=false;
        while(Date.now()<drawDeadline){
          seen=await evaluate(session,`['X','Y'].every(part=>${JSON.stringify([source.textures.A.asset,source.textures.B.asset])}.every(path=>window.trackDraws.some(row=>row.id===${JSON.stringify(owner)}&&row.part===part&&row.texture?.endsWith('/'+path))))`);
          if(seen)break;await pause(150);
        }
        await key(session,code,false);await pause(300);
        assert(seen,code+' both drawn phases '+tank.id);
        const after=latest(session).players.find(row=>row.id===owner);
        const distance=Math.hypot(after.x-before.x,after.z-before.z);
        assert(distance>1,'Normal '+code+' tank '+tank.id+' distance '+distance);
        const input=network.slice(start).filter(row=>row.page===session&&row.name==='PlayerInput'&&row.direction==='sent');
        assert(input.some(row=>row.payload.move===(code==='KeyW'?1:-1)));
        const draws=await evaluate(session,`window.trackDraws.filter(row=>row.id===${JSON.stringify(owner)})`);
        for(const part of ['X','Y']){
          const paths=[...new Set(draws.filter(row=>row.part===part).map(row=>row.texture))];
          const source=textures.find(row=>row.recordId===selectedTextures.get(tank.id).XY&&row.tankId===tank.id);
          for(const variant of ['A','B'])assert(paths.some(path=>path?.endsWith('/'+source.textures[variant].asset)),code+' '+part+' '+variant+' actual draw tank '+tank.id);
        }
        movement.push({code,distance,before:{x:before.x,z:before.z},after:{x:after.x,z:after.z},draws});
        await evaluate(session,`window.trackDraws=[]`);
      }
      await pause(2200);await evaluate(session,`window.trackDraws=[]`);await pause(1600);
      const stopped=await evaluate(session,`window.trackDraws.filter(row=>row.id===${JSON.stringify(owner)})`);
      for(const part of ['X','Y']){
        const paths=[...new Set(stopped.filter(row=>row.part===part).map(row=>row.texture))];
        assert.equal(paths.length,1,'Stopped '+part+' frozen tank '+tank.id);
      }
      result.pages.push({owner,movement,stopped});
      if(tank.id===1||tank.id===158){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+tank.id+'-'+result.pages.length+'.png',Buffer.from(shot.data,'base64'));}
    }
    const common=snapshots(host).filter(a=>a.payload.roomId===roomId&&a.payload.phase==='PLAYING'&&snapshots(peer).some(b=>b.payload.roomId===roomId&&b.payload.tick===a.payload.tick));
    assert(common.length>20);
    for(const a of common){const b=snapshots(peer).find(b=>b.payload.roomId===roomId&&b.payload.tick===a.payload.tick);assert.deepEqual(a.payload.players,b.payload.players);}
    result.sharedTicks=common.length;
    for(const session of [peer,host]){
      if(await evaluate(session,`Boolean(document.querySelector('[data-waiting-close]'))`))await nativeClick(session,'[data-waiting-close]');
      else{if(await evaluate(session,`Boolean(document.querySelector('[data-battle-play-summary]'))`))await nativeClick(session,'[data-battle-play-summary]');await waitUntil(session,`document.querySelector('[data-leave-room]')?.matches(':enabled')`);await nativeClick(session,'[data-leave-room]');}
      await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);
      assert.equal(await evaluate(session,`window.trackScene.transformNodes.filter(n=>/^player-[^-]+$/.test(n.name)).length`),0);
    }
    result.leave=true;evidence.tanks.push(result);await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
  }
  evidence.status='PASS';console.log('PASS: '+evidence.tanks.length+' tanks actual dual-page tracks '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.runtime=[];if(ws)for(const p of pages)evidence.runtime.push(await evaluate(p.sessionId,`({draws:window.trackDraws,ticks:window.trackTicks})`).catch(()=>null));if(ws)for(const[i,p]of pages.entries()){const result=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(result)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(result.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
