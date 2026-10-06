import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-playable-loop.mjs <Chromium CDP WebSocket URL>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-playable-loop-'));
const database = join(directory, 'accounts.sqlite');
let server;
async function start() {
  let log='';
  const environment={...process.env,PORT:'3133',ACCOUNT_DB_PATH:database};
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
const vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5192,host:'127.0.0.1',proxy:{'/game':{target:'ws://127.0.0.1:3133',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
const contexts = [];
const state = session => evaluate(session, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
const authoritative = value => Object.fromEntries(['phase','mode','remaining','match','teamScores','tick','players','bullets'].map(key=>[key,value[key]]));
const samples=[];
let matchedTicks=0;
try {
  for(let index=0;index<2;index++) {
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5192',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/main.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);EngineStore.LastCreatedEngine.resize();
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await evaluate(host,`document.querySelector('#room-mode').value='4';document.querySelector('#room-mode').dispatchEvent(new Event('change'));document.querySelector('#room-map').value='7';document.querySelector('#create-room').click()`);
  await waitUntil(host,`document.querySelector('#battle-controls').hidden && document.querySelector('#battle-status').dataset.world`);
  const roomId=(await state(host)).roomId;
  for(let index=0;index<3;index++) {
    await waitUntil(host,`document.querySelector('[data-add-cpu]') && !document.querySelector('[data-add-cpu]').disabled`);
    await evaluate(host,`document.querySelector('[data-add-cpu]').click()`);
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${index+2}`);
  }
  await evaluate(guest,`document.querySelector('#refresh-rooms').click()`);
  await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)}) && !document.querySelector('#join').disabled`);
  await evaluate(guest,`document.querySelector('#room').value=${JSON.stringify(roomId)};document.querySelector('#join').click()`);
  const loaded=`(()=>{const raw=document.querySelector('#battle-status').dataset.world;if(!raw)return false;const s=JSON.parse(raw);return s.phase==='WAITING'&&s.mapLoaded&&s.players.length===5&&s.renderedPlayers===5&&document.querySelector('#battle-controls').hidden})()`;
  for(const page of pages)await waitUntil(page.sessionId,loaded);
  const waiting=await Promise.all(pages.map(page=>state(page.sessionId)));
  assert.notEqual(waiting[0].playerId,waiting[1].playerId);
  await evaluate(guest,`document.querySelector('[data-ready]').click()`);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.readyPlayerIds.length===4`);
  assert.equal((await state(host)).phase,'WAITING');
  await evaluate(host,`document.querySelector('[data-ready]').click()`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const started=Date.now(),initial=await Promise.all(pages.map(page=>state(page.sessionId)));
  while(Date.now()-started<330000) {
    const pair=await Promise.all(pages.map(page=>state(page.sessionId)));
    if(pair[0].tick===pair[1].tick){assert.deepEqual(authoritative(pair[0]),authoritative(pair[1]));matchedTicks++;}
    samples.push({elapsedMs:Date.now()-started,states:pair});
    if(pair.every(value=>value.phase==='FINISHED'))break;
    if(samples.length%15===0)console.log(JSON.stringify({phase:pair[0].phase,remaining:pair[0].remaining,kills:pair[0].players.map(p=>p.kills),matchedTicks}));
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  const finished=await Promise.all(pages.map(page=>state(page.sessionId)));
  assert(finished.every(value=>value.phase==='FINISHED'));
  assert.deepEqual(finished[0].match.result,finished[1].match.result);
  assert(finished[0].match.result.players.some(player=>player.kills>0));
  assert(matchedTicks>10,'Both webpages must show equal authoritative state at sampled ticks');
  for(const [index,page] of pages.entries()) {
    await waitUntil(page.sessionId,`document.querySelectorAll('[data-result-player]').length===5`);
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile(`recovery/output/playable-loop-result-${index+1}.png`,Buffer.from(shot.data,'base64'));
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
  for(const page of pages)assert.deepEqual((await state(page.sessionId)).match.result,finished[0].match.result);
  await evaluate(host,`document.querySelector('[data-rematch]').click()`);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.rematchPlayerIds.length===4`);
  assert.equal((await state(host)).phase,'FINISHED');
  await evaluate(guest,`document.querySelector('[data-rematch]').click()`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING'&&s.match.round===2&&s.players.every(p=>p.kills===0&&p.alive&&p.hp===p.maxHp)})()`);
  const replay=await Promise.all(pages.map(page=>state(page.sessionId)));
  for(const page of pages)await evaluate(page.sessionId,`document.querySelector('#leave').click()`);
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world && !document.querySelector('#battle-controls').hidden`);
  await evaluate(host,`document.querySelector('#refresh-rooms').click()`);
  await waitUntil(host,`!document.querySelector('#refresh-rooms').disabled`);
  assert(await evaluate(host,`!Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`));
  await writeFile('recovery/output/browser-playable-loop.json',JSON.stringify({status:'PASS',scope:'Two independent webpages use normal create/join/CPU/Ready controls, original map7 mode4 time limit, CPU autonomous combat with no human combat input, equal snapshots and frozen result, both human rematch votes, reset and return/room cleanup. Reduced rendering; not HD performance or original combat formula fidelity.',elapsedMs:Date.now()-started,matchedTicks,waiting,initial,samples,finished,replay},null,2));
  console.log('PASS: two-webpage playable lifecycle, CPU natural combat, equal settlement, human-gated rematch, reset and exit');
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId});
  ws.close();await vite.close();await stop();await rm(directory,{recursive:true,force:true});
}
