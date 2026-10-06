import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources.ts';
const require = createRequire(import.meta.url), WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node --import tsx tests/browser-tank-texture-selection.mjs <CDP WebSocket>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-textures-'));
const database = join(directory, 'accounts.sqlite');
let server;
let serverLog='';
const outputPrefix=process.env.CDTANK_TEXTURES_OUTPUT ?? 'recovery/output/browser-tank-texture-selection';
async function start() {
  let log='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:{...process.env,PORT:'3019',ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{log+=String(data);serverLog+=String(data);});server.stderr.on('data',data=>{log+=String(data);serverLog+=String(data);});
  const deadline=Date.now()+15000;
  while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
}
async function stop() {
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
}
await start();
const vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5200,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3019',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
const ws=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
let sequence = 0;
const pending = new Map();
const sentFrames=[];
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if(message.method==='Network.webSocketFrameSent')sentFrames.push({session:message.sessionId,response:message.params.response});
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
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
let lastCondition;
async function waitUntil(session, expression) {
  lastCondition=expression;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+${JSON.stringify(expression)}+'; '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}


const contexts=[], pages=[], requests=new Map();
ws.on('message',raw=>{
  const message=JSON.parse(String(raw));
  if(message.method==='Network.responseReceived' && message.params.response.status===200){
    const urls=requests.get(message.sessionId)??new Set();urls.add(message.params.response.url);requests.set(message.sessionId,urls);
  }
});
const evidence={status:'PASS',scope:'Normal owned tank camouflage controls, authoritative token charges, confirmation, isolation and persistence with explicit imported ownership/profile fixtures.',sizes:[]};
async function click(session,selector){
  const point=await evaluate(session,`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw new Error('Control not hittable '+${JSON.stringify(selector)});return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},session);
  if(selector.startsWith('[data-owned-role=')||selector.startsWith('[data-role-tab='))await waitUntil(session,`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-pressed')==='true'`);
}

async function key(session,key,code,windowsVirtualKeyCode){
  for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode},session);
}
async function witness(session,selector,name){
  await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const element=document.querySelector(${JSON.stringify(selector)}),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));if(!engine)throw new Error('Preview engine missing');window[${JSON.stringify(name)}]={element,engine,scene:engine.scenes[0]};})()`);
}
async function stable(session,selector,name){
  assert(await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return w.element===document.querySelector(${JSON.stringify(selector)})&&w.engine.getRenderingCanvas()===w.element.querySelector('canvas')&&!w.engine.isDisposed&&!w.scene.isDisposed})()`),'Preview element/engine/scene identity must survive semantic changes');
}
async function disposed(session,name){
  const state=await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return {engine:w.engine.isDisposed,scene:w.scene.isDisposed,connected:w.element.isConnected,frames:w.element.dataset.frames}})()`);
  assert.equal(state.engine,true);assert.equal(state.scene,true);assert.equal(state.connected,false);
  await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert.equal(await evaluate(session,`window[${JSON.stringify(name)}].element.dataset.frames`),state.frames,'Closed preview render loop must stop');
  return state;
}

const dialog='#home-tank-texture-selection', preview=dialog+' [data-role-preview]', confirm=dialog+' [data-source-control="btnChangeTexture"]';
const original={U:20011,M:20012,XY:20013}, selected={U:21011,M:21012,XY:20023};
const ready=textures=>`document.querySelector('${preview}')?.dataset.status==='ready' && document.querySelector('${preview}').dataset.renderedTankId==='2' && Number(document.querySelector('${preview}').dataset.meshes)>0 && Number(document.querySelector('${preview}').dataset.frames)>1 && document.querySelector('${preview}').dataset.tankTextures===${JSON.stringify(JSON.stringify(textures))}`;
function persisted(store,account){
  const record=store.roleRecords(account.accountId).equipment.get(72),profile=store.roleProfile(account.accountId);
  const view=new DataView(profile.bytes.buffer,profile.bytes.byteOffset,profile.bytes.byteLength);
  return {textures:{U:record.fields.get(0x28),M:record.fields.get(0x2c),XY:record.fields.get(0x30)},money:view.getUint32(0x70,true),tokens:view.getUint32(0x74,true)};
}
async function open(session){
  await click(session,'#open-roles');await waitUntil(session,`document.querySelector('[data-owned-role="72"]')`);
  await click(session,'[data-owned-role="72"]');await click(session,'#home-roles [data-source-control="btnChangeTexture"]');
  await waitUntil(session,`document.querySelector('${dialog}')?.open`);
}
async function choose(session,textures){
  for(const [part,id] of Object.entries(textures)){
    const control={U:'Turret',M:'Body',XY:'Tread'}[part];
    for(let attempt=0;attempt<40;attempt++){
      const current=await evaluate(session,`JSON.parse(document.querySelector('${dialog}').dataset.textureSelection)[${JSON.stringify(part)}]`);
      if(current===id)break;
      assert(attempt<39,`Missing selectable ${part} texture ${id}`);
      await click(session,`${dialog} [data-source-control="btnInc${control}Texture"]`);
      await waitUntil(session,`JSON.parse(document.querySelector('${dialog}').dataset.textureSelection)[${JSON.stringify(part)}]!==${current}`);
    }
  }
}
async function reload(session){
  const origin=await evaluate(session,'performance.timeOrigin');await command('Page.reload',{},session);
  await waitUntil(session,`performance.timeOrigin!==${origin} && document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
}
let store;
async function sourceLayout(session,selector,width,height){
  const ui=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8'));
  const scale=Math.min(width/800,height/600);
  const controls=await evaluate(session,`(()=>{const dialog=document.querySelector(${JSON.stringify(selector)}),stage=dialog.querySelector('.home-roles-stage').getBoundingClientRect();return [...dialog.querySelectorAll('.home-roles-stage [data-source-control]')].map(e=>{const r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,layout:e.dataset.sourceLayout,x:r.x-stage.x,y:r.y-stage.y,width:r.width,height:r.height,asset:e.dataset.sourceAsset}})})()`);
  assert(controls.length>0,'Source layout must render recovered controls');
  for(const actual of controls){
    const layout=ui.layouts.find(row=>row.path.endsWith(actual.layout.replace('ui/layouts/','')));
    assert(layout,`Missing source layout ${actual.layout}`);
    const source=layout.windows.find(row=>row.name===actual.name);assert(source,`Missing source control ${actual.name}`);
    const rectangle=row=>row.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const box=rectangle(source);let x=box[0],y=box[1];
    for(let parent=source.parent;parent;){const owner=layout.windows.find(row=>row.name===parent),position=rectangle(owner);x+=position[0];y+=position[1];parent=owner.parent;}
    for(const [key,value] of Object.entries({x,y,width:box[2]-box[0],height:box[3]-box[1]}))assert(Math.abs(actual[key]-value*scale)<1,`${actual.layout} ${actual.name} ${key}: ${actual[key]} vs ${value*scale}`);
  }
  const assets=await evaluate(session,`(async()=>{const paths=[...new Set([...document.querySelectorAll(${JSON.stringify(selector+' [data-source-asset]')})].map(e=>e.dataset.sourceAsset))];for(const path of paths){const image=new Image();image.src='/'+path;await image.decode();if(!image.naturalWidth)throw new Error('Source image '+path);}return paths;})()`);
  assert(assets.length>0,'Source images must decode');
  return {controls,assets};
}

