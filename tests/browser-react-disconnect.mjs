import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import WebSocket from 'ws';

var directory = await mkdtemp(join(tmpdir(), 'cdtank-react-disconnect-'));
var output = 'recovery/output/react-match-disconnect';
var evidence = {status: 'RUNNING', scope: 'Normal webpage CreateRoom, real server shutdown, cleanup, React return, restart and new WAITING room.'};
var server, chrome, vite, ws, session;
var sequence = 0;
var pending = new Map();
var pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function stop(child) {
  if (child && child.exitCode === null && child.signalCode === null) {
    var ended = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await ended;
  }
}
async function startServer() {
  var log = '';
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3212', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  var deadline = Date.now() + 15000;
  while (!log.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(log.includes('Server started'), log);
}
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, ...(session ? {sessionId: session} : {})}));
  });
}
async function evaluate(expression) {
  var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(expression) {
  var deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await pause(50);
  }
  throw new Error(`Timeout: ${expression}`);
}
async function click(selector) {
  var point = await evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  var hit = await evaluate(`document.elementFromPoint(${point.x},${point.y})?.outerHTML`);
  evidence.clicks ??= [];
  evidence.clicks.push({selector, point, hit});
  assert(await evaluate(`document.elementFromPoint(${point.x},${point.y})?.closest(${JSON.stringify(selector)})===document.querySelector(${JSON.stringify(selector)})`), `${selector} obscured: ${hit}`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point});
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point});
}
var world = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
try {
  await startServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5244, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3212', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9362', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  var endpoint;
  for (var attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9362/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint);
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    var message = JSON.parse(String(raw)), callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
  });
  var {targetId} = await command('Target.createTarget', {url: 'about:blank'});
  session = (await command('Target.attachToTarget', {targetId, flatten: true})).sessionId;
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
  await command('Page.navigate', {url: 'http://127.0.0.1:5244'});
  await waitUntil(`document.querySelector('#tank')?.options.length===21&&!document.querySelector('#create-room').disabled`);
  // Observe the real Battle object through React props; do not replace its state.
  await evaluate(`(()=>{const e=document.querySelector('#create-room');let f=e[Object.keys(e).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.battle)f=f.return;if(!f)throw Error('React Battle owner missing');window.disconnectBattle=f.memoizedProps.battle;return true})()`);
  await click('#create-room-controls > summary');
  await click('#create-room');
  await waitUntil(`(${world})?.mapLoaded&&(${world}).phase==='WAITING'`);
  await waitUntil('window.disconnectBattle.players.players.size>0');
  await waitUntil(`!document.querySelector('#leave').hidden&&document.querySelector('#battle-controls').hidden&&!document.querySelector('#create-room').disabled`);
  evidence.before = await evaluate(`({world:${world},players:window.disconnectBattle.players.players.size,mapAssets:window.disconnectBattle.battlefield.assets.length,reactMatch:!!document.querySelector('[data-match-panel]')})`);
  assert(evidence.before.players > 0); assert(evidence.before.mapAssets > 0); assert(evidence.before.reactMatch);
  await stop(server);
  await waitUntil(`(${world})===null&&document.querySelector('#battle-status').value.includes('连接已断开')&&!document.querySelector('[data-match-panel]')`);
  evidence.cleanup = await evaluate(`(()=>{const b=window.disconnectBattle;return {players:b.players.players.size,projectiles:b.projectiles.meshes.size,mapAssets:b.battlefield.assets.length,effects:b.effects.instances.length,skillVoices:b.effects.skillSound.voices.size,soundVoices:b.sound.voices.size,soundActive:b.sound.active,musicDesired:b.music.desired,musicPaused:b.music.audio.paused,keys:b.input.keys.size,room:b.roomFeed.roomId??null,snapshot:b.roomFeed.snapshot??null,active:b.active,mapLoaded:b.mapLoaded,returnVisible:!document.querySelector('#leave').hidden,returnDisabled:document.querySelector('#leave').disabled}})()`);
  assert.deepEqual(evidence.cleanup, {players: 0, projectiles: 0, mapAssets: 0, effects: 0, skillVoices: 0, soundVoices: 0,
    soundActive: false, musicDesired: false, musicPaused: true, keys: 0, room: null, snapshot: null,
    active: false, mapLoaded: false, returnVisible: true, returnDisabled: false});
  await click('#leave');
  await waitUntil(`!document.querySelector('#battle-controls').hidden&&document.querySelector('#leave').hidden`);
  await startServer();
  await click('#create-room');
  await waitUntil(`(${world})?.mapLoaded&&(${world}).phase==='WAITING'`);
  evidence.reentry = await evaluate(world);
  assert.equal(evidence.reentry.phase, 'WAITING');
  await waitUntil(`!document.querySelector('#leave').hidden&&!document.querySelector('#leave').disabled&&document.querySelector('#battle-controls').hidden&&!document.querySelector('#create-room').disabled`);
  if (await evaluate(`!!document.querySelector('dialog[data-waiting-room]')?.open`)) {
    await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await waitUntil(`!document.querySelector('dialog[data-waiting-room]')?.open`);
  }
  evidence.beforeExit = await evaluate(`({focus:document.activeElement?.outerHTML,dialogOpen:!!document.querySelector('dialog[data-waiting-room]')?.open,leave:document.querySelector('#leave').outerHTML})`);
  await click('#leave');
  await waitUntil(`(${world})===null&&!document.querySelector('#battle-controls').hidden`);
  evidence.status = 'PASS';
  console.log('PASS: real server disconnect clears scene/players/effects/sound/feed/input and React match; normal return, restart and WAITING reentry');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  if (session) evidence.page = await evaluate(`({status:document.querySelector('#battle-status')?.value,world:${world},focus:document.activeElement?.outerHTML})`).catch(() => null);
  throw error;
} finally {
  ws?.close(); await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory, {recursive: true, force: true});
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null, temporaryDirectoryRemoved: true};
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n');
}
