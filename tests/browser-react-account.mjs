import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources.ts';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
let endpoint = process.argv.slice(2).find(value => !value.startsWith('--'));
let chrome;
let chromeDirectory, directory, server, vite, ws, store, command;
const pages=[],contexts=[];
const itemTableId = 2;
const catalog = JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const itemDefinition = catalog.items.find(item => item.itemTableId === itemTableId);
const skillDefinition = catalog.skills.find(skill => skill.skillId === itemDefinition.skillIds[0]);
assert.equal(skillDefinition.skillId, itemTableId);
assert.equal(skillDefinition.attributes.HP, 400);
const sourceEffect = skillDefinition.effects[0];
const shopIds = [1, 2, 4, 6, 7, 8];
const sourceUi = JSON.parse(await readFile('recovery/output/web-assets/ui.json', 'utf8'));
const itemImageSets = sourceUi.imagesets.filter(set => set.attributes.Name === 'daoju0');
const itemImageSet = itemImageSets.find(set => set.path.includes('imagesets_dds/')) ?? itemImageSets[0];
const hd = true;
const originalMovement = true;
const viewport = {width:1920,height:1080};
const scaling = 1;
const startingQuantity = 3;
const evidencePath = (process.env.CDTANK_ACCOUNT_OUTPUT ?? 'recovery/output/browser-react-account')+'.json';
try {
if (!endpoint) {
  chromeDirectory=await mkdtemp(join(tmpdir(),'cdtank-consumables-chrome-'));
  chrome=spawn('/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9279',`--user-data-dir=${chromeDirectory}`],
    {stdio:['ignore','ignore','pipe']}
  );
  chrome.stderr.on('data',data=>{if(String(data).includes('FATAL'))process.stderr.write(data);});
  chrome.once('exit',(code,signal)=>{if(signal!=='SIGTERM')console.error('Dedicated Chrome exited',code,signal);});
  const deadline=Date.now()+15000;
  while(!endpoint&&Date.now()<deadline){
    try {endpoint=(await(await fetch('http://127.0.0.1:9279/json/version')).json()).webSocketDebuggerUrl;}catch {}
    if(!endpoint)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(endpoint,'Dedicated Chrome must start');
}
directory = await mkdtemp(join(tmpdir(), 'cdtank-consumables-browser-'));
const database = join(directory, 'accounts.sqlite');
async function start() {
  let log='';
  const environment={...process.env,PORT:'3164',ACCOUNT_DB_PATH:database};
  delete environment.MATCH_TIME_LIMIT_SECONDS;delete environment.MATCH_MIN_PLAYERS;
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:environment,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
  const deadline=Date.now()+15000;
  while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
}
async function stop() {
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
}
await start();
vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5207,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3164',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
let sequence = 0;
const pending = new Map();
ws.on('close',()=>{for(const request of pending.values())request.reject(new Error('Browser CDP connection closed'));pending.clear();});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
command = function(method, params = {}, sessionId) {
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
async function waitUntil(session, expression) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')
          && !String(error).includes('Inspected target navigated or closed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
async function click(session,selector) {
 const p=await evaluate(session,`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1},session);
 await evaluate(session,`new Promise(requestAnimationFrame)`);
}
async function key(session,key,code,n) {for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:n},session);}
async function select(session,selector,value){
 const steps=await evaluate(session,`Array.from(document.querySelector(${JSON.stringify(selector)}).options).findIndex(o=>o.value===${JSON.stringify(value)})`);assert(steps>=0);
 await click(session,selector);await key(session,'Home','Home',36);
 for(let i=0;i<steps;i++)await key(session,'ArrowDown','ArrowDown',40);
 await key(session,'Enter','Enter',13);await waitUntil(session,`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`);
}
async function quantity(session,value){await click(session,'[data-shop-quantity]');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},session);await command('Input.insertText',{text:String(value)},session);await evaluate(session,`new Promise(requestAnimationFrame)`);}
function assertHealingEvent(event) {
  assert.equal(event.type, 'itemUsed');
  assert.equal(event.skillId, skillDefinition.skillId);
  assert.equal(event.targetId, event.playerId);
  assert(event.message.includes(itemDefinition.name));
  assert(event.value > 0 && event.value <= skillDefinition.attributes.HP);
  assert.deepEqual(event.playSkillEffect, {skillId:skillDefinition.skillId, effectIndex:0, duration:0,
    roleId:Number(event.playerId.slice(1)), xBits:0, zBits:0});
}
const state=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
const evidence={itemDefinition,skillDefinition,scope:'Normal dual-webpage purchase and two natural rounds with original owned role/profile fixtures.'};
try {
  for(let index=0;index<2;index++) {
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5207',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(${scaling});EngineStore.LastCreatedEngine.resize();
      window.healingFrameTimes=[];
      const scene=EngineStore.LastCreatedScene;
      window.healingCamera=scene.activeCamera;
      scene.onAfterRenderObservable.add(()=>{
        const world=document.querySelector('#battle-status')?.dataset.world;
        if(world&&JSON.parse(world).phase==='PLAYING'&&window.healingFrameTimes.length<75000)
          window.healingFrameTimes.push(scene.getEngine().getDeltaTime());
      });
      window.healingObserved={effects:[],sounds:[],events:[],canvas:{width:EngineStore.LastCreatedEngine.getRenderWidth(),height:EngineStore.LastCreatedEngine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
      const attached=EffectRuntime.prototype.spawnAttachedEffect;
      EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
        const handle=attached.call(this,view,id,tag,once,local);
        if(id===${sourceEffect.effectId}){window.healingRuntime=this;const instance=this.instances.find(row=>row.handle===handle);
          window.healingObserved.effects.push({handle,id,tag,once,local:view===local,
            drawCount:instance?.draws.length??0,parent:!!view.primaryTag(EFFECT_PRIMARY_TAGS[tag]),
            actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:instance?.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}
        return handle;
      };
      const sound=EffectRuntime.prototype.playSkillSound;
      EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
        const handle=sound.call(this,view,reference,selector);
        if(reference===${JSON.stringify(sourceEffect.sound)}){window.healingRuntime=this;const voice=this.skillSound.voices.get(handle);
          const row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,
            context:this.skillSound.context?.state,position:voice?.position,played:false,ended:false};
          voice?.audio.addEventListener('playing',()=>{row.played=true;});
          voice?.audio.addEventListener('ended',()=>{row.ended=true;});
          window.healingObserved.sounds.push(row);}
        return handle;
      };
      const {Battle}=await import('/src/match/battle.ts');
      const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.healingBattle=this;return reconcile.apply(this,args);};
      const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts');
      const event=BattleSkillEffects.prototype.event;
      BattleSkillEffects.prototype.event=function(value){if(value.type==='itemUsed')window.healingObserved.events.push(value);return event.call(this,value);};
    })()`);
  }
  console.log('Two 1920x1080 webpages ready');
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  const token=await evaluate(host,`localStorage.getItem('cdtank-account-token')`);
  store=new AccountStore(database);const owner=store.open(token);
  assert.deepEqual(store.inventory(owner.accountId).records,[]);
  const accounts=[];
  if(originalMovement){
    const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
    const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '明确导入战车');
    for(const [index,page] of pages.entries()){
      const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));accounts.push(account);
      assert.deepEqual(store.inventory(account.accountId).records,[]);
      const native=originalMovement?JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(row=>row.tankId===1&&row.part===0):undefined;
      const fields=value=>new Map(Object.entries(value).map(([key,value])=>[Number(key),value]));
      const equipment={name:'明确导入迷彩战车',fields:native?fields(native.equipment):new Map(pair.equipment.fields)};
      const base=native?{name:'明确导入原宠物',fields:fields(native.base)}:undefined;
      equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);
      equipment.fields.set(0x28,index===0?10011:10021);equipment.fields.set(0x2c,index===0?10012:10022);
      equipment.fields.set(0x30,index===0?10013:10023);
      store.replaceRoleRecords(account.accountId,{base:base?[base]:[],equipment:[equipment]});
      const bytes=new Uint8Array(0x170);const profileView=new DataView(bytes.buffer);profileView.setUint32(0xa8,72,true);
      profileView.setUint32(0x70,index===0?100:0,true);profileView.setUint32(0x74,index===0?40:0,true);
      if(base)new DataView(bytes.buffer).setUint32(0xa4,base.fields.get(0),true);
      store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
    }
  }
  const balances=accountId=>{const profile=store.roleProfile(accountId);const view=new DataView(profile.bytes.buffer,profile.bytes.byteOffset,profile.bytes.byteLength);return {money:view.getUint32(0x70,true),tokens:view.getUint32(0x74,true)};};
  await click(guest,'#open-shop');
  await waitUntil(guest,`document.querySelector('[data-shop-product]')?.textContent.includes('每份10金币 / 10软星币') && !document.querySelector('[data-shop-buy]').disabled`);
  await select(guest,'[data-shop-item]','2');await click(guest,'[data-shop-buy]');
  await waitUntil(guest,`document.querySelector('[data-shop-status]').value.includes('余额不足')`);
  evidence.shortage=await evaluate(guest,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent})`);
  assert.deepEqual(store.inventory(accounts[1].accountId).records,[]);
  assert.deepEqual(balances(accounts[1].accountId),{money:0,tokens:0});
  await click(guest,'[data-shop-close]');
  await click(host,'#open-shop');
  await waitUntil(host,`document.querySelector('[data-shop-product]')?.textContent.includes('每份10金币 / 10软星币') && !document.querySelector('[data-shop-buy]').disabled`);
  evidence.shopCatalog=[];
  const options=await evaluate(host,`Array.from(document.querySelector('[data-shop-item]').options).map(row=>({value:Number(row.value),name:row.textContent}))`);
  assert.deepEqual(options.map(row=>row.value).filter(id=>shopIds.includes(id)),shopIds);
  assert.equal(new Set(options.map(row=>row.value)).size,options.length);
  for(const id of shopIds){
    const definition=catalog.items.find(row=>row.itemTableId===id);
    assert.equal(options.find(row=>row.value===id).name,definition.name);
    await select(host,'[data-shop-item]',String(id));
    const product=await evaluate(host,`(async()=>{const root=document.querySelector('[data-shop-product]');const icon=root.querySelector('[data-source-asset]');const image=new Image();image.src='/'+icon.dataset.sourceAsset;await image.decode();return {id:Number(document.querySelector('[data-shop-item]').value),text:root.textContent,asset:icon.dataset.sourceAsset,background:icon.style.backgroundImage,width:image.naturalWidth,height:image.naturalHeight};})()`);
    assert.equal(product.id,id);assert(product.text.includes(definition.name));assert(product.text.includes(definition.info));
    assert(product.text.includes('每份'+definition.moneyPrice+'金币 / '+definition.tokenPrice+'软星币'));
    const sourceImage=itemImageSet.images.find(image=>image.Name===`data\\ui\\daoju\\${String(definition.iconId).padStart(5,'0')}.tga`);
    assert.equal(product.asset,sourceImage.asset);
    assert.equal(product.width,Number(sourceImage.Width));assert.equal(product.height,Number(sourceImage.Height));
    assert(product.background.includes(product.asset));
    evidence.shopCatalog.push({...definition,display:product});
  }
  assert.equal(evidence.shopCatalog.at(-1).moneyPrice,40);assert.equal(evidence.shopCatalog.at(-1).tokenPrice,20);
  evidence.shopLayouts=[];
  for(const [width,height] of [[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},host);
    await evaluate(host,`new Promise(requestAnimationFrame)`);
    const rect=await evaluate(host,`(()=>{const r=document.querySelector('#account-shop').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewport:[innerWidth,innerHeight]}})()`);
    assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=height);evidence.shopLayouts.push(rect);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},host);
  await evaluate(host,`(async()=>{const {AccountConnection}=await import('/src/network/accounts.ts');window.shopCalls=[];const original=AccountConnection.prototype.shop;AccountConnection.prototype.shop=async function(req){window.shopCalls.push({...req});window.shopTransport=this.client;if(!window.shopDropInstalled){window.shopDropInstalled=true;this.client.flows.preRecvDataFlow.push(input=>window.dropShopResponse?undefined:input);}return original.call(this,req);};})()`);
  await select(host,'[data-shop-item]','2');await quantity(host,3);
  server.kill('SIGSTOP');await click(host,'[data-shop-buy]');await click(host,'[data-shop-buy]');
  assert.equal(await evaluate(host,`window.shopCalls.filter(r=>r.operation==='BUY').length`),1);
  assert.deepEqual(balances(owner.accountId),{money:100,tokens:40});
  assert(await evaluate(host,`document.querySelector('[data-shop-balance]').textContent.includes('金币：100')`));
  server.kill('SIGCONT');
  evidence.pending={requests:1,optimisticWallet:false};
  await waitUntil(host,`document.querySelector('[data-shop-status]').value.includes('×3') && document.querySelector('#account-shop').dataset.purchasedInstance`);
  const instanceId=Number(await evaluate(host,`document.querySelector('#account-shop').dataset.purchasedInstance`));
  assert.equal(store.inventory(owner.accountId).records.find(row=>row.instanceId===instanceId).ownedQuantity,3);
  assert.equal(store.inventory(owner.accountId).hotkeys[3],0);
  assert.deepEqual(balances(owner.accountId),{money:40,tokens:40});
  evidence.moneyPurchase=await evaluate(host,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instanceId:document.querySelector('#account-shop').dataset.purchasedInstance})`);
  await quantity(host,1);await select(host,'[data-shop-currency]','TOKENS');
  await evaluate(host,`window.dropShopResponse=true`);await click(host,'[data-shop-buy]');
  {const deadline=Date.now()+10000;let count=0;while(count<2&&Date.now()<deadline){try{count=store.inventory(owner.accountId).records.length;}catch(error){if(error.errcode!==5)throw error;}if(count<2)await new Promise(r=>setTimeout(r,20));}assert.equal(count,2);}
  await evaluate(host,`window.dropShopResponse=false;window.shopTransport.disconnect()`);
  await waitUntil(host,`!document.querySelector('[data-shop-buy]').disabled`);
  assert.deepEqual(balances(owner.accountId),{money:40,tokens:20});
  await click(host,'[data-shop-close]');await click(host,'#open-shop');
  await waitUntil(host,`document.querySelector('[data-shop-item]')&&!document.querySelector('[data-shop-buy]').disabled`);
  await select(host,'[data-shop-item]','2');await select(host,'[data-shop-currency]','TOKENS');await quantity(host,1);await click(host,'[data-shop-buy]');
  const buyCalls=await evaluate(host,`window.shopCalls.filter(r=>r.operation==='BUY')`);
  assert.equal(buyCalls[1].requestId,buyCalls[2].requestId);evidence.unconfirmedRetry={calls:buyCalls.slice(1),singleDeduction:true};
  await waitUntil(host,`document.querySelector('[data-shop-status]').value.includes('×1') && document.querySelector('#account-shop').dataset.purchasedInstance!==${JSON.stringify(String(instanceId))}`);
  const tokenInstanceId=Number(await evaluate(host,`document.querySelector('#account-shop').dataset.purchasedInstance`));
  assert.deepEqual(balances(owner.accountId),{money:40,tokens:20});
  assert.deepEqual(store.inventory(owner.accountId).records.map(row=>row.ownedQuantity),[3,1]);
  assert.deepEqual(store.inventory(accounts[1].accountId).records,[]);
  evidence.tokenPurchase=await evaluate(host,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instanceId:document.querySelector('#account-shop').dataset.purchasedInstance})`);
  await click(host,'[data-shop-close]');
  console.log('Confirmed MONEY/TOKENS purchases and guest shortage refusal');
  await click(host,'#open-home');
  await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);
  await click(host,'[data-source-control="rdoItem"]');
  await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')`);
  await click(host,`[data-inventory-instance="${instanceId}"]`);await click(host,'[data-kitbag-slot="4"]');
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId===${JSON.stringify(String(instanceId))}`);
  await click(host,'[data-home-close]');await click(host,'#create-room-controls > summary');await select(host,'#room-mode','4');await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);await select(host,'#room-map','7');await click(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=(await state(host)).roomId;
  for(let index=0;index<3;index++){
    await waitUntil(host,`document.querySelector('[data-add-cpu]') && !document.querySelector('[data-add-cpu]').disabled`);
    await click(host,'[data-add-cpu]');
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${index+2}`);
  }
  await click(guest,'#refresh-rooms');
  await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)}) && !document.querySelector('#join').disabled`);
  await select(guest,'#room',roomId);await click(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.players.length===5&&s.renderedPlayers===5})()`);



  for(const session of [guest,host]) {
    const point=await evaluate(session,`(()=>{const r=document.querySelector('[data-ready]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1},session);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1},session);
  }
  console.log('Natural combat started');
  async function naturalVisibleInjury() {
    await evaluate(guest,`document.activeElement?.blur()`);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65},guest);
    const deadline=Date.now()+180000;
    try {
      while(Date.now()<deadline){
        const world=await state(host),player=world.players.find(row=>row.id===world.playerId);
        const visible=await evaluate(guest,`(()=>{const world=JSON.parse(document.querySelector('#battle-status').dataset.world);const observer=world.players.find(row=>row.id===world.playerId);const view=window.healingBattle.players.get(${JSON.stringify((await state(host)).playerId)});return observer.alive&&view&&!window.healingBattle.effects.clipped(view.root.position)})()`);
        if(world.phase==='PLAYING'&&player.alive&&player.hp<player.maxHp)return world;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw new Error('Natural injury in the guest camera did not occur');
    }finally {
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65},guest);
    }
  }
  const injured=await naturalVisibleInjury();
  assert(injured,'Natural CPU combat must injure the host');evidence.injured=injured;
  {
  await evaluate(host,`document.activeElement?.blur()`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  }
  for(const page of pages)await waitUntil(page.sessionId,`window.healingObserved.events.length===1`);
  await waitUntil(host,`window.healingObserved.sounds.some(row=>row.played)`);
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.healingObserved`)));
  assert.deepEqual(evidence.observed[0].events,evidence.observed[1].events);
  assertHealingEvent(evidence.observed[0].events[0]);
  for(const result of evidence.observed.slice(0,1)){
    assert(result.effects.some(row=>row.id===sourceEffect.effectId&&row.handle>0&&row.drawCount>0),'Original attached Source effect must create actual draw nodes');
    assert(result.effects.some(row=>row.actualTag==='tag_efcenter'&&row.parent&&row.parentReferenceMatches),'Source effect must use the live original Tag0 matrix in the purchasing page');
    assert(result.sounds.some(row=>row.reference===sourceEffect.sound&&row.handle>0&&row.context==='running'&&row.loop===false&&row.played),'Original catalog sound must start in the purchasing page audio context');
  }
  assert.equal(store.inventory(owner.accountId).records.find(row=>row.instanceId===instanceId).ownedQuantity,startingQuantity-1);
  for(const [index,page] of pages.entries()){
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile(`${evidencePath.slice(0,-5)}-battle-${index+1}.png`,Buffer.from(shot.data,'base64'));
  }
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const r=window.healingRuntime;const handles=window.healingObserved.effects.map(e=>e.handle);return r&&!r.instances.some(i=>handles.includes(i.handle))&&r.skillSound.voices.size===0})()`);
  evidence.naturalExpiry=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({healingActive:window.healingRuntime.instances.some(i=>window.healingObserved.effects.some(e=>e.handle===i.handle)),voices:window.healingRuntime.skillSound.voices.size,soundEnded:window.healingObserved.sounds.every(row=>row.ended)})`)));
  assert(evidence.naturalExpiry.every(row=>row.soundEnded));
  async function naturalRound(round) {
    const start=Date.now();let lastLog=0,matched=0,nativeAngles=false;
    while(Date.now()-start<330000){
      const pair=await Promise.all(pages.map(page=>state(page.sessionId)));
      nativeAngles ||= pair.every(world=>world.players.some(player=>player.bodyYaw!==undefined));
      if(pair[0].tick===pair[1].tick){
        assert.deepEqual(pair[0].players,pair[1].players);matched++;
      }
      if(pair.every(value=>value.phase==='FINISHED')){
        assert.deepEqual(pair[0].match.result,pair[1].match.result);
        assert(pair[0].match.result.players.some(player=>player.kills>0));
        console.log(JSON.stringify({round,naturalEnd:true,elapsedMs:Date.now()-start,matched}));
        if(originalMovement)assert(nativeAngles,'Both webpages must receive restored original movement body angles');
        return {pair,elapsedMs:Date.now()-start,matched,nativeAngles};
      }
      if(Date.now()-lastLog>10000){lastLog=Date.now();console.log(JSON.stringify({round,remaining:pair[0].remaining,kills:pair[0].players.map(player=>player.kills)}));}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    throw new Error('Natural round did not settle');
  }
  evidence.firstRound=await naturalRound(1);
  for(const page of pages)await waitUntil(page.sessionId,`document.querySelectorAll('[data-result-player]').length===5`);
  await new Promise(resolve=>setTimeout(resolve,1000));
  const frozen=await Promise.all(pages.map(page=>state(page.sessionId)));
  assert.deepEqual(frozen.map(value=>value.match.result),evidence.firstRound.pair.map(value=>value.match.result));
  evidence.reusedTwoRoundEvidence='recovery/docs/react-match-browser.md';
  for(const page of pages){
    await click(page.sessionId,'#leave');
  }
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.rendering=await Promise.all(pages.map(page=>evaluate(page.sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const engine=EngineStore.LastCreatedEngine;
    const frames=window.healingFrameTimes.filter(value=>value>0).sort((a,b)=>a-b);
    const percentile=p=>frames[Math.min(frames.length-1,Math.floor(frames.length*p))];
    return {viewport:[innerWidth,innerHeight],canvas:[engine.getRenderWidth(),engine.getRenderHeight()],
      cameraStage:"after-exit",camera:{radius:window.healingCamera.radius,alpha:window.healingCamera.alpha,beta:window.healingCamera.beta},
      scaling:engine.getHardwareScalingLevel(),renderer:engine.getGlInfo(),frameCount:frames.length,
      frameMs:{p50:percentile(0.5),p95:percentile(0.95),p99:percentile(0.99),max:frames.at(-1)}};
  })()`)));
  if(hd)for(const row of evidence.rendering){assert.deepEqual(row.viewport,[1920,1080]);assert.deepEqual(row.canvas,[1920,1080]);assert.equal(row.scaling,1);assert(row.frameCount>0);}
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({instances:window.healingRuntime.instances.length,voices:window.healingRuntime.skillSound.voices.size})`)));
  for(const cleanup of evidence.cleanup)assert.deepEqual(cleanup,{instances:0,voices:0});
  await stop();await start();
  await evaluate(host,`window.healingReloadPending=true`);
  await command('Page.reload',{},host);
  await waitUntil(host,`!window.healingReloadPending && document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled && document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
  assert.equal(await evaluate(host,`localStorage.getItem('cdtank-account-token')`),token);
  await click(host,'#open-home');
  await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);
  await click(host,'[data-source-control="rdoItem"]');
  await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.textContent.includes('×2')`);
  assert.equal(await evaluate(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId`),String(instanceId));
  evidence.restartInventory=await evaluate(host,`({text:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  assert.deepEqual(balances(owner.accountId),{money:40,tokens:20});
  assert.equal(store.inventory(owner.accountId).records.find(row=>row.instanceId===tokenInstanceId).ownedQuantity,1);
  assert.deepEqual(store.inventory(accounts[1].accountId).records,[]);
  evidence.restartBalances=balances(owner.accountId);
  await click(host,'[data-home-close]');await click(host,'#open-shop');
  await waitUntil(host,`document.querySelector('[data-shop-balance]').textContent.includes('金币：40 · 软星币：20')`);
  evidence.restartShop=await evaluate(host,`document.querySelector('[data-shop-balance]').textContent`);
  const shopShot=await command('Page.captureScreenshot',{format:'png'},host);
  await writeFile(`${evidencePath.slice(0,-5)}-shop-restart.png`,Buffer.from(shopShot.data,'base64'));
  evidence.shopIcon=await evaluate(host,`(async()=>{const icon=document.querySelector('[data-shop-product] [data-source-asset]');const image=new Image();image.src='/'+icon.dataset.sourceAsset;await image.decode();return {asset:icon.dataset.sourceAsset,background:icon.style.backgroundImage,width:image.naturalWidth,height:image.naturalHeight}})()`);
  assert(evidence.shopIcon.asset&&evidence.shopIcon.width>0&&evidence.shopIcon.height>0);
  evidence.scope='Six selectable source consumables with ready icons and original metadata; item2 MONEY60 and TOKENS20 purchases; Two 1920x1080 webpages; empty starting inventories and explicit original owned role/profile balances; normal MONEY and TOKENS purchases, insufficient-balance refusal and account isolation; Home slot4 assignment after confirmed purchase; ordinary Digit5 self-healing after natural CPU injury in one naturally completed round; Local Effect11 live Tag0 attachment, GA15 playback and cleanup; dual event synchronization; prior E-R01 covers remote drawing/audio; purchased quantity, shortcut and balances retained after server restart. Rebuilt purchase allocation and server authority.';
  await stop();
  const history=spawn(process.execPath,['--import','tsx','tests/browser-account-history.mjs'],{env:{...process.env,CDTANK_HISTORY_DB:database,CDTANK_HISTORY_TOKEN:token,CDTANK_HISTORY_EXPECTED_COUNT:'1',CDTANK_HISTORY_OUTPUT:(process.env.CDTANK_ACCOUNT_OUTPUT ?? 'recovery/output/browser-react-account')+'-history'},stdio:['ignore','pipe','pipe']});
  for(const stream of [history.stdout,history.stderr])stream.on('data',data=>process.stdout.write(data));
  assert.equal(await new Promise(resolve=>history.once('exit',resolve)),0,'React history acceptance');
  evidence.history=(process.env.CDTANK_ACCOUNT_OUTPUT ?? 'recovery/output/browser-react-account')+'-history.json';
  evidence.status='PASS';
  await writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS: confirmed purchases, one natural bought-item Digit5 round, Effect11/GA15 and quantity/balance restart retention');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  evidence.states=await Promise.all(pages.map(page=>state(page.sessionId).catch(()=>null)));
  evidence.failureObserved=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.healingObserved`).catch(()=>null)));
  await writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n');throw error;
}
}finally{
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  for(const context of contexts)await command('Target.disposeBrowserContext',{browserContextId:context}).catch(()=>{});
  store?.close();if(server?.exitCode===null)server.kill('SIGCONT');ws?.close();await vite?.close();
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  if(directory)await rm(directory,{recursive:true,force:true});
  if(chrome?.exitCode===null){const ended=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill();await ended;}
  if(chromeDirectory)await rm(chromeDirectory,{recursive:true,force:true});
}