try {
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5200',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
  }
  store=new AccountStore(database);
  const accounts=[];
  const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
  const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '原角色');
  for(let index=0;index<2;index++){
    const account=store.open(await evaluate(pages[index].sessionId,`localStorage.getItem('cdtank-account-token')`));accounts.push(account);
    assert.equal(store.roleRecords(account.accountId).equipment.size,0,'Normal session must not grant tanks');
    const tank={name:'测试战车',fields:new Map(pair.equipment.fields)};
    tank.fields.set(0x1c,72);tank.fields.set(0x24,2);
    for(const [part,offset] of [['U',0x28],['M',0x2c],['XY',0x30]])tank.fields.set(offset,original[part]);
    store.replaceRoleRecords(account.accountId,{base:[],equipment:[tank]});
    const profile={bytes:new Uint8Array(0x170),strings:['测试账户','资料']};
    const view=new DataView(profile.bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0x70,2000,true);view.setUint32(0x74,index===0?200:0,true);
    store.replaceRoleProfile(account.accountId,profile);
  }
  const session=pages[0].sessionId,second=pages[1].sessionId;
  const initial=persisted(store,accounts[0]),otherInitial=persisted(store,accounts[1]);
  evidence.fixture={nativeOwned:'recovery/output/role-owned-pair-native.json rows[0]',tankInstance:72,tankId:2,profileBytes:0x170,selectedOffset:0xa8,moneyOffset:0x70,tokensOffset:0x74,ownerTokens:200,otherTokens:0,ownershipOrigin:'explicit imported fixture; normal accounts initially empty'};
  await open(session);await waitUntil(session,ready(original));
  await witness(session,preview,'textureWitness');
  await witness(session,'#home-roles [data-role-preview]','parentWitness');
  await choose(session,selected);await waitUntil(session,ready(selected));
  await stable(session,preview,'textureWitness');
  server.kill('SIGSTOP');
  try {
    const before=sentFrames.filter(frame=>frame.session===session).length;
    await click(session,confirm);await waitUntil(session,`document.querySelector('${dialog} > output[aria-live="polite"]').value==='保存战车迷彩…'`);
    await click(session,confirm);
    assert.equal(sentFrames.filter(frame=>frame.session===session).length-before,1,'Pending camouflage save sends one request');
    assert.deepEqual(persisted(store,accounts[0]),initial,'Pending request cannot change confirmed wallet or textures');
    await key(session,'Escape','Escape',27);
    assert(await evaluate(session,`document.querySelector('${dialog}').open`),'Camouflage payment remains open until confirmation');
  } finally {server.kill('SIGCONT');}
  evidence.pendingSingleRequest=true;evidence.pendingPaymentRetainsDialog=true;
  await waitUntil(session,`document.querySelector('${dialog} > output[aria-live="polite"]')?.value.includes('保存')`);
  await waitUntil(session,ready(selected));
  await waitUntil(session,ready(selected).replaceAll(preview,'#home-roles [data-role-preview]'));
  await stable(session,preview,'textureWitness');await stable(session,'#home-roles [data-role-preview]','parentWitness');
  evidence.previewIdentityStable=true;
  const saved=persisted(store,accounts[0]);assert.deepEqual(saved,{textures:selected,money:2000,tokens:90});
  assert.deepEqual(persisted(store,accounts[1]),otherInitial);
  const rows=JSON.parse(await readFile('recovery/output/web-assets/tank-textures.json','utf8')).rows;
  const urls=Object.values(selected).flatMap(id=>Object.values(rows.find(row=>row.recordId===id).textures).filter(Boolean).map(texture=>texture.asset));
  for(const asset of urls)assert([...requests.get(session)??[]].some(url=>url.endsWith('/'+asset)),`Selected preview texture not loaded: ${asset}`);
  const visibleAssets=Object.values(selected).map(id=>rows.find(row=>row.recordId===id).textures.A.asset);
  const actualMaterials=await evaluate(session,`(()=>{const scene=window.textureWitness.scene;return scene.meshes.filter(mesh=>mesh.isEnabled()&&mesh.getTotalVertices()>0).map(mesh=>({mesh:mesh.name,textures:mesh.material?.getActiveTextures().map(texture=>({url:texture.url,ready:texture.isReady()}))??[]}))})()`);
  for(const asset of visibleAssets)assert(actualMaterials.some(mesh=>mesh.textures.some(texture=>texture.ready&&texture.url.endsWith('/'+asset))),`Rendered preview material must bind selected texture ${asset}`);
  evidence.renderedPreviewMaterials=actualMaterials;

  assert(await evaluate(session,`document.querySelector('${confirm}').disabled`));
  await click(session,confirm);
  assert.deepEqual(persisted(store,accounts[0]),saved);
  for(const [width,height] of [[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const state=await evaluate(session,`(()=>{const e=document.querySelector('${dialog}'),r=e.getBoundingClientRect(),b=document.querySelector('${confirm}');return {x:r.x,y:r.y,width:r.width,height:r.height,source:b.dataset.sourceControl,asset:b.dataset.sourceAsset,text:e.innerText,preview:(()=>{const e=document.querySelector('${preview}'),r=e.getBoundingClientRect(),c=e.querySelector('canvas');return {width:r.width,height:r.height,pixels:[c.width,c.height],frames:Number(e.dataset.frames),meshes:Number(e.dataset.meshes)}})()}})()`);
    assert(state.x>=0&&state.y>=0&&state.x+state.width<=width&&state.y+state.height<=height);
    assert(Math.abs(state.preview.width-218*Math.min(width/800,height/600))<1);assert(Math.abs(state.preview.height-217*Math.min(width/800,height/600))<1);
    assert(Math.abs(state.preview.pixels[0]-state.preview.width)<=1);assert(Math.abs(state.preview.pixels[1]-state.preview.height)<=1);assert(state.preview.frames>1&&state.preview.meshes>0);
    assert(state.text.includes('90'));assert(state.text.includes('2000'));assert.equal(state.source,'btnChangeTexture');
    const screenshot=await command('Page.captureScreenshot',{format:'png'},session);
    await writeFile(`${outputPrefix}-${width}.png`,Buffer.from(screenshot.data,'base64'));
    evidence.sizes.push({viewport:{width,height},...state,sourceLayout:await sourceLayout(session,dialog,width,height)});
  }
  await open(second);await waitUntil(second,ready(original));await witness(second,preview,'rejectedTextureWitness');await choose(second,selected);await click(second,confirm);
  await waitUntil(second,`document.querySelector('${dialog} > output[aria-live="polite"]')?.value.includes('不足')`);
  await waitUntil(second,ready(original));await waitUntil(second,ready(original).replaceAll(preview,'#home-roles [data-role-preview]'));assert.deepEqual(persisted(store,accounts[1]),otherInitial);
  await stable(second,preview,'rejectedTextureWitness');
  evidence.rejectionPreviewIdentityStable=true;
  assert.deepEqual(persisted(store,accounts[0]),saved);
  await choose(session,original);await waitUntil(session,ready(original));
  assert.deepEqual(persisted(store,accounts[0]),saved,'Draft preview cannot debit or persist');
  await witness(session,preview,'draftWitness');
  await key(session,'Escape','Escape',27);await waitUntil(session,`!document.querySelector('${dialog}[open]')`);
  await disposed(session,'draftWitness');
  await waitUntil(session,`document.activeElement?.dataset.sourceControl==='btnChangeTexture'`);
  await click(session,'#home-roles [data-source-control="btnChangeTexture"]');await waitUntil(session,ready(selected));
  evidence.closedDraftRestores=true;evidence.escapeFocus=true;
  await reload(session);await open(session);await waitUntil(session,ready(selected));assert.deepEqual(persisted(store,accounts[0]),saved);
  await stop();await start();await reload(session);await open(session);await waitUntil(session,ready(selected));assert.deepEqual(persisted(store,accounts[0]),saved);
  await reload(second);await open(second);await waitUntil(second,ready(original));assert.deepEqual(persisted(store,accounts[1]),otherInitial);
  for(const current of [session,second]){
    await witness(current,preview,'finalTextureWitness');
    await witness(current,'#home-roles [data-role-preview]','finalRolesWitness');
    await click(current,dialog+' > button');await waitUntil(current,`!document.querySelector('${dialog}[open]')`);
    await disposed(current,'finalTextureWitness');
    await click(current,'[data-roles-close]');await waitUntil(current,`!document.querySelector('#home-roles[open]')`);
    await disposed(current,'finalRolesWitness');
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
  await click(session,'#create-room-controls > summary');await click(session,'#create-room');
  await waitUntil(session,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.phase==='WAITING'&&s.mapLoaded&&s.renderedPlayers===1})()`);
  const world=await evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const local=world.players.find(player=>player.id===world.playerId);
  assert.equal(local.tankId,2);assert.deepEqual(local.tankTextures,selected,'Normal room entry renders restarted account owned camouflage');
  const roomMaterials=await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const scene=EngineStore.Instances.find(engine=>engine.getRenderingCanvas()===document.querySelector('#world')).scenes[0];const root=scene.getTransformNodeByName('player-'+${JSON.stringify(world.playerId)});return root.getChildMeshes().filter(mesh=>mesh.isEnabled()&&mesh.getTotalVertices()>0).map(mesh=>({mesh:mesh.name,textures:mesh.material?.getActiveTextures().map(texture=>({url:texture.url,ready:texture.isReady()}))??[]}));})()`);
  for(const asset of visibleAssets)assert(roomMaterials.some(mesh=>mesh.textures.some(texture=>texture.ready&&texture.url.endsWith('/'+asset))),`Normal WAITING player material must bind selected texture ${asset}`);
  evidence.actualRoomEntry={phase:world.phase,tankId:local.tankId,tankTextures:local.tankTextures,mapLoaded:world.mapLoaded,renderedPlayers:world.renderedPlayers,materials:roomMaterials};
  await waitUntil(session,`document.querySelector('#leave')?.hidden===false && !document.querySelector('#leave').disabled`);
  await click(session,'#leave');await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);
  evidence.normalRoomExit=true;

  Object.assign(evidence,{initial,saved,otherInitial,selectedAssetURLs:urls,mouseControls:true,unchangedNoCharge:true,insufficientRetains:true,accountIsolation:true,refreshRestores:true,restartRestores:true,closeDisposes:true});
  await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
  console.log('PASS: normal camouflage selection, token charges, unchanged no charge, insufficient rejection, URLs, account isolation, refresh/restart and close cleanup');
} catch(error) {
  evidence.status='FAIL';evidence.error=String(error);evidence.lastCondition=lastCondition;
  evidence.diagnostics=await Promise.all(pages.map(async page=>({targetId:page.targetId,state:await evaluate(page.sessionId,`({roles:document.querySelector('#home-roles')?.outerHTML,textures:document.querySelector('#home-tank-texture-selection')?.outerHTML,hud:document.querySelector('#battle-status')?.value,world:document.querySelector('#battle-status')?.dataset.world,focus:document.activeElement?.outerHTML})`).catch(error=>({error:String(error)}))})));
  throw error;
} finally {
  await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
  store?.close();
  for(const {targetId} of pages)await command('Target.closeTarget',{targetId}).catch(()=>{});
  for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});
  ws.close();await vite.close();server?.kill('SIGCONT');await stop();await writeFile(`${outputPrefix}-server.log`,serverLog);await rm(directory,{recursive:true,force:true});
}
