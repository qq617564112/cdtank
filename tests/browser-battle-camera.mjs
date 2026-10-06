import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3149', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-battle-camera-'));
const output = 'recovery/output/battle-camera-browser';
const evidence = {status: 'RUNNING', scope: 'Ordinary room entry, Ready, arrow turret inputs and W/D movement; native follow camera and ignored pointer/wheel/up/down inputs.', isolation: {server: 3149, vite: 5199, chrome: 9273}, viewports: []};
const network = [], pending = new Map();
let sequence = 0, server, chrome, vite, ws, targetId, session, serverLog = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop(child) {
  if (child?.exitCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await ended;
  }
}
function command(method, params = {}, sessionId = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(expression, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {if (await evaluate(expression)) return;} catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
    }
    await pause(50);
  }
  throw new Error('Browser condition timeout: ' + expression + '\n' + await evaluate(`document.querySelector('#battle-status')?.value`));
}
async function click(selector) {
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point});
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point});
}
const world = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const sample = `(()=>{const scene=window.cameraDiagnostic.scene,c=scene.activeCamera,w=${world},p=w?.players.find(p=>p.id===w.playerId),root=p&&scene.getTransformNodeByName('player-'+p.id);return {eye:c.position.asArray(),target:c.target.asArray(),up:c.upVector.asArray(),fov:c.fov,fovMode:c.fovMode,planes:[c.minZ,c.maxZ],inputs:Object.keys(c.inputs.attached),root:root?.position.asArray(),bodyYaw:root&&-root.rotation.y,player:p,tick:w?.tick}})()`;
async function screenshot(suffix) {
 const shot=await command('Page.captureScreenshot',{format:'png'});
 await writeFile(`${output}-${suffix}.png`,Buffer.from(shot.data,'base64'));
}
async function key(code,down=true) {
 const values={ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],ArrowUp:['ArrowUp',38],ArrowDown:['ArrowDown',40],KeyQ:['q',81],KeyE:['e',69],KeyW:['w',87],KeyD:['d',68]};
 const [value,vk]=values[code];
 await command('Input.dispatchKeyEvent',{type:down?'rawKeyDown':'keyUp',key:value,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
}
function sameCamera(a,b) {for(const name of ['eye','target','up'])assert(a[name].every((v,i)=>Math.abs(v-b[name][i])<.001),name+' changed');}
async function checkNativePose() {
 const result=await evaluate(`(()=>{const s=${sample};const pose=cameraDiagnostic.pose([-s.root[0],s.root[1],s.root[2]],cameraDiagnostic.heading(s.bodyYaw));return {sample:s,pose}})()`);
 for(const name of ['eye','target','up']) {const expected=[-result.pose[name][0],result.pose[name][1],result.pose[name][2]];assert(result.sample[name].every((v,i)=>Math.abs(v-expected[i])<.001),name+' differs from native');}
 assert.deepEqual(result.sample.inputs,[]);assert.deepEqual(result.sample.planes,[10,5000]);assert.equal(result.sample.fovMode,1);
 evidence.poses??=[];evidence.poses.push(result);return result.sample;
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: {...process.env, PORT: '3149', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const started = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < started && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', cacheDir: join(directory, 'vite-cache'), publicDir: '../../recovery/output/web-assets', server: {port: 5199, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3149', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9273', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9273/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw)), callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
    if (message.method !== 'Network.webSocketFrameReceived' || message.params.response.opcode !== 2) return;
    const bytes = new Uint8Array(Buffer.from(message.params.response.payloadData, 'base64'));
    if (bytes.length === 1 && bytes[0] === 0) return;
    const parsed = TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes);
    if (!parsed.isSucc) {evidence.decodeError = parsed.errMsg; return;}
    const result = parsed.result;
    if (result.type === 'api') network.push({kind: 'api', name: result.service.name, success: result.ret.isSucc});
    else if (result.service.name === 'RoomSnapshot') network.push({kind: 'snapshot', ...result.msg});
    else if (result.service.name === 'BattleEvent') network.push({kind: 'event', ...result.msg});
  });
  ({targetId} = await command('Target.createTarget', {url: 'about:blank'}, undefined));
  ({sessionId: session} = await command('Target.attachToTarget', {targetId, flatten: true}, undefined));
  await command('Network.enable');
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
  await command('Page.navigate', {url: 'http://127.0.0.1:5199'});
  await waitUntil(`document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&document.querySelector('#room-map')?.options.length>0`);
  await click('#create-room-controls summary');
  await evaluate(`for(const [selector,value] of [['#room-name','原战斗相机验收'],['#room-mode','4'],['#room-map','7'],['#tank','1']]){const e=document.querySelector(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await waitUntil(`!document.querySelector('#create-room').disabled`);
  await click('#create-room');
  await waitUntil(`(()=>{const w=${world};return w?.mapLoaded&&w.renderedPlayers===1&&w.phase==='WAITING'&&!document.querySelector('[data-ready]').disabled})()`);
  evidence.waiting = await evaluate(world);
  await evaluate(`(async()=>{const source=await(await fetch('/src/main.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const {originalBattleCameraPose,originalActorCameraHeading}=await import('/src/render/battle-camera.ts');window.cameraDiagnostic={scene:EngineStore.LastCreatedScene,pose:originalBattleCameraPose,heading:originalActorCameraHeading};})()`);
  await click('[data-ready]');await waitUntil(`(${world})?.phase==='PLAYING'`);
  await evaluate(`document.querySelector('#world').focus()`);await pause(800);
  const initial=await checkNativePose();await screenshot('1920-initial');
  for(const code of ['ArrowUp','ArrowDown','KeyQ','KeyE']){await key(code);await pause(250);await key(code,false);}
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:950,y:500,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1100,y:650,button:'left',buttons:1});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:1100,y:650,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:1000,y:500,deltaX:0,deltaY:-400});await pause(700);
  const ignored=await checkNativePose();sameCamera(initial,ignored);assert.equal(initial.player.aim,ignored.player.aim);evidence.ignoredCameraControls=true;evidence.qeDoesNotAim=true;
  await key('ArrowRight');await pause(500);await key('ArrowRight',false);await pause(600);
  const right=await checkNativePose();assert(right.player.aim>initial.player.aim+.1);sameCamera(initial,right);
  await key('ArrowLeft');await pause(700);await key('ArrowLeft',false);await pause(600);
  const left=await checkNativePose();assert(left.player.aim<right.player.aim-.1);sameCamera(initial,left);evidence.arrowTurretOnly=true;
  await key('KeyW');await pause(1000);await key('KeyW',false);await pause(1000);
  const moved=await checkNativePose();assert(Math.hypot(moved.player.x-initial.player.x,moved.player.z-initial.player.z)>1);evidence.ordinaryMovementFollow=true;
  await key('KeyD');await pause(700);await key('KeyD',false);await pause(1000);
  const turned=await checkNativePose();assert(Math.abs(turned.bodyYaw-moved.bodyYaw)>.05);evidence.bodyHeadingFollow=true;await screenshot('1920-turned');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false});await pause(1000);await checkNativePose();await screenshot('3840');
  await click('#leave');await waitUntil(`!document.body.classList.contains('in-battle')`);evidence.normalLeave=true;
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await click('#create-room');await waitUntil(`(()=>{const w=${world};return w?.mapLoaded&&w.renderedPlayers===1&&w.phase==='WAITING'})()`);await pause(600);await checkNativePose();evidence.normalReentry=true;
  evidence.shakeDiagnostic=await evaluate(`(async()=>{const {EffectCameraShakeView}=await import('/src/render/effects/camera/effect-camera-shake-view.ts');const c=cameraDiagnostic.scene.activeCamera,baseline=Array.from(c.getViewMatrix(true).m),shake=new EffectCameraShakeView(c,()=>.75);shake.activate(1,.5,10);shake.update(.1);const changed=Array.from(c.getViewMatrix().m).some((v,i)=>Math.abs(v-baseline[i])>1e-6);shake.clear();const restored=Array.from(c.getViewMatrix(true).m).every((v,i)=>Math.abs(v-baseline[i])<1e-6);shake.dispose();return {changed,restored,scope:'Explicit render diagnostic; no original server skill trigger claimed'};})()`);
  assert(evidence.shakeDiagnostic.changed&&evidence.shakeDiagnostic.restored);
  const child=spawn(process.execPath,['tests/browser-battle-input.mjs',endpoint,'http://127.0.0.1:5199'],{stdio:['ignore','pipe','pipe']});let childOutput='';child.stdout.on('data',v=>{childOutput+=v;});child.stderr.on('data',v=>{childOutput+=v;});const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,0,childOutput);evidence.inputRegression=childOutput;
  await click('#leave');
  evidence.status='PASS' ;evidence.noInjectedState=true;
  console.log('PASS: native camera in ordinary battle, ignored mouse/wheel/up/down/QE, arrow turret authority, W/D camera follow, 1080p/4K and normal reentry');
} catch(error) {evidence.status='FAIL';evidence.error=String(error);if(session){evidence.failure=await evaluate(sample).catch(()=>null);await screenshot('failure').catch(()=>{});}throw error;
} finally {
 await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
 if(ws?.readyState===WebSocket.OPEN){if(targetId)await command('Target.closeTarget',{targetId},undefined).catch(()=>{});ws.close();}
 await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true});
}
