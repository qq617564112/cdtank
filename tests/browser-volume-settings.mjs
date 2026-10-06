import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';

const require = createRequire(import.meta.url), WebSocket = require('ws');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-volume-settings-'));
const output = process.env.CDTANK_VOLUME_SETTINGS_OUTPUT ?? 'recovery/output/browser-volume-settings';
const origin = 'http://127.0.0.1:5294', key = 'cdtank.audio-settings.v1';
const evidence = {status: 'RUNNING', isolation: {server: 3264, vite: 5294, chrome: 9494},
  scope: 'Real Chromium 1920x1080 and 3840x2160, native range keyboard Home/End/Arrow keys, reload/new-page zero and nonzero restoration, real Battle setter calls and audio consumers, ordinary room entry/leave/reentry. No combat-state injection.',
  normal: [], diagnostics: [], errors: []};
const contexts = [], pages = [], pending = new Map();
let sequence = 0, server, chrome, vite, ws, serverLog = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop(child) {
  if (child?.exitCode === null && child?.signalCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await ended;
  }
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {if (await evaluate(session, `Boolean(${expression})`)) return;} catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
    }
    await pause(50);
  }
  throw new Error('Browser condition timeout: ' + expression);
}
async function click(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing selector');e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control obscured '+e.id);return {x,y}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await command('Input.dispatchMouseEvent', {type, button: 'left', clickCount: 1, ...point}, session);
  await evaluate(session, 'new Promise(requestAnimationFrame)');
}
async function keyboard(session, selector, keys) {
  await click(session, selector);
  const codes = {Home: 36, End: 35, ArrowLeft: 37, ArrowRight: 39};
  for (const key of keys) for (const type of ['keyDown', 'keyUp']) {
    await command('Input.dispatchKeyEvent', {type, key, code: key, windowsVirtualKeyCode: codes[key]}, session);
  }
}
async function screenshot(session, name) {
  const shot = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(shot.data, 'base64'));
}
async function newContext() {
  const {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId); return browserContextId;
}
async function newPage(browserContextId, width = 1920, height = 1080, fixture = '') {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Runtime.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `window.volumeObserved=[];${fixture}`}, sessionId);
  await command('Page.navigate', {url: origin}, sessionId);
  await ready(sessionId); return sessionId;
}
async function reload(session) {
  const previous=await evaluate(session,'performance.timeOrigin');
  await command('Page.reload',{},session);
  await waitUntil(session,`performance.timeOrigin!==${previous}`);
  await ready(session);
}
async function ready(session) {
  await waitUntil(session, `window.volumeBattle&&document.querySelector('#music-volume')&&document.querySelector('#tank')?.options.length===21&&!document.querySelector('#create-room').disabled`);
}
async function state(session, storage = true) {
  return await evaluate(session, `(()=>{const b=window.volumeBattle;return {
    viewport:[innerWidth,innerHeight], sliders:{music:Number(document.querySelector('#music-volume').value),sound:Number(document.querySelector('#sound-volume').value)},
    status:document.querySelector('#volume-settings-status').textContent,
    labels:{music:document.querySelector('#music-volume-value').value,sound:document.querySelector('#sound-volume-value').value},
    stored:${storage ? `localStorage.getItem('${key}')` : 'null'}, setters:window.volumeObserved,
    consumers:{music:b.music.audio.volume,battleSoundDesired:b.sound.volume,battleSoundGain:b.sound.gain?.gain.value??null,
      battleSoundState:b.sound.context?.state??null,effectSoundDesired:b.effects.sound.volume,
      skillSoundDesired:b.effects.skillSound.volume,skillSoundGain:b.effects.skillSound.master?.gain.value??null,
      skillSoundState:b.effects.skillSound.context?.state??null},
    media:{src:b.music.audio.getAttribute('src'),paused:b.music.audio.paused,time:b.music.audio.currentTime,state:b.music.audio.dataset.state,readyState:b.music.audio.readyState,networkState:b.music.audio.networkState,duration:b.music.audio.duration,error:b.music.audio.error?.message??null}
  };})()`);
}
function assertValues(row, music, sound, active = false) {
  assert.deepEqual(row.sliders, {music, sound});
  assert.deepEqual(row.labels, {music:`${Math.round(music*100)}%`,sound:`${Math.round(sound*100)}%`});
  assert.equal(row.consumers.music, music);
  for (const field of ['battleSoundDesired', 'effectSoundDesired', 'skillSoundDesired']) assert.equal(row.consumers[field], sound, field);
  if (active) {
    assert.equal(row.consumers.battleSoundGain, sound);
    assert.equal(row.consumers.skillSoundGain, sound);
  }
}
async function record(session, name, music, sound, active = false) {
  const row = await state(session); assertValues(row, music, sound, active);
  assert.deepEqual(JSON.parse(row.stored), {music, sound});
  evidence.normal.push({name, ...row}); return row;
}
async function enterRoom(session) {
  if (!await evaluate(session, `document.querySelector('#create-room-controls').open`)) await click(session, '#create-room-controls summary');
  await click(session, '#create-room');
  await waitUntil(session, `JSON.parse(document.querySelector('#battle-status').dataset.world??'null')?.mapLoaded&&!(!document.querySelector('#leave')||document.querySelector('#leave').hidden)&&window.volumeBattle.sound.active&&window.volumeBattle.effects.skillSound.master`);
  // A native keyboard gesture resumes contexts after their asynchronous catalog loads.
  await click(session, 'label[for="music-volume"]');
  await waitUntil(session, `window.volumeBattle.music.audio.dataset.state==='playing'&&window.volumeBattle.music.audio.currentTime>0&&window.volumeBattle.sound.context.state==='running'&&window.volumeBattle.effects.skillSound.context.state==='running'`);
}
async function launchBrowser() {
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9494', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9494/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start'); ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('close', () => {for (const request of pending.values()) request.reject(new Error('CDP closed')); pending.clear();});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw)), callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
    if (message.method === 'Runtime.exceptionThrown') evidence.errors.push({session: message.sessionId, error: message.params.exceptionDetails});
  });
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3264', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe']});
  const append = data => {serverLog += String(data);}; server.stdout.on('data', append); server.stderr.on('data', append);
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins: [{name: 'volume-browser-observer', transform(source, id) {
      if (!id.endsWith('/src/match/battle.ts')) return;
      return source + `\nfor(const name of ['setMusicVolume','setSoundVolume']){const original=Battle.prototype[name];Battle.prototype[name]=function(value){window.volumeBattle=this;window.volumeObserved.push({method:name,value});return original.call(this,value);};}\n`;
    }}], server: {port: 5294, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3264', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  await launchBrowser();
  const normalContext = undefined, hd = await newPage(normalContext);
  const defaults = await state(hd); assertValues(defaults, .5, .5); evidence.normal.push({name: 'fresh-defaults', ...defaults});
  assert.deepEqual(defaults.setters.slice(0, 2), [{method: 'setMusicVolume', value: .5}, {method: 'setSoundVolume', value: .5}]);
  await keyboard(hd, '#music-volume', ['End', ...Array(5).fill('ArrowLeft')]);
  await keyboard(hd, '#sound-volume', ['Home', ...Array(5).fill('ArrowRight')]);
  await record(hd, 'keyboard-nonzero-1080p', .75, .25); await screenshot(hd, '1080p');
  await reload(hd);
  const restored = await record(hd, 'reload-nonzero', .75, .25);
  assert.deepEqual(restored.setters.slice(0, 2), [{method: 'setMusicVolume', value: .75}, {method: 'setSoundVolume', value: .25}]);
  const uhd = await newPage(normalContext, 3840, 2160); await record(uhd, 'new-page-nonzero-4k', .75, .25); await screenshot(uhd, '4k');
  await keyboard(hd, '#music-volume', ['Home']); await keyboard(hd, '#sound-volume', ['Home']);
  await record(hd, 'keyboard-zero', 0, 0);
  await reload(hd); await record(hd, 'reload-zero', 0, 0);
  const zeroPage = await newPage(normalContext, 3840, 2160); await record(zeroPage, 'new-page-zero', 0, 0);
  await command('Target.closeTarget', {targetId: pages.at(-1).targetId});
  await keyboard(hd, '#music-volume', ['End', ...Array(5).fill('ArrowLeft')]);
  await keyboard(hd, '#sound-volume', ['Home', ...Array(5).fill('ArrowRight')]);
  await command('Target.closeTarget', {targetId: pages.find(p=>p.sessionId===uhd).targetId});
  await enterRoom(hd); await record(hd, 'ordinary-room-audio-consumers', .75, .25, true);
  // Explicit audio-device fixture: real runtime backends, no player skill/event injection.
  await evaluate(hd, `(()=>{const b=window.volumeBattle,backend=b.effects.sound,skill=b.effects.skillSound,c=b.camera??skill.camera,p=skill.camera.globalPosition;
    const mediaHandle=backend.play('GA15',0),media=backend.voices.get(mediaHandle).audio;media.loop=true;
    const skillHandle=skill.play('GA15',-1,[-p.x,p.y,p.z]),voice=skill.voices.get(skillHandle);
    if(!voice)throw new Error('Actual skill voice unavailable');
    const analyser=skill.context.createAnalyser();analyser.fftSize=2048;skill.master.connect(analyser);
    window.volumeProbe={backend,skill,mediaHandle,skillHandle,media,voice,analyser};})()`);
  await waitUntil(hd, `window.volumeProbe.media.currentTime>0&&!window.volumeProbe.media.paused&&window.volumeProbe.voice.audio.currentTime>0&&!window.volumeProbe.voice.audio.paused`);
  const probeState = async () => await evaluate(hd, `(async()=>{const p=window.volumeProbe,samples=new Float32Array(2048);let peak=0;
    await new Promise(r=>setTimeout(r,150));for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,20));p.analyser.getFloatTimeDomainData(samples);for(const v of samples)peak=Math.max(peak,Math.abs(v));}
    return {effectMediaVolume:p.media.volume,effectMediaTime:p.media.currentTime,skillMediaTime:p.voice.audio.currentTime,skillMaster:p.skill.master.gain.value,skillOutputPeak:peak};})()`);
  const playingProbe=await probeState();assert.equal(playingProbe.effectMediaVolume,.25);assert.equal(playingProbe.skillMaster,.25);assert(playingProbe.skillOutputPeak>0);
  await keyboard(hd, '#sound-volume', ['Home']);
  const mutedProbe=await probeState();assert.equal(mutedProbe.effectMediaVolume,0);assert.equal(mutedProbe.skillMaster,0);assert.equal(mutedProbe.skillOutputPeak,0);
  await keyboard(hd, '#sound-volume', ['End']);
  const unmutedProbe=await probeState();assert.equal(unmutedProbe.effectMediaVolume,1);assert.equal(unmutedProbe.skillMaster,1);assert(unmutedProbe.skillOutputPeak>0);
  evidence.diagnostics.push({fixture:'Explicit GA15 loop playback through existing EffectSound and EffectSkillSound backends; no combat state or player skill event injected. Normal sound slider changes live voices.',playing:playingProbe,muted:mutedProbe,unmuted:unmutedProbe});
  await evaluate(hd, `(()=>{const p=window.volumeProbe;p.backend.stop(p.mediaHandle);p.skill.stop(p.skillHandle);p.skill.master.disconnect(p.analyser);delete window.volumeProbe;})()`);
  await keyboard(hd, '#sound-volume', ['Home']); await record(hd, 'sound-muted-music-independent', .75, 0, true);
  await keyboard(hd, '#music-volume', ['Home']); await keyboard(hd, '#sound-volume', ['Home', ...Array(5).fill('ArrowRight')]);
  await record(hd, 'music-muted-sound-independent', 0, .25, true); await screenshot(hd, 'room-muted');
  await click(hd, '#leave'); await waitUntil(hd, `!document.querySelector('#battle-status').dataset.world&&(!document.querySelector('#leave')||document.querySelector('#leave').hidden)`);
  const left = await state(hd); assertValues(left, 0, .25); assert.equal(left.media.src, null); assert.equal(left.consumers.battleSoundGain, 0);
  evidence.normal.push({name: 'ordinary-room-leave', ...left});
  await enterRoom(hd); await record(hd, 'ordinary-room-reentry-muted', 0, .25, true);
  await keyboard(hd, '#music-volume', ['End', ...Array(5).fill('ArrowLeft')]);
  await record(hd, 'reentry-nonzero-music', .75, .25, true);
  await click(hd, '#leave');
  const browserClosed=new Promise(resolve=>chrome.once('exit',resolve));
  await command('Browser.close').catch(()=>{});await browserClosed;
  await launchBrowser();
  const reopened = await newPage(normalContext);
  await record(reopened, 'chromium-restart-same-profile', .75, .25);
  await screenshot(reopened, 'reopened');
  const malformed = await newPage(await newContext(), 1920, 1080, `localStorage.setItem('${key}','{broken');`);
  const invalid = await state(malformed); assertValues(invalid, .5, .5);
  evidence.diagnostics.push({fixture: 'Malformed JSON preseeded only in isolated browser localStorage before page load', ...invalid});
  await keyboard(malformed, '#music-volume', ['Home']); await keyboard(malformed, '#sound-volume', ['End']);
  const repaired = await state(malformed); assertValues(repaired, 0, 1); assert.deepEqual(JSON.parse(repaired.stored), {music: 0, sound: 1});
  evidence.diagnostics.push({fixture: 'Native keyboard repairs malformed-data fixture', ...repaired});
  const invalidFields = await newPage(await newContext(), 1920, 1080, `localStorage.setItem('${key}',JSON.stringify({music:2,sound:.25}));`);
  const fields = await state(invalidFields); assertValues(fields, .5, .25);
  evidence.diagnostics.push({fixture: 'Out-of-range music field preseeded before page load; valid sound field retained independently', ...fields});
  const denied = await newPage(await newContext(), 1920, 1080,
    `for(const method of ['getItem','setItem']){const original=Storage.prototype[method];Storage.prototype[method]=function(name,...args){if(name==='${key}')throw new DOMException('Fixture storage disabled','SecurityError');return original.call(this,name,...args);};}`);
  const unavailable = await state(denied, false); assertValues(unavailable, .5, .5);
  assert(unavailable.status.length > 0); evidence.diagnostics.push({fixture: 'Storage.prototype getItem/setItem throws SecurityError only for audio-settings key; account storage stays real', ...unavailable});
  await keyboard(denied, '#music-volume', ['Home']); await keyboard(denied, '#sound-volume', ['End']);
  const deniedLive = await state(denied, false); assertValues(deniedLive, 0, 1); assert(deniedLive.status.length > 0);
  evidence.diagnostics.push({fixture: 'Storage disabled; native keyboard still updates actual Battle consumers', ...deniedLive});
  await screenshot(denied, 'storage-disabled');
  assert.deepEqual(evidence.errors, []); evidence.status = 'PASS'; await rm(`${output}-failure.png`, {force: true});
  console.log('PASS: 1080p/4K native keyboard volumes, zero/nonzero persistence, real Battle/audio consumers, room leave/reentry, malformed and unavailable storage fixtures');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  if (pages[0]) {evidence.failure = await state(pages[0].sessionId).catch(() => null); await screenshot(pages[0].sessionId, 'failure').catch(() => {});}
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) {for (const browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {}); ws.close();}
  await vite?.close(); await stop(server); await stop(chrome); await rm(directory, {recursive: true, force: true});
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null, viteClosed: true, temporaryDirectoryRemoved: true};
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n'); await writeFile(`${output}.log`, serverLog);
}
