import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws'), {WsClient} = require('tsrpc'), {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3638', logger: undefined});
const argument = name => process.argv[process.argv.indexOf(name) + 1];
const tailPath = process.argv.includes('--unreached-tail') ? argument('--unreached-tail') : undefined;
const first = tailPath ? JSON.parse(await readFile(tailPath, 'utf8')) : undefined;
const resumeAfterHistory = !!first && first.error?.includes('Covered control') && first.error.includes('chkSaveAccount')
  && first.stages?.some(stage => stage.label === 'HistorySourceControlClosed' && stage.dom.dialogs.length === 0);
if (first) {
  assert.equal(first.status, 'FAIL'); assert.equal(first.network.length, 0);
  assert(first.failedStage === 'HistoryClose' || resumeAfterHistory, 'Only named unachieved entry gates may resume');
}
assert(first || (process.argv.includes('--fixture') && process.argv.includes('--database')), 'Explicit committed identity and checkpoint required');
const fixturePath = first ? tailPath.replace(/\.json$/, '-checkpoint-fixture.json') : argument('--fixture');
const checkpoint = first ? first.savedCheckpoint : argument('--database');
assert(checkpoint, 'First actual saved checkpoint required');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
assert(fixture.accounts?.[0]?.token, 'Legitimate retained source identity');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = 'recovery/output/browser-login-channel-' + runId;
const directory = await mkdtemp(join(tmpdir(), 'cdtank-login-channel-'));
const database = join(directory, 'accounts.sqlite');
const account = 'ui' + Date.now(), password = 'Login_' + Date.now();
const source = new DatabaseSync(checkpoint, {readOnly: true});
try {await backup(source, database);} finally {source.close();}
function nativeAccount() {
  const db = new DatabaseSync(database, {readOnly: true});
  try {
    const identity = db.prepare('SELECT id FROM accounts WHERE token=?').get(fixture.accounts[0].token);
    assert(identity);
    return {accountId: identity.id, tables: Object.fromEntries(['role_profiles', 'role_records', 'inventory', 'hotkeys']
      .map(table => [table, db.prepare(`SELECT * FROM ${table} WHERE account_id=? ORDER BY rowid`).all(identity.id)]))};
  } finally {db.close();}
}
const evidence = {status: 'RUNNING', runId, ports: {server: 3638, vite: 5668, cdp: 9868},
  fixture: {fixturePath, source: checkpoint, newFundsOrOwnedInjected: false},
  nativeBefore: nativeAccount(), network: [], runtime: [], stages: [], screenshots: [], controls: [], clickedTargets: [],
  ...(first ? {unreachedTail: {firstRaw: tailPath, firstStatus: first.status, firstFailedStage: first.failedStage,
    firstSavedCheckpoint: first.savedCheckpoint, reusedSettingsClose: true, reusedHistoryClose: resumeAfterHistory,
    settingsFirstRaw: first.unreachedTail?.firstRaw ?? tailPath, historyClosedRaw: resumeAfterHistory ? tailPath : undefined, noFirstRegistration: true}} : {})};
