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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3020', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-ready-'));
let server, chrome, vite, ws;
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'PASS', scope: 'Normal rebuilt Web room readiness and team controls; fresh account, no ownership/state fixtures, no CPU and no combat state injection.', states: []};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function stop(process) {
  if (process?.exitCode === null) {
    const ended = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await ended;
  }
}
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
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(session, expression)) return;
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
    }
    await pause(100);
  }
  throw new Error('Browser condition timeout: ' + expression + '\n' + await evaluate(session, `document.querySelector('#battle-status')?.value`));
}
async function click(session, selector) {
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);
}
async function input(session, selector, value) {
  await click(session, selector);
  await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2}, session);
  await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2}, session);
  await command('Input.insertText', {text: value}, session);
}
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const readySelector = '[data-match-panel] [data-ready]';
async function state(session, label) {
  const state = await evaluate(session, `(()=>{const world=${worldExpression},panel=document.querySelector('[data-match-panel]');return {world,ready:{text:panel.querySelector('[data-ready]').textContent,disabled:panel.querySelector('[data-ready]').disabled},teams:[...panel.querySelectorAll('[data-change-team]')].map(e=>({team:Number(e.dataset.changeTeam),disabled:e.disabled,pressed:e.getAttribute('aria-pressed')})),status:panel.querySelector('[role=status]').textContent,roster:[...panel.querySelectorAll('[data-waiting-player]')].map(e=>({id:e.dataset.waitingPlayer,team:Number(e.dataset.team),text:e.textContent}))}})()`);
  const local = state.world.players.find(player => player.id === state.world.playerId);
  assert(local);
  assert.equal(state.world.phase, 'WAITING');
  assert.equal(state.world.mode, 1);
  assert.equal(state.world.match.minPlayers, 4);
  assert.equal(state.world.players.length, 1);
  assert.equal(state.world.players.some(player => player.isCpu), false);
  assert.equal(state.ready.disabled, false);
  const ready = state.world.match.readyPlayerIds.includes(local.id);
  assert.equal(state.ready.text, ready ? '取消准备' : '准备');
  for (const button of state.teams) {
    assert.equal(button.disabled, ready || local.team === button.team);
    assert.equal(button.pressed, String(local.team === button.team));
  }
  if (ready) assert.equal(state.status, '取消准备后可换队。');
  assert.equal(state.roster[0].team, local.team);
  assert(state.roster[0].text.includes(ready ? '已准备' : '未准备'));
  evidence.states.push({label, ...state});
  return state;
}
async function setReady(session, value) {
  const from = network.length;
  await click(session, readySelector);
  await waitUntil(session, `(()=>{const w=${worldExpression};return w&&w.match.readyPlayerIds.includes(w.playerId)===${value}&&document.querySelector('${readySelector}').textContent===${JSON.stringify(value ? '取消准备' : '准备')}&&!document.querySelector('${readySelector}').disabled})()`);
  const response = network.slice(from).find(event => event.kind === 'api' && event.name === 'Ready');
  assert(response?.success, 'Missing successful normal Ready network response');
  const snapshot = network.slice(from).find(event => event.kind === 'snapshot' && event.ready === value);
  assert(snapshot, 'Missing authoritative Ready network snapshot');
}

try {
  let log = '';
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3020', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const deadline = Date.now() + 15000;
  while (!log.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(log.includes('Server started'), log);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5203, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3020', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9256', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9256/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chrome failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
    }
    if (message.method === 'Network.webSocketFrameReceived') {
      const frame = message.params.response;
      if (frame.opcode !== 2) return;
      const bytes = new Uint8Array(Buffer.from(frame.payloadData, 'base64'));
      if (bytes.length === 1 && bytes[0] === 0) return;
      const parsed = TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes);
      assert(parsed.isSucc, parsed.errMsg);
      const result = parsed.result;
      if (result.type === 'api') network.push({kind: 'api', name: result.service.name, success: result.ret.isSucc,
        response: ['CreateRoom', 'Ready', 'ChangeTeam'].includes(result.service.name)
          ? result.ret.isSucc ? result.ret.res : result.ret.err : undefined});
      else if (result.service.name === 'RoomSnapshot') {
        const snapshot = result.msg;
        network.push({kind: 'snapshot', phase: snapshot.phase, tick: snapshot.tick,
          players: snapshot.players.map(player => ({id: player.id, team: player.team, isCpu: player.isCpu})),
          readyIds: snapshot.match.readyPlayerIds, ready: snapshot.match.readyPlayerIds.length === 1});
      }
    }
  });
  const {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId);
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId: session} = await command('Target.attachToTarget', {targetId, flatten: true}); pages.push(targetId);
  await command('Network.enable', {}, session);
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, session);
  await command('Page.navigate', {url: 'http://127.0.0.1:5203'}, session);
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&document.querySelector('#room-map')?.options.length>0`);
  await input(session, '#player-name', '准备换队验收');
  await click(session, '#create-room-controls summary');
  await input(session, '#room-name', '准备换队验收');
  assert.equal(await evaluate(session, `document.querySelector('#room-mode').value`), '1');
  await waitUntil(session, `!document.querySelector('#create-room').disabled`);
  await click(session, '#create-room');
  await waitUntil(session, `(()=>{const w=${worldExpression};return w?.mapLoaded&&w.renderedPlayers===1&&w.phase==='WAITING'&&!document.querySelector('${readySelector}')?.hidden})()`);
  const initial = await state(session, 'before-ready');
  await setReady(session, true);
  await state(session, 'confirmed-ready');
  await setReady(session, false);
  await state(session, 'confirmed-cancel');
  const oldTeam = initial.world.players[0].team, newTeam = 1 - oldTeam, beforeTeam = network.length;
  await click(session, `[data-change-team="${newTeam}"]`);
  await waitUntil(session, `(()=>{const w=${worldExpression};return w?.players.find(p=>p.id===w.playerId)?.team===${newTeam}&&!w.match.readyPlayerIds.length&&!document.querySelector('[data-change-team="${oldTeam}"]').disabled})()`);
  assert(network.slice(beforeTeam).some(event => event.kind === 'api' && event.name === 'ChangeTeam' && event.success));
  assert(network.slice(beforeTeam).some(event => event.kind === 'snapshot' && event.players[0].team === newTeam && event.readyIds.length === 0));
  await state(session, 'confirmed-team-change');
  await setReady(session, true);
  await state(session, 'other-team-confirmed-ready');
  await setReady(session, false);
  await state(session, 'other-team-confirmed-cancel');
  const screenshot = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile('recovery/output/room-ready-team-browser.png', Buffer.from(screenshot.data, 'base64'));
  await click(session, '#leave');
  await waitUntil(session, `!document.body.classList.contains('in-battle')&&document.querySelector('[data-match-panel]').hidden&&!document.querySelector('#battle-status').dataset.world`);
  evidence.returnClearsRoom = true;
  evidence.network = network;
  evidence.noInjectedState = true;
  evidence.isolation = {server: 3020, vite: 5203, chrome: 9256};
  await writeFile('recovery/output/room-ready-team-browser.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log('PASS: normal Ready/Cancel confirmations disable/restore team controls, authoritative opposite team change, both teams and return cleanup');
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    for (const targetId of pages) await command('Target.closeTarget', {targetId}).catch(() => {});
    for (const browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {});
    ws.close();
  }
  await vite?.close();
  await stop(server);
  await stop(chrome);
  await rm(directory, {recursive: true, force: true});
}
