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
if (!endpoint) throw new Error('Usage: node --import tsx tests/browser-home-equipment.mjs <CDP WebSocket>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-home-'));
const database = join(directory, 'accounts.sqlite');
let server;
let serverLog = '';
const outputPrefix = process.env.CDTANK_EQUIPMENT_OUTPUT ?? 'recovery/output/browser-home-equipment';
async function start() {
  let log='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:{...process.env,PORT:'3134',ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
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
  server:{port:5193,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3134',ws:true,rewrite:()=> '/'}}}});
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}


const contexts=[], pages=[];
const evidence={status:'PASS',scope:'React equipment pane; explicit native owned source fixtures; ordinary CDP mouse/keyboard, confirmed profile persistence, source layouts, pending isolation and Babylon disposal. E-R01 natural rounds and dual-page item effects reused.',sizes:[]};
async function click(session,selector){
  const point=await evaluate(session,`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw new Error('Not visible/hittable '+${JSON.stringify(selector)});return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},session);
  if(selector.startsWith('[data-equipment-item='))await waitUntil(session,`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-pressed')==='true'`);
  if(selector.startsWith('[data-equipment-tab='))await waitUntil(session,`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-pressed')==='true'`);
}
async function key(session,key,code,windowsVirtualKeyCode){
  await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},session);
}
async function engines(session){
  return evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);return EngineStore.Instances.map(e=>({canvas:e.getRenderingCanvas()?.getAttribute('aria-label'),scenes:e.scenes.length,disposed:e.isDisposed}));})()`);
}

try {
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5193',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
  }
  const session=pages[0].sessionId,guest=pages[1].sessionId;
  const store=new AccountStore(database);
  try {
    const token=await evaluate(session,`localStorage.getItem('cdtank-account-token')`);
    const owner=store.open(token);
    const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
    const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '原角色');
    const base={name:'测试宠物',fields:new Map(pair.base.fields)},tank={name:'测试战车',fields:new Map(pair.equipment.fields)};
    base.fields.set(0,71);base.fields.set(8,1);tank.fields.set(0x1c,72);tank.fields.set(0x24,2);tank.fields.set(0x28,20011);tank.fields.set(0x2c,20012);tank.fields.set(0x30,20013);tank.fields.set(0x6c,3);
    for(const offset of [0x58,0x5c,0x60])tank.fields.set(offset,0);
    for(let slot=0;slot<6;slot++){base.fields.set(0x44+slot*4,0);base.fields.set(0x5c+slot*4,0);}
    store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank]});
    const profile={bytes:new Uint8Array(0x170),strings:['角色名','资料']};
    new DataView(profile.bytes.buffer).setUint32(0xa4,71,true);new DataView(profile.bytes.buffer).setUint32(0xa8,72,true);
    store.replaceRoleProfile(owner.accountId,profile);
    const records=[13001,13002,14001,10001,10002,12001].map((itemTableId,index)=>({instanceId:81+index,itemTableId,ownedQuantity:1,battleQuantity:1,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}));
    store.replaceInventory(owner.accountId,records);
    evidence.fixture={source:'recovery/output/role-owned-pair-native.json rows[0]',petInstanceId:71,tankInstanceId:72,tankId:2,capacity:3,inventory:records.map(({instanceId,itemTableId,ownedQuantity})=>({instanceId,itemTableId,ownedQuantity}))};
    const slot=index=>`[data-equipment-slot="${index}"]`;
    const item=id=>`[data-equipment-item="${id}"]`;
    const saved=`document.querySelector('#home-equipment > output')?.value==='部件已保存'`;
    await click(session,'#open-equipment');await waitUntil(session,`document.querySelector('${item(81)}')`);
    await waitUntil(session,`document.querySelector('#home-equipment [data-role-preview]')?.dataset.renderedTankId==='2'`);
    assert.equal(await evaluate(session,`document.querySelector('${slot(3)}').disabled`),true);
    assert.equal(await evaluate(session,`document.querySelector('${slot(4)}').disabled`),true);
    assert((await evaluate(session,`document.querySelector('${item(81)}').textContent`)).includes('×1'));
    const frameBefore=await evaluate(session,`Number(document.querySelector('#home-equipment [data-role-preview]').dataset.frames)`);
    await waitUntil(session,`Number(document.querySelector('#home-equipment [data-role-preview]').dataset.frames)>${frameBefore+2}`);
    evidence.previewDraw=true;
    await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const element=document.querySelector('#home-equipment [data-role-preview]');const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));window.equipmentPreviewWitness={element,engine,scene:engine.scenes[0]};})()`);
    await click(session,item(81));await click(session,slot(0));await waitUntil(session,`${saved} && document.querySelector('${slot(0)}').dataset.instanceId==='81'`);
    assert.equal(store.inventory(owner.accountId).records[0].state,2);
    await click(session,item(82));await click(session,slot(1));
    await waitUntil(session,`document.querySelector('#home-equipment > output').value.includes('同类')`);
    assert.equal(await evaluate(session,`document.querySelector('${slot(0)}').dataset.instanceId`),'81');
    assert.equal(await evaluate(session,`document.querySelector('${slot(1)}').dataset.instanceId`),'0');
    await click(session,item(81));await click(session,slot(2));await waitUntil(session,`${saved} && document.querySelector('${slot(2)}').dataset.instanceId==='81'`);
    assert.equal(await evaluate(session,`document.querySelector('${slot(0)}').dataset.instanceId`),'0');
    // Physical keyboard Delete on focused part slot.
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},session);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},session);
    await waitUntil(session,`${saved} && document.querySelector('${slot(2)}').dataset.instanceId==='0'`);
    await click(session,item(83));await click(session,slot(1));await waitUntil(session,`${saved} && document.querySelector('${slot(1)}').dataset.instanceId==='83'`);
    const cosmetic=target=>`[data-equipment-target="${target}"]`;
    for(const [target,id] of [['DECORATION',84],['MARK',86]]){
      await click(session,`[data-equipment-tab="${target}"]`);
      await click(session,item(id));await click(session,cosmetic(target));
      await waitUntil(session,`${saved} && document.querySelector('${cosmetic(target)}').dataset.instanceId==='${id}'`);
      assert.equal(store.inventory(owner.accountId).records.find(r=>r.instanceId===id).state,2);
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},session);
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},session);
      await waitUntil(session,`${saved} && document.querySelector('${cosmetic(target)}').dataset.instanceId==='0'`);
      await click(session,cosmetic(target));
      await waitUntil(session,`${saved} && document.querySelector('${cosmetic(target)}').dataset.instanceId==='${id}'`);
    }
    await click(session,'[data-equipment-tab="DECORATION"]');
    await click(session,item(85));await click(session,cosmetic('DECORATION'));
    await waitUntil(session,`${saved} && document.querySelector('${cosmetic('DECORATION')}').dataset.instanceId==='85'`);
    assert.equal(store.inventory(owner.accountId).records.find(r=>r.instanceId===84).state,0);
    await click(session,'[data-equipment-tab="MARK"]');
    await click(session,item(86));await click(session,cosmetic('DECORATION'));
    await waitUntil(session,`document.querySelector('#home-equipment > output').value.includes('不能装备')`);
    assert.equal(await evaluate(session,`document.querySelector('${cosmetic('DECORATION')}').dataset.instanceId`),'85');
    const sourceUi=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8'));
    const sourceControls=sourceUi.layouts.find(layout=>layout.path.endsWith('myhome_panzerpage.xml')).windows;
    const expectedControls=['heseditu','ditukuang','heseditu2','bgHatIcon','bgMarkIcon',
      'bgInternalPart0','bgInternalPart1','bgExternalPart0','bgExternalPart1','bgExternalPart2',
      'rdoCommon','rdoHat','rdoMark','lstEquip','picHatIcon','picMarkIcon',
      'picInternalPart0','picInternalPart1','picExternalPart0','picExternalPart1','picExternalPart2','picModel','txtTankName'];
    for(const [width,height] of [[1920,1080],[3840,2160]]){
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
      await waitUntil(session,`(()=>{const e=document.querySelector('#home-equipment [data-role-preview]'),r=e.getBoundingClientRect(),c=e.querySelector('canvas');return Math.abs(r.width-218*Math.min(${width}/800,${height}/600))<1&&Math.abs(c.width-r.width)<=1&&Math.abs(c.height-r.height)<=1})()`);
      const model=await evaluate(session,`(()=>{const e=document.querySelector('#home-equipment [data-role-preview]'),r=e.getBoundingClientRect(),c=e.querySelector('canvas');return {instance:e.dataset.instanceId,tank:e.dataset.renderedTankId,status:e.dataset.status,meshes:Number(e.dataset.meshes),width:r.width,height:r.height,pixels:[c.width,c.height]}})()`);
      assert.equal(model.instance,'72');assert.equal(model.tank,'2');assert.equal(model.status,'ready');assert(model.meshes>0);
      assert(Math.abs(model.width-218*Math.min(width/800,height/600))<1);
      assert(Math.abs(model.pixels[0]-model.width)<=1);assert(Math.abs(model.pixels[1]-model.height)<=1);
      const bounds=await evaluate(session,`(()=>{const r=document.querySelector('#home-equipment').getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y}})()`);
      assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);
      const positions=await evaluate(session,`(()=>{const stage=document.querySelector('.home-equipment-stage').getBoundingClientRect();return [...document.querySelectorAll('#home-equipment [data-source-control]')].map(e=>{const r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,layout:e.dataset.sourceLayout,x:r.x-stage.x,y:r.y-stage.y,width:r.width,height:r.height}})})()`);
      assert.deepEqual(positions.map(p=>p.name).sort(),[...expectedControls].sort());
      const rect=control=>control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);
      for(const actual of positions){
        const control=sourceControls.find(c=>c.name===actual.name),box=rect(control);
        let x=box[0],y=box[1];
        for(let parent=control.parent;parent;){const owner=sourceControls.find(c=>c.name===parent),r=rect(owner);x+=r[0];y+=r[1];parent=owner.parent;}
        assert.equal(actual.layout,'ui/layouts/myhome_panzerpage.xml');
        for(const [key,value] of Object.entries({x,y,width:box[2]-box[0],height:box[3]-box[1]}))
          assert(Math.abs(actual[key]-value*Math.min(width/800,height/600))<1,`${actual.name} ${key}`);
      }
      const assets=await evaluate(session,`(async()=>{const paths=[...new Set([...document.querySelectorAll('#home-equipment [data-source-asset]')].map(e=>e.dataset.sourceAsset))];for(const path of paths){const image=new Image();image.src='/'+path;await image.decode();if(!image.naturalWidth)throw new Error(path);}return paths;})()`);
      const iconSets=sourceUi.imagesets.filter(set=>set.attributes.Name==='daoju0');
      const iconSet=iconSets.find(set=>set.path.includes('imagesets_dds/'))??iconSets[0];
      assert(assets.includes(iconSet.images.find(image=>image.Name==='data\\ui\\daoju\\12001.tga').asset));
      evidence.sizes.push({width,height,bounds,model});
      const capture=await command('Page.captureScreenshot',{format:'png'},session);
      await writeFile(`${outputPrefix}-${width}.png`,Buffer.from(capture.data,'base64'));
    }
    assert(Math.abs(evidence.sizes[1].bounds.width/evidence.sizes[0].bounds.width-2)<0.01);
    assert.equal(await evaluate(session,`window.equipmentPreviewWitness.element===document.querySelector('#home-equipment [data-role-preview]') && window.equipmentPreviewWitness.engine.getRenderingCanvas()===document.querySelector('#home-equipment canvas') && !window.equipmentPreviewWitness.scene.isDisposed`),true,'Candidate/tab/save commits keep preview identity');
    await key(session,'Escape','Escape',27);
    await waitUntil(session,`!document.querySelector('#home-equipment[open]') && document.activeElement?.id==='open-equipment'`);
    const closed=await evaluate(session,`({engine:window.equipmentPreviewWitness.engine.isDisposed,scene:window.equipmentPreviewWitness.scene.isDisposed,connected:window.equipmentPreviewWitness.element.isConnected,frames:window.equipmentPreviewWitness.element.dataset.frames})`);
    assert.equal(closed.engine,true);assert.equal(closed.scene,true);assert.equal(closed.connected,false);
    await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    assert.equal(await evaluate(session,`window.equipmentPreviewWitness.element.dataset.frames`),closed.frames);
    evidence.previewIdentityStable=true;evidence.closedPreviewDisposed=closed;
    assert.equal((await engines(session)).length,1,'Closing preview must release its Babylon engine');
    await click(session,'#open-equipment');
    await waitUntil(session,`document.querySelector('${item(81)}') && document.querySelector('#home-equipment [data-role-preview]')?.dataset.renderedTankId==='2'`);
    assert.equal((await engines(session)).length,2,'Reopening creates one preview engine');
    await click(session,item(81));
    server.kill('SIGSTOP');
    try {
      const before=sentFrames.filter(frame=>frame.session===session).length;
      await click(session,slot(0));
      await waitUntil(session,`document.querySelector('#home-equipment > output').value==='保存部件…'`);
      await click(session,slot(2));
      assert.equal(sentFrames.filter(frame=>frame.session===session).length-before,1,'Pending duplicate must send exactly one request');
      assert.equal(await evaluate(session,`document.querySelector('${slot(0)}').dataset.instanceId`),'0');
      assert.equal(await evaluate(session,`document.querySelector('${slot(2)}').disabled`),true);
      await key(session,'Escape','Escape',27);
      await waitUntil(session,`!document.querySelector('#home-equipment[open]') && document.activeElement?.id==='open-equipment'`);
      assert.equal((await engines(session)).length,1,'Pending close must dispose preview');
      await click(session,'#open-equipment');
      await waitUntil(session,`document.querySelector('#home-equipment > output').value==='载入部件…'`);
      server.kill('SIGCONT');
      await waitUntil(session,`document.querySelector('${slot(0)}')?.dataset.instanceId==='81' && !document.querySelector('${slot(0)}').disabled`);
      assert.equal(await evaluate(session,`document.querySelector('${item(81)}').getAttribute('aria-pressed')`),'false');
      assert.notEqual(await evaluate(session,`document.querySelector('#home-equipment > output').value`),'部件已保存','Old save must not overwrite new opening status');
      assert.equal(await evaluate(session,`document.querySelector('${slot(2)}').dataset.instanceId`),'0');
    } finally {server.kill('SIGCONT');}
    await click(session,slot(0));await key(session,'Delete','Delete',46);
    await waitUntil(session,`${saved} && document.querySelector('${slot(0)}').dataset.instanceId==='0'`);
    evidence.escapeFocus=true;evidence.pendingSingleRequest=true;evidence.closedRequestIsolation=true;
    await click(guest,'#open-equipment');await waitUntil(guest,`document.querySelector('#home-equipment > output').value.includes('尚未建立')`);
    assert.equal(await evaluate(guest,`document.querySelectorAll('[data-equipment-item]').length`),0);
    for(const restart of [false,true]){
      if(restart){await stop();await start();}
      const origin=await evaluate(session,`performance.timeOrigin`);await command('Page.reload',{},session);
      await waitUntil(session,`performance.timeOrigin!==${origin} && document.querySelector('#tank')?.options.length===21`);
      assert.equal(await evaluate(session,`localStorage.getItem('cdtank-account-token')`),token);
      await click(session,'#open-equipment');await waitUntil(session,`document.querySelector('${slot(1)}')?.dataset.instanceId==='83'`);
      assert.equal(await evaluate(session,`document.querySelector('${cosmetic('DECORATION')}').dataset.instanceId`),'85');
      assert.equal(await evaluate(session,`document.querySelector('${cosmetic('MARK')}').dataset.instanceId`),'86');
      assert.equal(store.inventory(owner.accountId).records.find(r=>r.instanceId===83).state,2);
      await waitUntil(session,`document.querySelector('#home-equipment [data-role-preview]')?.dataset.renderedTankId==='2'`);
    }
    store.replaceInventory(owner.accountId,store.inventory(owner.accountId).records.filter(r=>r.instanceId!==81));
    await click(session,item(81));await click(session,slot(0));await waitUntil(session,`document.querySelector('#home-equipment > output').value.includes('不属于')`);
    assert.equal(await evaluate(session,`document.querySelector('${slot(1)}').dataset.instanceId`),'83');
    await click(session,'[data-equipment-close]');
    await waitUntil(session,`!document.querySelector('#home-equipment[open]')`);
    assert.equal((await engines(session)).length,1,'Final close releases preview engine and scene');
    const confirmed=store.roleProfile(owner.accountId);
    assert.deepEqual(Array.from({length:5},(_,i)=>new DataView(confirmed.bytes.buffer,confirmed.bytes.byteOffset).getUint32(0x148+i*4,true)),[0,83,0,0,0]);
    evidence.profileSlots=[0,83,0,0,0];
    await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);EngineStore.Instances[0].setHardwareScalingLevel(3);EngineStore.Instances[0].resize();})()`);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
    await click(session,'#create-room-controls > summary');
    await click(session,'#create-room');
    await waitUntil(session,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===1})()`);
    const world=await evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
    const local=world.players.find(player=>player.id===world.playerId);
    assert.deepEqual(local.tankTextures,{U:20011,M:20012,XY:20013},'Room entry binds profile-selected owned tank texture source');
    assert.equal(store.roleProfile(owner.accountId).bytes[0x14c],83);
    evidence.actualRoomEntry={phase:world.phase,tankId:local.tankId,tankTextures:local.tankTextures,profileSlots:[0,83,0,0,0]};
    await waitUntil(session,`document.querySelector('#leave')?.hidden===false && !document.querySelector('#leave').disabled && document.querySelector('#battle-controls')?.hidden===true && !document.querySelector('#create-room').disabled`);
    await click(session,'#leave');
    await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);
    evidence.hiddenCapacity=true;
    Object.assign(evidence,{savedTankPreview:true,previewCloseDisposes:true});
    Object.assign(evidence,{mouseEquip:true,conflictReject:true,move:true,keyboardUnequip:true,refreshRestores:true,restartRestores:true,accountIsolation:true,staleOwnershipReject:true,
      sourceControls:expectedControls,sourceCoordinates1080p4K:true,sourceAssetsDecoded:true,
      cosmetics:{mouseEquip:true,keyboardUnequip:true,replacement:true,categoryReject:true,refresh:true,restart:true}});
    await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
    console.log('PASS: normal equipment mouse equip/move, keyboard unequip, rejects,1080p/4K, isolation and refresh/restart');
  }finally{store.close();}
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);evidence.lastCondition=lastCondition;
  evidence.diagnostics=await Promise.all(pages.map(async page=>({targetId:page.targetId,state:await evaluate(page.sessionId,`({status:document.querySelector('#home-equipment output')?.value,hud:document.querySelector('#battle-status')?.value,create:(()=>{const e=document.querySelector('#create-room'),r=e?.getBoundingClientRect();return {disabled:e?.disabled,details:document.querySelector('#create-room-controls')?.open,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,hit:r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML:null}})(),preview:(()=>{const e=document.querySelector('#home-equipment [data-role-preview]');if(!e)return null;const r=e.getBoundingClientRect(),c=e.querySelector('canvas');return {rect:{width:r.width,height:r.height},pixels:[c.width,c.height],zoom:document.querySelector('#home-equipment').style.zoom}})(),focus:document.activeElement?.outerHTML,dialog:document.querySelector('#home-equipment')?.outerHTML,world:document.querySelector('#battle-status')?.dataset.world})`).catch(error=>({error:String(error)}))})));
  throw error;
}finally{
  await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
  for(const {targetId} of pages)await command('Target.closeTarget',{targetId}).catch(()=>{});
  for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});
  ws.close();await vite.close();server?.kill('SIGCONT');await stop();await writeFile(`${outputPrefix}-server.log`,serverLog);await rm(directory,{recursive:true,force:true});
}