let server, chrome, vite, ws, session, targetId, serverLog = '', sequence = 0;
const pending = new Map();
async function stop(child) {
  if (child?.exitCode === null && child.signalCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended;
  }
}
function command(method, params = {}, sessionId = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function wait(expression, label, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  evidence.failedStage = label; await observe(label + '.failed'); throw new Error('Gate timeout: ' + label);
}
async function observe(label) {
  evidence.stages.push({label, dom: await evaluate(`({page:document.querySelector('[data-entry-page]')?.dataset.entryPage,
    closed:!!document.querySelector('main[aria-label="已退出游戏"]'),lobby:!!document.querySelector('[data-room-card-home]'),
    status:document.querySelector('.source-entry-status')?.textContent,
    dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({id:e.id,label:e.getAttribute('aria-label')})),
    inputs:[...document.querySelectorAll('.source-entry-input')].map(e=>({label:e.getAttribute('aria-label'),type:e.type,disabled:e.disabled,codepoints:[...e.value].length})),
    buttons:[...document.querySelectorAll('.source-entry button')].map(e=>({label:e.getAttribute('aria-label'),source:e.dataset.sourceControl,disabled:e.disabled})),
    focus:{tag:document.activeElement?.tagName,source:document.activeElement?.dataset.sourceControl}})`)});
}
async function point(selector) {
  await command('Page.bringToFront');
  return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw new Error('Missing/disabled control');
    e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Covered control '+${JSON.stringify(selector)});return {x,y}})()`);
}
async function click(selector, double = false) {
  const location = await point(selector);
  const target = () => evaluate(`(()=>{const e=document.elementFromPoint(${location.x},${location.y}),focus=document.activeElement;
    const describe=e=>e?{tag:e.tagName,className:e.className,source:e.dataset?.sourceControl,label:e.getAttribute('aria-label'),
      dialog:e.closest('dialog')?.getAttribute('aria-label'),sourcePage:!!e.closest('.history-intro-source-page')}:null;
    return {target:describe(e),focus:describe(focus),historyOpen:!!document.querySelector('[data-history-intro-dialog][open]')};})()`);
  const record = {selector, location, before: await target()}; evidence.clickedTargets.push(record);
  await command('Input.dispatchMouseEvent', {type: 'mouseMoved', ...location});
  for (const count of double ? [1, 2] : [1]) {
    await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: count, ...location});
    await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: count, ...location});
  }
  record.after = await target();
}
async function fill(selector, text) {
  await click(selector);
  await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2});
  await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2});
  await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8});
  await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8});
  if (text) await command('Input.insertText', {text});
}
const loginControl = name => `[data-entry-page="login"] [data-source-control="${name}"]`;
const checkboxControl = '[data-entry-page="login"] input[data-source-control="chkSaveAccount"]';
const channelControl = name => `[data-entry-page="channel"] [data-source-control="${name}"]`;
const responses = name => evidence.network.filter(row => row.direction === 'received' && row.name === name);
const last = name => responses(name).filter(row => row.success).at(-1)?.response;
async function loginReady() {await wait(`document.querySelector(${JSON.stringify(loginControl('edtAccount'))})?.matches(':enabled')`, 'LoginReady');}
async function channelReady() {await wait(`document.querySelector('[data-channel-id="main"]')?.matches(':enabled')`, 'ChannelReady');}
async function storage(label) {
  const stored = await evaluate(`Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))`);
  assert(!Object.entries(stored).some(([key,value]) => /password/i.test(key) || value?.includes(password)), 'Password absent from localStorage');
  evidence.stages.push({label, storage: {...stored, 'cdtank-account-token': stored['cdtank-account-token'] ? '[retained]' : null}});
  return stored;
}
async function whole(page) {
  for (const [width, height] of [[800, 600], [1920, 1080], [3840, 2160]]) {
    await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await evaluate(`(async()=>{await document.fonts.ready;const assets=[...new Set([...document.querySelectorAll('[data-entry-page] [data-source-asset]')].map(e=>e.dataset.sourceAsset).filter(Boolean))];await Promise.all(assets.map(asset=>{const image=new Image();image.src='/'+asset;return image.decode();}));return true;})()`);
    await new Promise(resolve => setTimeout(resolve, 150));
    const controls = await evaluate(`(()=>{const root=document.querySelector('[data-entry-page="${page}"]');return [...root.querySelectorAll('button,input,.source-static-text')].map(e=>{
      const r=e.getBoundingClientRect();return {source:e.dataset.sourceControl,label:e.getAttribute('aria-label')||(e.getAttribute('role')==='option'?e.textContent:null),text:e.tagName==='INPUT'?undefined:e.textContent,
        enabled:!e.disabled,rect:{x:r.x,y:r.y,width:r.width,height:r.height},font:getComputedStyle(e).fontFamily,
        hit:r.width>0&&r.height>0?e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)):false};});})()`);
    const live = controls.filter(control => control.enabled && control.label && control.rect.width > 0);
    assert(live.length > 0 && live.every(control => control.hit && control.rect.x >= 0 && control.rect.y >= 0
      && control.rect.x + control.rect.width <= width + 1 && control.rect.y + control.rect.height <= height + 1), 'Enabled original controls reachable inside viewport');
    assert(controls.every(control => control.font.includes('CDTank-Xiangjiao')), 'Configured font on entry controls');
    evidence.controls.push({page, width, height, controls});
    const image = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    const path = `${output}-${page}-${width}x${height}-whole.png`; await writeFile(path, Buffer.from(image.data, 'base64'));
    evidence.screenshots.push(path);
  }
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
}
try {
  server = spawn(process.execPath, ['scripts/start-server.mjs'], {env: {...process.env, PORT: '3638', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => {serverLog += data;});
  const until = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < until && server.exitCode === null) await new Promise(resolve => setTimeout(resolve, 20));
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, cacheDir: join(directory, 'vite-cache'), root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5668, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3638', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9868', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let index = 0; index < 100; index++) {try {endpoint = (await (await fetch('http://127.0.0.1:9868/json/version')).json()).webSocketDebuggerUrl; break;} catch {await new Promise(resolve => setTimeout(resolve, 50));}}
  assert(endpoint); ws = new WebSocket(endpoint); await new Promise((resolve,reject) => {ws.once('open',resolve);ws.once('error',reject);});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw)), request = pending.get(message.id);
    if (request) {pending.delete(message.id); message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);}
    if (message.method === 'Runtime.exceptionThrown') evidence.runtime.push(message.params);
    if (!['Network.webSocketFrameReceived', 'Network.webSocketFrameSent'].includes(message.method)) return;
    try {
      const frame = message.params.response; if (frame.opcode !== 2) return;
      const bytes = new Uint8Array(Buffer.from(frame.payloadData, 'base64')); if (bytes.length === 1 && bytes[0] === 0) return;
      const received = message.method.endsWith('Received'); let parsed;
      if (received) parsed = TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes);
      else {
        const envelope = TransportDataUtil.tsbuffer.decode(bytes, 'ServerInputData'); assert(envelope.isSucc);
        const service = decoder.serviceMap.id2Service[envelope.value.serviceId];
        const payload = decoder.tsbuffer.decode(envelope.value.buffer, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId); assert(payload.isSucc);
        parsed = {isSucc: true, result: {service, req: payload.value}};
      }
      assert(parsed.isSucc); const row = parsed.result;
      if (row.service.type !== 'api') return;
      const payload = structuredClone(received ? row.ret.isSucc ? row.ret.res : row.ret.err : row.req);
      if (payload.token) payload.token = '[retained]'; if (payload.credentials?.password) payload.credentials.password = '[redacted]';
      evidence.network.push({name: row.service.name, direction: received ? 'received' : 'sent',
        ...(received ? {success: row.ret.isSucc, response: payload} : {payload})});
    } catch(error) {evidence.decodeError = String(error);}
  });
  const context = await command('Target.createBrowserContext', {}, undefined);
  ({targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId: context.browserContextId}, undefined));
  ({sessionId: session} = await command('Target.attachToTarget', {targetId, flatten: true}, undefined));
  for (const domain of ['Page', 'Runtime', 'Network']) await command(domain + '.enable');
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('cdtank-account-token',${JSON.stringify(fixture.accounts[0].token)});`});
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
  await command('Page.navigate', {url: 'http://127.0.0.1:5668/'}); await loginReady(); await observe('initialLogin');
  if (!first) {
    await click(loginControl('btnSettings')); await wait(`document.querySelector('#source-settings[open] [data-settings-cancel]')?.matches(':enabled')`, 'SettingsReady');
    await click('[data-settings-cancel]'); await wait(`!document.querySelector('#source-settings[open]')`, 'SettingsClose');
  } else evidence.stages.push({label: 'SettingsClose.reusedFirst', firstRaw: tailPath});
  if (!resumeAfterHistory) {
  await click(loginControl('btnHistory'));
  const historyClose = '[data-history-intro-dialog][open] .history-intro-source-page [data-history-intro-close]';
  await wait(`document.querySelector(${JSON.stringify(historyClose)})?.matches(':enabled')`, 'HistorySourceControlReady');
  await observe('HistorySourceControlReady');
  await click(historyClose); await wait(`!document.querySelector('[data-history-intro-dialog][open]')`, 'HistoryClose');
  await observe('HistorySourceControlClosed');
  } else evidence.stages.push({label: 'HistorySourceControlClosed.reused', firstRaw: tailPath});
  evidence.settingsAndIntroClosed = true;
  await fill(loginControl('edtAccount'), account); await fill(loginControl('edtPassword'), password);
  await click(checkboxControl); assert.equal(await evaluate(`document.querySelector(${JSON.stringify(checkboxControl)}).checked`), true);
  await whole('login'); await click(loginControl('btnRegister')); await channelReady();
  assert.equal(last('Account').accountId, evidence.nativeBefore.accountId); assert.equal(last('Account').accountName, account);
  evidence.registration = last('Account'); const saved = await storage('registeredSaved');
  assert.equal(saved['cdtank-login-account'], account); assert.equal(saved['cdtank-login-save-account'], 'true');
  assert.deepEqual(last('Channel').channels.map(channel => channel.id), ['main']); await whole('channel');
  await click(channelControl('btnBack')); await loginReady(); await fill(loginControl('edtPassword'), 'WrongPassword');
  const rejectedCount = responses('Account').length; await click(loginControl('btnLogin'));
  await wait(`document.querySelector('.source-entry-status')?.textContent.includes('账号或密码错误')&&document.querySelector(${JSON.stringify(loginControl('edtPassword'))})?.matches(':enabled')`, 'WrongPasswordRejected');
  assert.equal(responses('Account').length, rejectedCount + 1); assert.equal(responses('Account').at(-1).success, false);
  evidence.wrongPassword = responses('Account').at(-1); await fill(loginControl('edtPassword'), password);
  await click(loginControl('btnLogin')); await channelReady(); assert.equal(last('Account').accountId, evidence.nativeBefore.accountId);
  await click(channelControl('btnBack')); await loginReady(); await click(checkboxControl);
  await fill(loginControl('edtPassword'), password); await click(loginControl('btnLogin')); await channelReady();
  const unsaved = await storage('uncheckedAuthenticated'); assert.equal(unsaved['cdtank-login-account'], ''); assert.equal(unsaved['cdtank-login-save-account'], 'false');
  await click(channelControl('btnClose')); await wait(`!!document.querySelector('main[aria-label="已退出游戏"] button')`, 'Closed'); await observe('closed');
  await click('main[aria-label="已退出游戏"] button'); await loginReady();
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(loginControl('edtAccount'))}).value`), '');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(loginControl('edtPassword'))}).value`), '');
  await click(loginControl('btnLogin')); await channelReady();
  assert.equal(last('Account').accountId, evidence.nativeBefore.accountId);
  assert.equal(evidence.network.filter(row => row.direction === 'sent' && row.name === 'Account').at(-1).payload.credentials, undefined);
  evidence.tokenRestore = last('Account'); await storage('tokenRestored');
  await click('[data-channel-id="main"]', true);
  await wait(`document.querySelector('[data-room-card-home]')?.matches(':enabled')`, 'LobbyEntered');
  assert.equal(last('Channel').enteredChannelId, 'main'); assert.equal(await evaluate(`!!document.querySelector('[data-entry-page]')`), false);
  const priorInventory = responses('Inventory').length, priorProfile = responses('RoleProfile').length;
  await click('[data-room-card-home]'); await wait(`document.querySelector('#home-inventory[open] [data-home-close]')?.matches(':enabled')`, 'HomeReady');
  const homeUntil = Date.now() + 45000;
  while ((responses('Inventory').length <= priorInventory || responses('RoleProfile').length <= priorProfile) && Date.now() < homeUntil) await new Promise(resolve => setTimeout(resolve, 50));
  assert(responses('Inventory').length > priorInventory && responses('RoleProfile').length > priorProfile, 'Home opening confirmed full queries');
  assert(last('Inventory') && last('RoleProfile')); evidence.home = {inventory: last('Inventory'), roleProfile: last('RoleProfile')};
  assert.deepEqual(Buffer.from(evidence.home.roleProfile.profile.bytes), Buffer.from(evidence.nativeBefore.tables.role_profiles[0].payload));
  await click('[data-home-close]'); await wait(`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`, 'HomeStrictClose');
  evidence.strictClose = true; await observe('finalLobby'); evidence.nativeAfter = nativeAccount(); assert.deepEqual(evidence.nativeAfter, evidence.nativeBefore);
  assert.equal(evidence.runtime.length, 0); assert.equal(evidence.decodeError, undefined);
  const writes = evidence.network.filter(row => row.direction === 'sent' && ['BUY','LEARN','MAINTAIN','SELL','EQUIP','UNEQUIP'].includes(row.payload?.operation)); assert.equal(writes.length, 0);
  evidence.status = 'PASS_FINITE_SOURCE_LOGIN_REGISTER_SAVED_ACCOUNT_PASSWORD_REJECT_TOKEN_RESTORE_CHANNEL_ENTER_HOME_CLOSE_SCOPE'; console.log('PASS ' + output);
} catch(error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
finally {
  if (session && ws?.readyState === WebSocket.OPEN) {try {await observe('finally'); await storage('finallyStorage');} catch(error) {evidence.finalObservationError = String(error);}}
  try {
    const db = new DatabaseSync(database, {readOnly: true});
    try {evidence.savedCheckpoint = output + '-checkpoint.sqlite'; await backup(db, evidence.savedCheckpoint); await chmod(evidence.savedCheckpoint, 0o600);} finally {db.close();}
    await writeFile(output + '-checkpoint-fixture.json', JSON.stringify({database: evidence.savedCheckpoint, accounts: fixture.accounts, source: checkpoint}) + '\n', {mode: 0o600});
  } catch(error) {evidence.checkpointError = String(error);}
  if (ws?.readyState === WebSocket.OPEN) {if (targetId) await command('Target.closeTarget', {targetId}).catch(() => {}); ws.close();}
  await vite?.close(); await stop(server); await stop(chrome); await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  evidence.processCleanup = {chromeStopped: !chrome || chrome.exitCode !== null || chrome.signalCode !== null,
    serverStopped: !server || server.exitCode !== null || server.signalCode !== null, viteClosed: true, tempRemoved: true};
  await writeFile(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
}
