import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-hit-t01-07-0020-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-combat-hit-t01-07-0020-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3298,vite:5328,cdp:9528},mapId:20,tankId:1,
  scope:'Ordinary0020 two001 webpages and twoCPU: same nonlethal selector3->07, four original component draws/clock finish/base restoration, M/U source160 event silence. Normal keys only; no world/clock/camera injection. Software320x180.',
  lifecycleReferences:{sameMapRoleRematch:'browser-breach20-05442-2026-10-03T23-21-05-452Z.json',sameRoleDeath:'combat-death-t01-actual.json',scope:'No production lifecycle change; natural FINISHED/rematch/death/revive reused, this run checks local hurt and ordinary Leave.'}};
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
async function nativeClick(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
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
try {
  const env={...process.env,PORT:'3298',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5328,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3298',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9528',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9528/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9528');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5328',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.hitScene=scene;
      window.hit={events:[],messages:[],hurts:[],draws:[],states:[],captures:[],frames:0,canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.hitBattle=this;return reconcile.apply(this,args);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){if(['fire','hit','destroy'].includes(value.type))window.hit.events.push(value);return event.call(this,value,...args);};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts'),message=EffectRuntime.prototype.message;
      EffectRuntime.prototype.message=function(view,value){const before=this.instances.length,voicesBefore=this.sound.voices.size,skillBefore=this.skillSound.voices.size;const result=message.call(this,view,value);
        if(value.action==='07')window.hit.messages.push({owner:view.root.name,...value,before,after:this.instances.length,voicesBefore,voicesAfter:this.sound.voices.size,skillBefore,skillAfter:this.skillSound.voices.size});return result;};
      const {TankView}=await import('/src/assets/tanks/tank-view.ts'),hurt=TankView.prototype.hurt;
      TankView.prototype.hurt=function(selector){window.hit.hurts.push({owner:this.root.name,selector,frame:window.hit.frames,alive:this.alive});return hurt.call(this,selector);};
      scene.onBeforeRenderObservable.add(()=>{for(const mesh of scene.meshes){if(mesh.hitObserved)continue;mesh.hitObserved=true;mesh.onBeforeRenderObservable.add(()=>{
        const view=[...(window.hitBattle?.players.players.values()??[])].find(v=>v.current?.assets.some(a=>a.meshes.includes(mesh)));
        if(!view||view.tankId!==1||view.activeAction!=='07'||!mesh.getTotalVertices())return;
        const component=view.current.components.find(c=>c.assets.meshes.includes(mesh));if(!component)return;
        const manager=mesh.morphTargetManager,morphs=manager?Array.from({length:manager.numTargets},(_,i)=>manager.getTarget(i).influence):[];
        const row={owner:view.root.name,action:'07',part:component.part,asset:component.action.asset,mesh:mesh.name,vertices:mesh.getTotalVertices(),frame:window.hit.frames+1,clock:view.root.metadata.actionClocks?.find(c=>c.part===component.part),matrix:Array.from(mesh.getWorldMatrix().m),morphs};
        window.hit.draws.push(row);
      });}});
      const seen=new Map();scene.onAfterRenderObservable.add(()=>{window.hit.frames++;
        const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.hitBattle)return;const world=JSON.parse(raw);
        for(const player of world.players.filter(p=>p.tankId===1&&!p.isCpu)){const view=window.hitBattle.players.get(player.id);if(!view)continue;
          const clocks=view.root.metadata.actionClocks??[],key=view.activeAction+':'+clocks.map(c=>c.overMessage).join(',');
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.hit.states.push({id:player.id,frame:window.hit.frames,action:view.activeAction,alive:player.alive,hp:player.hp,clocks});}
          const draws=window.hit.draws.filter(d=>d.owner===view.root.name&&d.frame===window.hit.frames);
          if(view.activeAction==='07'&&new Set(draws.map(d=>d.part)).size===4&&!window.hit.captures.some(c=>c.id===player.id))window.hit.captures.push({id:player.id,frame:window.hit.frames,world,draws,canvas:engine.getRenderingCanvas().toDataURL('image/png')});
        }
      });
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',5);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='20')`);await nativeSelect(host,'#room-map',20);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===5&&w.mapId===20&&w.match.objectives.length===117));
  const attackerId=evidence.initial[0].playerId,victimId=evidence.initial[1].playerId;
  evidence.attackerId=attackerId;evidence.victimId=victimId;evidence.inputs=[];
  const held=new Map(pages.map(p=>[p.sessionId,new Set()])),codes={KeyW:87,KeyS:83,KeyA:65,KeyD:68,ArrowLeft:37,ArrowRight:39,Space:32};
  const keys=async(session,next)=>{const old=held.get(session);for(const [type,values]of [['keyUp',[...old].filter(k=>!next.has(k))],['keyDown',[...next].filter(k=>!old.has(k))]])for(const code of values)await command('Input.dispatchKeyEvent',{type,code,key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:codes[code]},session);held.set(session,next);};
  const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const world=()=>evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  let fired=false,done=false;const inputDeadline=Date.now()+75000;
  while(Date.now()<inputDeadline){
    const state=await world(),attacker=state.players.find(p=>p.id===attackerId),victim=state.players.find(p=>p.id===victimId),distance=Math.hypot(victim.x-attacker.x,victim.z-attacker.z);
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.hit`)));
    const hit=observations[0].events.find(e=>e.type==='hit'&&e.playerId===attackerId&&e.targetId===victimId&&e.hurtSelector===3);
    if(hit){fired=true;evidence.hit=hit;}
    done=!!hit&&observations.every(o=>o.events.some(e=>JSON.stringify(e)===JSON.stringify(hit))&&o.captures.some(c=>c.id===victimId)
      &&o.messages.filter(m=>m.owner==='player-'+victimId).some(m=>m.part==='M')&&o.messages.filter(m=>m.owner==='player-'+victimId).some(m=>m.part==='U')
      &&o.states.some((s,i)=>s.id===victimId&&s.action==='07'&&s.alive&&s.clocks.length===4&&s.clocks.every(c=>c.time===2461&&c.overMessage===0)&&o.states.slice(i+1).some(n=>n.id===victimId&&n.alive&&['01','02'].includes(n.action))));
    if(done)break;
    const attackerKeys=new Set(),victimKeys=new Set();
    if(!attacker.alive||!victim.alive)throw Error('Selected nonlethal source life interrupted');
    if(!fired){
      if(distance<140)attackerKeys.add('KeyS');
      else{
        const heading=Math.atan2(victim.x-attacker.x,victim.z-attacker.z),turn=wrap(heading-attacker.yaw),aim=wrap(heading-attacker.yaw-attacker.aim),victimTurn=wrap(attacker.yaw+Math.PI/2-victim.yaw);
        if(Math.abs(turn)>.08)attackerKeys.add(turn>0?'KeyA':'KeyD');if(Math.abs(aim)>.08)attackerKeys.add(aim>0?'ArrowLeft':'ArrowRight');
        if(Math.abs(victimTurn)>.08)victimKeys.add(victimTurn>0?'KeyA':'KeyD');
        if(Math.abs(turn)<.08&&Math.abs(aim)<.08&&Math.abs(victimTurn)<.08)attackerKeys.add('Space');
      }
    }
    await keys(host,attackerKeys);await keys(guest,victimKeys);
    evidence.inputs.push({tick:state.tick,distance,attacker:{x:attacker.x,z:attacker.z,yaw:attacker.yaw,aim:attacker.aim,hp:attacker.hp},victim:{x:victim.x,z:victim.z,yaw:victim.yaw,hp:victim.hp},attackerKeys:[...attackerKeys],victimKeys:[...victimKeys]});
    await new Promise(r=>setTimeout(r,75));
  }
  for(const page of pages)await keys(page.sessionId,new Set());
  assert(done,'Same ordinary nonlethal00107 hit, four parts drawn, M/U source messages and natural base recovery on both pages');
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.hit`)));
  for(const [index,o]of evidence.observed.entries()){
    const capture=o.captures.find(c=>c.id===victimId),parts=[...new Set(capture.draws.map(d=>d.part))].sort();assert.deepEqual(parts,['M','U','X','Y']);
    assert(capture.draws.every(d=>d.asset===`Data/role/001/07${d.part}.glb`&&d.vertices>0));
    const targetMessages=o.messages.filter(m=>m.owner==='player-'+victimId&&m.identifier===1416378268);
    const completeMessages=o.messages.filter(m=>m.owner==='player-'+victimId&&m.identifier===1870030194);
    assert.deepEqual([...new Set(completeMessages.map(m=>m.part))].sort(),['M','U','X','Y']);
    assert(completeMessages.every(m=>m.time===2461));assert.deepEqual([...new Set(targetMessages.map(m=>m.part))].sort(),['M','U']);
    assert(targetMessages.every(m=>m.action==='07'&&m.identifier===1416378268&&m.before===m.after&&m.voicesBefore===m.voicesAfter&&m.skillBefore===m.skillAfter));
    assert(capture.world.players.find(p=>p.id===victimId).alive);assert(!o.events.some(e=>e.type==='destroy'&&e.targetId===victimId));
    await writeFile(output+'-07-'+(index+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));
  }
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.hitBattle.effects.instances.length,effectMeshes:window.hitScene.meshes.filter(m=>m.metadata?.originalEffect).length,effectVoices:window.hitBattle.effects.sound.voices.size,sceneVoices:window.hitBattle.effects.skillSound.voices.size,battleVoices:window.hitBattle.sound.voices.size,players:window.hitBattle.players.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert(Object.values(row).every(n=>n===0));
  evidence.status='PASS';console.log('PASS: ordinary0020 same nonlethal00107 dual four-part draws, M/U source160 silence, natural base restore and Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.hit`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
