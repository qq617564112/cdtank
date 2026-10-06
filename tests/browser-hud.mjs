import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-hud.mjs <Chromium CDP WebSocket URL>');
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
let sequence = 0;
const pending = new Map();
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
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
async function waitUntil(session, expression) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages=[];
try {
 const {targetId}=await command('Target.createTarget',{url:origin,newWindow:true});
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId});
 await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21`);
 await evaluate(sessionId,`(async()=>{
  const {BattleHud}=await import('/src/interface/battle/battle-hud.ts');
  const {BattleHudView}=await import('/src/interface/battle/battle-hud-view.tsx');
  const {default:React}=await import('/node_modules/.vite/deps/react.js');
  const {createElement}=React;
  const {default:ReactDOMClient}=await import('/node_modules/.vite/deps/react-dom_client.js');
  const {createRoot}=ReactDOMClient;
  const host=document.createElement('div');host.dataset.hudFixture='';document.body.append(host);
  const fixtureRoot=createRoot(host);
  window.testHud=new BattleHud();
  // Explicit state fixture owns a separate React root, never the App HUD store.
  for(const name of ['update','event','clear']) {
   const method=window.testHud[name].bind(window.testHud);
   window.testHud[name]=async(...args)=>{method(...args);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
  }
  Object.defineProperty(window.testHud,'root',{get:()=>host.querySelector('#original-battle-hud')});
  Object.defineProperty(window.testHud,'timerFilterId',{get:()=>host.querySelector('filter')?.id});
  window.disposeHudFixture=async()=>{await window.testHud.clear();fixtureRoot.unmount();host.remove();};
  await window.testHud.load();fixtureRoot.render(createElement(BattleHudView,{hud:window.testHud}));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await window.testHud.update({remaining:125,players:[{id:'fixture',tankId:1,petId:1,name:'小勇士',team:0,alive:true,hp:150,maxHp:300},{id:'remote',tankId:2,petId:2,name:'对手',team:1,alive:true,hp:75,maxHp:300}]},'fixture');
  await window.testHud.event({type:'hit',message:'小勇士命中对手'});
  document.querySelector('.controls').hidden=true;
 })()`);
 const results=[];
 for(const [width,height,dpr] of [[1920,1080,1],[2560,1440,1],[3840,2160,1],[1920,1080,2]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false},sessionId);
  const result=await evaluate(sessionId,`(async()=>{
   window.dispatchEvent(new Event('resize'));
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const root=window.testHud.root;
   const life=root.querySelector('[data-source-control="prgLife"]');
   const time=root.querySelector('[data-source-control="txtRemainTime"]');
   await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode()));
   const r=life.getBoundingClientRect();
   return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,rect:[r.x,r.y,r.width,r.height],hp:life.getAttribute('aria-valuenow'),colour:life.dataset.sourceProgressColour,extent:Number(life.dataset.sourceProgressExtent),clip:life.querySelector('.source-progress-fill').style.clipPath,time:time.getAttribute('aria-label'),glyphs:time.querySelectorAll('img').length,message:root.querySelector('[data-source-control="edtBattleInfo"]').textContent,roster:[...root.querySelectorAll('[data-player-id]')].map(panel=>{const rect=panel.getBoundingClientRect(),bar=panel.querySelector('[role="progressbar"]');return {id:panel.dataset.playerId,slot:panel.dataset.sourceControl,name:panel.querySelector('[data-source-control^="txtPlayerName"]').textContent,iconRect:(()=>{const r=panel.querySelector('[data-source-control^="picPlayerIcon"][data-tank-id]').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})(),hp:bar.getAttribute('aria-valuenow'),extent:Number(bar.dataset.sourceProgressExtent),clip:bar.querySelector('.source-progress-fill').style.clipPath,rect:[rect.x,rect.y,rect.width,rect.height]};})};
  })()`);
  const scale=Math.min(width/800,height/600),offset=(width-800*scale)/2;
  const expected=[offset+311*scale,563*scale,179*scale,28*scale];
  assert(result.rect.every((v,i)=>Math.abs(v-expected[i])<0.01));
  assert.equal(result.hp,'150');
  assert.equal(result.extent,Math.floor(179*scale*.5+.5));
  assert.ok(Math.abs(Number(/inset\(0px ([\d.]+)px/.exec(result.clip)[1])-(179-result.extent/scale))<.0001);
  assert.equal(result.colour,'FFFFFF00');
  assert.equal(result.time,'2:05');assert.equal(result.glyphs,4);assert.equal(result.message,'小勇士命中对手');
  assert.deepEqual(result.roster.map(p=>[p.id,p.slot,p.name,p.hp]),[['fixture','picPlayer0','小勇士','150'],['remote','picPlayer6','对手','75']]);
  for(const [index,fraction] of [[0,.5],[1,.25]]){
   const extent=Math.floor(33*scale*fraction+.5);
   assert.equal(result.roster[index].extent,extent);
   assert.ok(Math.abs(Number(/inset\(([\d.]+)px/.exec(result.roster[index].clip)[1])-(33-extent/scale))<.0001);
  }
  for(const [index,x] of [[0,0],[1,634]]){
   const expected=[offset+x*scale,110*scale,166*scale,53*scale];
   assert(result.roster[index].rect.every((v,i)=>Math.abs(v-expected[i])<0.01));
  }
  for(const [index,rect] of [[0,[0,81,102,85]],[1,[735,110,65,53]]]){
   const expected=[offset+rect[0]*scale,rect[1]*scale,rect[2]*scale,rect[3]*scale];
   assert(result.roster[index].iconRect.every((v,i)=>Math.abs(v-expected[i])<0.01));
  }
  results.push(result);
  if(width===1920 && dpr===1){const shot=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile('recovery/output/browser-hud.png',Buffer.from(shot.data,'base64'));}
 }
 const modes=[];
 for(const [width,height,dpr] of [[1920,1080,1],[2560,1440,1],[3840,2160,1],[1920,1080,2]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false},sessionId);
  const evidence=await evaluate(sessionId,`(async()=>{
   window.dispatchEvent(new Event('resize'));
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const data=await(await fetch('/ui.json')).json();
   const root=window.testHud.root;const results=[];
   for(const [index,name] of ['team','conquer','vip','melee','destroy'].entries()){
    await window.testHud.update({mode:index+1,remaining:125,players:[]},'fixture');
    const sheets=[...root.children].filter(e=>e.dataset.sourceLayout?.includes('game_main_info_'));
    const active=sheets.filter(e=>!e.hidden);
    if(active.length!==1 || !active[0].dataset.sourceLayout.endsWith('_'+name+'.xml'))throw new Error('Mode layout mismatch '+name);
    const time=active[0].querySelector('[data-source-control="txtRemainTime"]');
    await Promise.all([...time.querySelectorAll('img')].map(img=>img.decode()));
    const source=data.layouts.find(l=>l.path===active[0].dataset.sourceLayout);
    const rects=['SheetWindow','txtRemainTime'].map(name=>source.windows.find(w=>w.name===name).properties.AbsoluteRect.match(/-?\\d+(?:\\.\\d+)?/g).map(Number));
    const scale=Math.min(innerWidth/800,innerHeight/600),offsetX=(innerWidth-800*scale)/2,offsetY=(innerHeight-600*scale)/2;
    const expected=[offsetX+(rects[0][0]+rects[1][0])*scale,offsetY+(rects[0][1]+rects[1][1])*scale,(rects[1][2]-rects[1][0])*scale,(rects[1][3]-rects[1][1])*scale];
    const r=time.getBoundingClientRect(),actual=[r.x,r.y,r.width,r.height];
    if(actual.some((v,i)=>Math.abs(v-expected[i])>.01) || time.getAttribute('aria-label')!=='2:05')throw new Error('Mode timer source rect/value '+name);
    const warning=[];
    for(const remaining of [31,30,29.99,29,28,1,0]){
     await window.testHud.update({mode:index+1,remaining,players:[]},'fixture');
     await Promise.all([...time.querySelectorAll('img')].map(img=>img.decode()));
     const red=Math.trunc(remaining)<30 && Math.trunc(remaining)%2===1;
     if(red ? !time.style.filter.startsWith('url(') : time.style.filter.includes('url('))throw new Error('Timer warning boundary '+name+' '+remaining);
     const label='0:'+String(Math.trunc(remaining)).padStart(2,'0');
     if(time.getAttribute('aria-label')!==label)throw new Error('Timer truncation '+remaining);
     if(red){
      const filter=root.querySelector('filter');
      if(filter.id!==window.testHud.timerFilterId || filter.getAttribute('color-interpolation-filters')!=='sRGB' || filter.firstElementChild.getAttribute('values')!=='1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0')throw new Error('Timer RGBA multiplier');
     }
     warning.push({remaining,time:time.getAttribute('aria-label'),filter:time.style.filter,colour:time.dataset.colour??'ffffffff'});
    }
    await window.testHud.update({mode:index+1,remaining:29,players:[]},'fixture');
    await window.testHud.update({mode:index+1,remaining:30,players:[]},'fixture');
    if(!time.style.filter.startsWith('url('))throw new Error('Original >=30 skip colour write');
    await window.testHud.clear();
    await window.testHud.update({mode:index+1,remaining:125,players:[]},'fixture');
    if(time.style.filter!=='none')throw new Error('Timer warning retained on reentry');
    results.push({mode:index+1,layout:source.path,rect:actual,time:time.getAttribute('aria-label'),warning});
   }
   await window.testHud.clear();
   await window.testHud.update({mode:1,remaining:125,players:[]},'fixture');
   if(root.dataset.mode!=='1')throw new Error('Mode reentry retained previous layout');
   return results;
  })()`);
  modes.push({width,height,dpr,results:evidence});
 }
 await evaluate(sessionId,`await window.testHud.update({remaining:0,players:[{id:'fixture',hp:0,maxHp:300}]},'fixture')`);
 const dead=await evaluate(sessionId,`(async()=>{const root=window.testHud.root;return root.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')})()`);assert.equal(dead,'0');
 const rosterChanges=await evaluate(sessionId,`(async()=>{
  const hud=window.testHud;
  const root=window.testHud.root;
  const players=Array.from({length:12},(_,i)=>({id:'p'+i,name:'战车'+i,team:i<6?0:1,alive:true,hp:300,maxHp:300}));
  await hud.update({remaining:60,players},'p4');
  const panels=()=>[...root.querySelectorAll('[data-player-id]')].filter(p=>!p.hidden);
  const full=panels().map(p=>p.dataset.playerId);
  if(full.join(',')!=='p4,p1,p2,p3,p0,p5,p6,p7,p8,p9,p10,p11')throw new Error('Source local slot swap/cat orientation');
  await hud.update({remaining:60,players},'p9');
  const dogOrder=panels().map(p=>p.dataset.playerId);
  if(dogOrder.join(',')!=='p9,p7,p8,p6,p10,p11,p0,p1,p2,p3,p4,p5')throw new Error('Source local slot swap/dog orientation');
  await hud.update({remaining:60,players},'p4');
  players[8].hp=0;players[8].alive=false;await hud.update({remaining:59,players},'p4');
  const dead=root.querySelector('[data-player-id="p8"]');
  if(dead.dataset.alive!=='false' || dead.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')!=='0')throw new Error('Remote death');
  players[8].hp=300;players[8].alive=true;await hud.update({remaining:58,players},'p4');
  if(dead.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')!=='300')throw new Error('Remote revival');
  await hud.update({remaining:57,players:players.filter(p=>p.id!=='p8')},'p4');
  if(panels().length!==11 || root.querySelector('[data-player-id="p8"]'))throw new Error('Departed player retained');
  players.forEach(p=>p.team=0);await hud.update({remaining:56,players},'p4');
  if(panels().length!==12)throw new Error('Single-team roster truncated');
  players.forEach(p=>p.team=p.id==='p4'?0:1);await hud.update({remaining:56,players},'p4');
  if(panels().length!==12 || new Set(panels().map(p=>p.dataset.playerId)).size!==12)throw new Error('Unequal teams truncated');
  await hud.update({remaining:55,players:[players[4]]},'p4');
  if(panels().length!==1)throw new Error('Vacant slots visible');
  return {full,dogOrder,remoteDeath:true,remoteRevival:true,departure:true,singleTeamCapacity:12,vacantSlotsHidden:true};
 })()`);
 const portraits=await evaluate(sessionId,`(async()=>{
  const data=await(await fetch('/ui.json')).json();
  const root=window.testHud.root;
  const results=[];
  for(const portrait of data.portraits){
   await window.testHud.update({remaining:50,players:[{id:'portrait-fixture',name:'战车'+portrait.petId,team:0,tankId:1,petId:portrait.petId,alive:true,hp:300,maxHp:300},{id:'remote-fixture',name:'远端',team:1,tankId:1,petId:portrait.petId,alive:true,hp:300,maxHp:300}]},'portrait-fixture');
   const icon=root.querySelector('[data-source-control="picPlayerIcon0"]');
   const background=icon.style.backgroundImage;
   if(portrait.asset){
    const image=new Image();image.src='/'+portrait.asset;await image.decode();
    if(icon.hidden || !background.includes(portrait.asset))throw new Error('Wrong portrait '+portrait.petId);
   }else if(!icon.hidden || background!=='none')throw new Error('Unresolved portrait substituted '+portrait.petId);
   const remote=root.querySelector('[data-source-control="picPlayerIcon6"]');
   const remoteBackground=remote.style.backgroundImage;
   if(portrait.remoteAsset){
    const image=new Image();image.src='/'+portrait.remoteAsset;await image.decode();
    if(remote.hidden || !remoteBackground.includes(portrait.remoteAsset))throw new Error('Wrong remote portrait '+portrait.petId);
    if(remoteBackground===background)throw new Error('Expressive portrait used for remote '+portrait.petId);
   }else if(!remote.hidden || remoteBackground!=='none')throw new Error('Unresolved remote portrait substituted '+portrait.petId);
   results.push({tankId:1,petId:portrait.petId,visible:!icon.hidden,background,remoteVisible:!remote.hidden,remoteBackground});
  }
  await window.testHud.update({remaining:49,players:[]},'portrait-fixture');
  if(root.querySelector('[data-source-control="picPlayerIcon0"]').style.backgroundImage!=='none')throw new Error('Departed portrait retained');
  if(root.querySelector('[data-source-control="picPlayerIcon6"]').style.backgroundImage!=='none')throw new Error('Departed remote portrait retained');
  return results;
 })()`);
 const portraitDirectory=await evaluate(sessionId,`(async()=>{const data=await(await fetch('/ui.json')).json();return data.portraits.map(p=>({petId:p.petId,local:!!p.asset,remote:!!p.remoteAsset}));})()`);
 assert.deepEqual(portraits.map(p=>p.petId),portraitDirectory.map(p=>p.petId),'Enumerate actual PetTable portrait directory');
 assert.deepEqual(portraits.filter(p=>p.visible).map(p=>p.petId),portraitDirectory.filter(p=>p.local).map(p=>p.petId));
 assert.deepEqual(portraits.filter(p=>p.remoteVisible).map(p=>p.petId),portraitDirectory.filter(p=>p.remote).map(p=>p.petId));
 const expressions=await evaluate(sessionId,`(async()=>{
  const hud=window.testHud;await hud.clear();
  const data=await(await fetch('/ui.json')).json();
  const portrait=data.portraits.find(p=>p.petId===1);
  const player={id:'expressive',name:'表情验证',team:0,tankId:1,petId:1,alive:true,hp:300,maxHp:300};
  const remote={...player,id:'remote',team:1};
  const snapshot={remaining:50,players:[player,remote]};
  const root=hud.root;
  const icon=()=>root.querySelector('[data-source-control="picPlayerIcon0"]');
  const check=(expression,asset)=>{
   if(icon().dataset.expression!==expression || !icon().style.backgroundImage.includes(asset))throw new Error('Wrong expression '+expression+' '+icon().dataset.expression);
  };
  await hud.update(snapshot,player.id,1000);check('normal',portrait.asset);
  await hud.event({type:'fire',playerId:player.id,skillId:2001});
  await hud.update(snapshot,player.id,1000);check('attack',portrait.expressions.attack);
  const attackImage=new Image();attackImage.src='/'+portrait.expressions.attack;await attackImage.decode();
  await hud.update(snapshot,player.id,1500);check('attack',portrait.expressions.attack);
  await hud.update(snapshot,player.id,1501);check('normal',portrait.asset);
  await hud.clear();await hud.update(snapshot,player.id,1000);
  const event={type:'hit',targetId:player.id,playerId:remote.id,message:'受击'};
  await hud.event(event);await hud.update(snapshot,player.id,1000);check('wound',portrait.expressions.wound);
  const woundImage=new Image();woundImage.src='/'+portrait.expressions.wound;await woundImage.decode();
  await hud.update(snapshot,player.id,2000);check('wound',portrait.expressions.wound);
  await hud.update(snapshot,player.id,2001);check('normal',portrait.asset);
  await hud.event({...event,type:'destroy',playerId:player.id,targetId:remote.id});
  await hud.update(snapshot,player.id,2001);check('yeah1',portrait.expressions.yeah1);
  await hud.update(snapshot,player.id,2251);check('yeah2',portrait.expressions.yeah2);
  await hud.update(snapshot,player.id,2501);check('yeah2',portrait.expressions.yeah2);
  await hud.update(snapshot,player.id,2751);check('yeah1',portrait.expressions.yeah1);
  await hud.update(snapshot,player.id,3001);check('yeah1',portrait.expressions.yeah1);
  await hud.update(snapshot,player.id,3002);check('normal',portrait.asset);
  for(const state of ['yeah1','yeah2']){const image=new Image();image.src='/'+portrait.expressions[state];await image.decode();}
  await hud.clear();await hud.update(snapshot,player.id,2001);
  player.hp=89;await hud.update(snapshot,player.id,2001);
  if(hud.portraits.get(player.id).state.flags!==0x02000000)throw new Error('Low life state missing');
  await hud.event(event);await hud.event({...event,type:'destroy'});player.alive=false;player.hp=0;
  await hud.update(snapshot,player.id,2001);check('wound',portrait.expressions.wound);
  await hud.update(snapshot,player.id,3002);check('dead',data.portraitDeath.local);
  remote.alive=false;remote.hp=0;await hud.update(snapshot,player.id,3002);
  await hud.update(snapshot,player.id,4003);
  const remoteIcon=root.querySelector('[data-source-control="picPlayerIcon6"]');
  if(remoteIcon.dataset.expression!=='dead' || !remoteIcon.style.backgroundImage.includes(data.portraitDeath.remote))throw new Error('Remote death image missing');
  for(const asset of Object.values(data.portraitDeath)){const image=new Image();image.src='/'+asset;await image.decode();}
  player.alive=true;player.hp=300;remote.alive=true;remote.hp=300;await hud.update(snapshot,player.id,4003);check('normal',portrait.asset);
  if(!remoteIcon.style.backgroundImage.includes(portrait.remoteAsset))throw new Error('Remote revive image missing');
  await hud.clear();
  if(hud.portraits.size || hud.lastUpdate!==undefined)throw new Error('Expression lifecycle retained');
  return {victorySourceFrames:true,victoryAttackerOwnership:true,victoryStrictDuration:true,woundStrictDuration:true,lowLife:true,deathAfterTransient:true,localRemoteDeath:true,revival:true,clear:true};
 })()`);
 await evaluate(sessionId,`await window.testHud.clear()`);
 assert(await evaluate(sessionId,`[...document.querySelectorAll('#original-battle-hud')].every(e=>e.hidden)`));
 await evaluate(sessionId,`await window.disposeHudFixture()`);
 await writeFile('recovery/output/browser-hud.json',JSON.stringify({source:'explicit authoritative-state fixtures rendered by an independent React HUD root',results,modes,dead,rosterChanges,portraits,expressions,clear:true},null,2));
 console.log('PASS: source life slot positions at 1080p/1440p/4K/DPR2, actual atlas/glyph decoding, HP clipping, messages, 12-player roster join/death/revival/departure and clear');
}finally{for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId});ws.close();}
