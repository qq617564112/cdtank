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
if (!endpoint) throw new Error('Usage: node --import tsx tests/browser-home-roles.mjs <CDP WebSocket>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-home-'));
const database = join(directory, 'accounts.sqlite');
let server;
let serverLog='';
const outputPrefix=process.env.CDTANK_ROLES_OUTPUT ?? 'recovery/output/browser-home-roles';
async function start() {
  let log='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:{...process.env,PORT:'3133',ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
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
  server:{port:5192,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3133',ws:true,rewrite:()=> '/'}}}});
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


const contexts=[], pages=[];
const evidence={status:'PASS',scope:'React owned tank/pet selection with native ownership/profile fixtures, authoritative confirmations, source layouts, pending isolation and Babylon lifecycle. E-R01 rounds and dual-page item effects reused.',sizes:[]};
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5192',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
  }
  const session=pages[0].sessionId,guest=pages[1].sessionId;
  const store=new AccountStore(database);
  try {
    const owner=store.open(await evaluate(session,`localStorage.getItem('cdtank-account-token')`));
    const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
    const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '原角色');
    const base={name:'测试宠物',fields:new Map(pair.base.fields)},tank={name:'测试战车',fields:new Map(pair.equipment.fields)};
    base.fields.set(0,71);base.fields.set(8,1);tank.fields.set(0x1c,72);tank.fields.set(0x24,2);tank.fields.set(0x28,20011);tank.fields.set(0x2c,20012);tank.fields.set(0x30,20013);
    store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank]});
    const profile={bytes:new Uint8Array(0x170),strings:['角色名','资料']};
    store.replaceRoleProfile(owner.accountId,profile);
    evidence.fixture={nativeOwned:'recovery/output/role-owned-pair-native.json rows[0]',tankInstance:72,petInstance:71,tankId:2,tankTextures:{U:20011,M:20012,XY:20013},profileBytes:0x170,tankProfileOffset:0xa8,petProfileOffset:0xa4,profileOrigin:'explicit imported fixture; normal account starts without ownership'};
    await click(session,'#open-roles');
    await waitUntil(session,`document.querySelector('[data-owned-role="72"]')`);
    await click(session,'[data-owned-role="72"]');
    const preview='[data-role-preview]';
    const ready=id=>`document.querySelector('${preview}')?.dataset.status==='ready' && document.querySelector('${preview}').dataset.tankId==='${id}' && document.querySelector('${preview}').dataset.renderedTankId==='${id}' && Number(document.querySelector('${preview}').dataset.meshes)>0 && Number(document.querySelector('${preview}').dataset.frames)>1`;
    await waitUntil(session,ready(2));
    await witness(session,preview,'rolesWitness');
    const use='.home-role-use';
    assert(!(await evaluate(session,`document.querySelector('${use}').disabled`)));
    await click(session,use);
    await waitUntil(session,`document.querySelector('${use}')?.dataset.selectedInstance==='72' && document.querySelector('#home-roles .home-role-status').value==='角色选择已保存'`);
    await waitUntil(session,ready(2));
    await stable(session,preview,'rolesWitness');
    const tankViews=[];
    for(const [width,height] of [[1920,1080],[3840,2160]]){
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
      await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const state=await evaluate(session,`(()=>{const e=document.querySelector('${preview}'),r=e.getBoundingClientRect(),c=e.querySelector('canvas');return {width:r.width,height:r.height,pixels:[c.width,c.height],control:e.dataset.sourceControl,instance:e.dataset.instanceId,tank:e.dataset.tankId,meshes:Number(e.dataset.meshes)}})()`);
      assert.equal(state.control,'picModel');
      assert.deepEqual(await evaluate(session,`JSON.parse(document.querySelector('${preview}').dataset.tankTextures)`),{U:20011,M:20012,XY:20013});assert.equal(state.instance,'72');assert.equal(state.tank,'2');
      assert(Math.abs(state.width-218*Math.min(width/800,height/600))<1);
      assert(Math.abs(state.height-218*Math.min(width/800,height/600))<1);
      assert(Math.abs(state.pixels[0]-state.width)<=1);assert(Math.abs(state.pixels[1]-state.height)<=1);
      const capture=await command('Page.captureScreenshot',{format:'png'},session);
      await writeFile(`${outputPrefix}-tank-preview-${width}.png`,Buffer.from(capture.data,'base64'));
      const source=await sourceLayout(session,'#home-roles',width,height);
      tankViews.push({viewport:{width,height},...state,source});
    }
    assert.equal(new DataView(store.roleProfile(owner.accountId).bytes.buffer).getUint32(0xa8,true),72);
    await click(session,'[data-role-tab="pet"]');await click(session,'[data-owned-role="71"]');
    assert(!(await evaluate(session,`document.querySelector('${use}').disabled`)), await evaluate(session,`document.querySelector('#home-roles').innerText`));
    for(let attempt=0;attempt<30 && await evaluate(session,`document.activeElement.className!=='home-role-use'`);attempt++)await key(session,'Tab','Tab',9);
    assert.equal(await evaluate(session,`document.activeElement.className`),'home-role-use');
    for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})},session);
    await waitUntil(session,`document.querySelector('${use}')?.dataset.selectedInstance==='71'`);
    assert.equal(new DataView(store.roleProfile(owner.accountId).bytes.buffer).getUint32(0xa4,true),71);
    for(const [width,height] of [[1920,1080],[3840,2160]]){
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
      await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const state=await evaluate(session,`(()=>{const d=document.querySelector('#home-roles').getBoundingClientRect(),b=document.querySelector('${use}').getBoundingClientRect();return {dialog:{x:d.x,y:d.y,w:d.width,h:d.height},button:{w:b.width,h:b.height},asset:document.querySelector('${use}').dataset.sourceAsset}})()`);
      assert(state.dialog.x>=0&&state.dialog.y>=0&&state.dialog.x+state.dialog.w<=width&&state.dialog.y+state.dialog.h<=height);
      assert(Math.abs(state.button.w-230*Math.min(width/800,height/600))<.2);assert(state.asset);
      assert(await evaluate(session,`fetch('/'+${JSON.stringify(state.asset)}).then(r=>r.ok)`));
      const screenshot=await command('Page.captureScreenshot',{format:'png'},session);
      await writeFile(`${outputPrefix}-${width}.png`,Buffer.from(screenshot.data,'base64'));evidence.sizes.push({width,height,...state,source:await sourceLayout(session,'#home-roles',width,height)});
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
    await click(guest,'#open-roles');
    await waitUntil(guest,`document.querySelector('#home-roles .home-role-status').value==='暂无拥有角色'`);
    assert(await evaluate(guest,`document.querySelector('${use}').disabled`));
    const origin1=await evaluate(session,`performance.timeOrigin`);
    await command('Page.reload',{},session);
    await waitUntil(session,`performance.timeOrigin!==${origin1} && localStorage.getItem('cdtank-account-token') && document.querySelector('#tank')?.options.length===21`);
    await click(session,'#open-roles');
    await waitUntil(session,`document.querySelector('${use}')?.dataset.selectedInstance==='72'`);
    await waitUntil(session,ready(2));
    await click(session,'[data-role-tab="pet"]');
    assert.equal(await evaluate(session,`document.querySelector('${use}')?.dataset.selectedInstance`),'71');
    await stop();await start();
    const origin2=await evaluate(session,`performance.timeOrigin`);
    await command('Page.reload',{},session);
    await waitUntil(session,`performance.timeOrigin!==${origin2} && document.querySelector('#tank')?.options.length===21`);
    await click(session,'#open-roles');await waitUntil(session,`document.querySelector('${use}')?.dataset.selectedInstance==='72'`);
    await waitUntil(session,ready(2));
    // Stale displayed ownership must receive rejection and retain confirmed profile.
    const additional={name:'待选择战车',fields:new Map(tank.fields)};additional.fields.set(0x1c,73);additional.fields.set(0x24,105);additional.fields.set(0x28,1050011);additional.fields.set(0x2c,1050012);additional.fields.set(0x30,1050013);
    store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank,additional]});
    await click(session,'[data-roles-close]');await click(session,'#open-roles');await waitUntil(session,`document.querySelector('[data-owned-role="73"]')`);
    await click(session,'[data-owned-role="73"]');await waitUntil(session,ready(105));
    store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank]});
    await click(session,use);await waitUntil(session,`document.querySelector('#home-roles .home-role-status').value.includes('不属于')`);
    assert.equal(await evaluate(session,`document.querySelector('${use}')?.dataset.selectedInstance`),'72');
    await waitUntil(session,ready(2));
    await witness(session,preview,'rolesCloseWitness');
    await click(session,'[data-roles-close]');
    await waitUntil(session,`!document.querySelector('#home-roles[open]')`);
    await disposed(session,'rolesCloseWitness');
    const sourceTanks=JSON.parse(await readFile('recovery/output/web-assets/tanks.json','utf8'));
    const sourceTextures=JSON.parse(await readFile('recovery/output/web-assets/tank-textures.json','utf8')).rows;
    const allTanks=sourceTanks.map(entry=>{const record={name:entry.name,fields:new Map(tank.fields)};
      record.fields.set(0x1c,200+entry.id);record.fields.set(0x24,entry.id);
      for(const [part,offset] of [['U',0x28],['M',0x2c],['XY',0x30]]){
        const selected=sourceTextures.find(row=>row.tankId===entry.id&&row.part===part&&row.selectable&&row.textures.A.asset);
        record.fields.set(offset,selected?.recordId??0);
      }
      return record;});
    store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank,...allTanks]});
    await click(session,'#open-roles');await waitUntil(session,`document.querySelector('[data-owned-role="${200+sourceTanks.at(-1).id}"]')`);
    const rendered=[];
    for(const entry of sourceTanks){
      const selector=`[data-owned-role="${200+entry.id}"]`;
      await evaluate(session,`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
      await click(session,selector);await waitUntil(session,ready(entry.id));
      rendered.push({id:entry.id,meshes:await evaluate(session,`Number(document.querySelector('${preview}').dataset.meshes)`)});
    }
    assert.equal(rendered.length,21);
    await witness(session,preview,'rolesFinalWitness');
    await key(session,'Escape','Escape',27);
    await waitUntil(session,`!document.querySelector('#home-roles[open]') && document.activeElement?.id==='open-roles'`);
    await disposed(session,'rolesFinalWitness');
    // A suspended real service keeps one selection pending while the dialog closes/reopens.
    await click(session,'#open-roles');await waitUntil(session,`document.querySelector('[data-owned-role="202"]')`);
    await click(session,'[data-owned-role="202"]');await waitUntil(session,ready(2));
    await witness(session,preview,'rolesPendingWitness');
    server.kill('SIGSTOP');
    try {
      const before=sentFrames.filter(frame=>frame.session===session).length;
      await click(session,use);await waitUntil(session,`document.querySelector('#home-roles .home-role-status').value==='保存角色选择…'`);
      await click(session,use);
      assert.equal(sentFrames.filter(frame=>frame.session===session).length-before,1,'Pending role save sends one request');
      assert.equal(await evaluate(session,`document.querySelector('${use}').dataset.selectedInstance`),'72');
      await key(session,'Escape','Escape',27);await waitUntil(session,`!document.querySelector('#home-roles[open]')`);
      await disposed(session,'rolesPendingWitness');
      await click(session,'#open-roles');await waitUntil(session,`document.querySelector('#home-roles .home-role-status').value==='载入战车与宠物…'`);
      server.kill('SIGCONT');
      await waitUntil(session,`document.querySelector('${use}')?.dataset.selectedInstance==='202'`);
      assert.notEqual(await evaluate(session,`document.querySelector('#home-roles .home-role-status').value`),'角色选择已保存','Old save must not overwrite reopening status');
      await click(session,'[data-owned-role="72"]');await click(session,use);
      await waitUntil(session,`document.querySelector('${use}')?.dataset.selectedInstance==='72'`);
    } finally {server.kill('SIGCONT');}
    await click(session,'[data-roles-close]');
    evidence.pendingSingleRequest=true;evidence.closedRequestIsolation=true;evidence.previewIdentityStable=true;evidence.escapeFocus=true;
    evidence.preview={tankViews,rendered,refresh:true,restart:true,rejectionRetains:true,closeDisposes:true};
    evidence.mouseSelection=true;evidence.keyboardSelection=true;evidence.accountIsolation=true;evidence.refreshRestores=true;evidence.restartRestores=true;evidence.rejectionRetains=true;
    await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
    console.log('PASS: normal owned tank/pet selection, keyboard/mouse, source controls, 1080p/4K, isolation, refresh/restart and rejection');
  }finally{store.close();}
} catch(error) {
  evidence.status='FAIL';evidence.error=String(error);evidence.lastCondition=lastCondition;
  evidence.diagnostics=await Promise.all(pages.map(async page=>({targetId:page.targetId,state:await evaluate(page.sessionId,`({roles:document.querySelector('#home-roles')?.outerHTML,textures:document.querySelector('#home-tank-texture-selection')?.outerHTML,hud:document.querySelector('#battle-status')?.value,world:document.querySelector('#battle-status')?.dataset.world,focus:document.activeElement?.outerHTML})`).catch(error=>({error:String(error)}))})));
  throw error;
} finally {
  await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
  for(const {targetId} of pages)await command('Target.closeTarget',{targetId}).catch(()=>{});
  for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});
  ws.close();await vite.close();server?.kill('SIGCONT');await stop();await writeFile(`${outputPrefix}-server.log`,serverLog);await rm(directory,{recursive:true,force:true});
}
