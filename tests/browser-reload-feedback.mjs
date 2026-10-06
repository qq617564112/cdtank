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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3141', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-reload-hud-'));
const output = 'recovery/output/reload-hud-browser';
const evidence = {status: 'RUNNING', scope: 'Ordinary webpage room creation, Ready and real Space key firing; authoritative reload snapshots and live original prgCrossbar rendering.', isolation: {server: 3141, vite: 5194, chrome: 9260}, viewports: []};
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
const crossbar = `document.querySelector('#original-battle-hud [data-source-control="prgCrossbar"]')`;
const sample = `(()=>{const e=${crossbar};if(!e)return null;const r=e.getBoundingClientRect(),fill=e.querySelector('.source-progress-fill'),image=e.querySelector('.source-progress-image'),s=getComputedStyle(e),f=fill&&getComputedStyle(fill),i=image&&getComputedStyle(image);return {at:performance.now(),value:Number(e.getAttribute('aria-valuenow')),max:Number(e.getAttribute('aria-valuemax')),rect:[r.x,r.y,r.width,r.height],hidden:e.hidden,display:s.display,visibility:s.visibility,background:getComputedStyle(e.querySelector('.source-progress-background')).backgroundImage,opacity:s.opacity,dataset:{...e.dataset},fill:fill?{colour:f.backgroundColor,background:i.backgroundImage,opacity:i.opacity,clip:f.clipPath,rect:(()=>{const r=fill.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()}:null}})()`;
async function screenshot(suffix) {
  const shot = await command('Page.captureScreenshot', {format: 'png'});
  await writeFile(`${output}-${suffix}.png`, Buffer.from(shot.data, 'base64'));
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: {...process.env, PORT: '3141', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const started = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < started && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets', server: {port: 5194, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3141', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9260', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9260/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5194'});
  await waitUntil(`document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&document.querySelector('#room-map')?.options.length>0`);
  await click('#create-room-controls summary');
  await evaluate(`for(const [selector,value] of [['#room-name','装填反馈验收'],['#room-mode','4'],['#room-map','7'],['#tank','1']]){const e=document.querySelector(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await waitUntil(`!document.querySelector('#create-room').disabled`);
  await click('#create-room');
  await waitUntil(`(()=>{const w=${world};return w?.mapLoaded&&w.renderedPlayers===1&&w.phase==='WAITING'&&!document.querySelector('[data-ready]').disabled})()`);
  evidence.waiting = await evaluate(world);
  assert.equal(evidence.waiting.mode, 4);
  assert.equal(evidence.waiting.players.length, 1);
  assert.equal(evidence.waiting.players.some(p => p.isCpu), false);
  await click('[data-ready]');
  await waitUntil(`(${world})?.phase==='PLAYING'&&${crossbar}&&!document.querySelector('#original-battle-hud').hidden`);
  evidence.source = await evaluate(`(async()=>{const ui=await(await fetch('/ui.json')).json(),control=ui.layouts.find(l=>l.path==='ui/layouts/game_main.xml').windows.find(w=>w.name==='prgCrossbar');const resolve=reference=>{const [,set,name]=reference.match(/^set:(.+) image:(.+)$/);return ui.imagesets.find(s=>s.attributes.Name===set&&s.path.includes('imagesets_dds/')).images.find(i=>i.Name===name).asset;};const background=resolve(control.properties.BackgroundImage),fill=resolve(control.properties.ProgressImage),image=new Image();image.src='/'+fill;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);const pixels=x.getImageData(0,0,c.width,c.height).data;let yellowPixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]>180&&pixels[i+2]<80&&pixels[i+3]>0)yellowPixels++;return {control,background,fill,yellowPixels};})()`);
  assert(evidence.source.yellowPixels>0, 'Original progress sprite contains yellow pixels');
  for (const [width, height] of [[1920,1080], [3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await evaluate(`(async()=>{const source=await(await fetch('/src/main.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(${width/1920});EngineStore.LastCreatedEngine.resize();window.dispatchEvent(new Event('resize'));})()`);
    await pause(150);
    const initial = await evaluate(sample);
    assert.equal(initial.value / initial.max, 1, 'Idle crossbar must be full');
    await evaluate(`window.reloadSamples=[];window.reloadObserver?.disconnect();window.reloadObserver=new MutationObserver(()=>window.reloadSamples.push(${sample}));window.reloadObserver.observe(${crossbar},{attributes:true,subtree:true});document.activeElement?.blur();document.querySelector('#world').focus();`);
    const before = network.length;
    await command('Input.dispatchKeyEvent', {type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32});
    await pause(80);
    await command('Input.dispatchKeyEvent', {type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32});
    await waitUntil(`window.reloadSamples.some(s=>s.value/s.max>0&&s.value/s.max<.9)`, 2000);
    const partial = await evaluate(sample);
    await screenshot(`${width}-partial`);
    await waitUntil(`window.reloadSamples.some(s=>s.value/s.max===1)`, 2000);
    const expired = await evaluate(sample), samples = await evaluate(`window.reloadSamples`);
    const low = samples.find(s => s.value/s.max < 1), mid = samples.find(s => s.value/s.max > .1 && s.value/s.max < .9), full = samples.find(s => s.value/s.max === 1 && s.at > (low?.at ?? Infinity));
    assert(low, 'Ordinary shot produces observable partial reload');
    assert(mid && full && full.at > mid.at, 'Reload must rise through partial to full');
    assert(full.at - low.at <= 2000, 'Native reload feedback expires within two seconds');
    assert(mid.fill.background.includes(evidence.source.fill), 'Original yellow progress image is live');
    assert(mid.background.includes(evidence.source.background), 'Original crosshair background is live');
    assert.equal(mid.opacity, '0.6');
    assert.equal(mid.fill.opacity, '1', 'Original effective window alpha replaces colour alpha; child does not multiply it again');
    assert(mid.fill.clip.startsWith('inset(') && mid.fill.clip !== 'inset(0% 0px 0px)', 'Vertical clipping renders partial fill');
    assert.equal(partial.display === 'none' || partial.visibility === 'hidden', false);
    const scale = Math.min(width/800, height/600), offsetX = (width-800*scale)/2, offsetY = (height-600*scale)/2;
    const expected = [offsetX+373*scale, offsetY+234*scale, 50*scale, 37*scale];
    assert(partial.rect.every((v,i) => Math.abs(v-expected[i]) < .05), `Crossbar source rect: ${partial.rect} versus ${expected}`);
    const snapshots = network.slice(before).filter(e => e.kind === 'snapshot');
    const reloads = snapshots.flatMap(s => s.players.filter(p => p.id === evidence.waiting.playerId).map(p => p.reload)).filter(r => r?.remaining > 0);
    assert(reloads.length, 'Actual server snapshots contain active local reload');
    assert(reloads.every(r => typeof r.startedAt === 'number' && Number.isFinite(r.startedAt) && r.duration > 0 && r.source), 'Reload snapshot duration, source and absolute server timestamp');
    assert.equal(evidence.decodeError, undefined);
    await screenshot(`${width}-full`);
    evidence.viewports.push({width,height,hardwareScaling:width/1920,canvasRendering:'1920x1080',hudRendering:`${width}x${height}`,initial,partial,expired,samples,reloads});
  }
  await evaluate(`window.reloadObserver.disconnect()`);
  await click('#leave');
  await waitUntil(`!document.body.classList.contains('in-battle')&&!document.querySelector('#battle-status').dataset.world&&document.querySelector('#original-battle-hud').hidden`);
  evidence.cleared = await evaluate(sample);
  evidence.returnClearsHud = true;
  evidence.normalReady = network.some(e => e.kind === 'api' && e.name === 'Ready' && e.success);
  assert(evidence.normalReady);
  evidence.noInjectedState = true;
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`, {force:true});
  console.log('PASS: real ordinary shot to authoritative reload to original prgCrossbar, partial/full at 1080p and 4K HUD (1080p 3D canvas), original texture/yellow fill/source rect and leave cleanup');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  if (session) {
    evidence.failureState = await evaluate(world).catch(() => null);
    evidence.failureHud = await evaluate(sample).catch(() => null);
    evidence.failureSamples = await evaluate('window.reloadSamples').catch(() => null);
    await screenshot('failure').catch(() => {});
  }
  throw error;
} finally {
  evidence.network = network.filter(e => e.kind !== 'snapshot' || e.players.some(p => p.reload?.remaining > 0));
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2)+'\n');
  await writeFile(`${output}.log`, serverLog);
  if (ws?.readyState === WebSocket.OPEN) {
    if (targetId) await command('Target.closeTarget', {targetId}, undefined).catch(() => {});
    ws.close();
  }
  await vite?.close();
  await stop(server); await stop(chrome);
  await rm(directory, {recursive: true, force: true});
}
