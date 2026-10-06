import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-history-browser-'));
const fixture = process.env.CDTANK_HISTORY_FIXTURE ? JSON.parse(await readFile(process.env.CDTANK_HISTORY_FIXTURE, 'utf8')) : undefined;
const database = process.env.CDTANK_HISTORY_DB ?? fixture?.database ?? join(directory, 'accounts.sqlite');
const expectedCount = Number(process.env.CDTANK_HISTORY_EXPECTED_COUNT ?? fixture?.expectedCount ?? 0);
const token = process.env.CDTANK_HISTORY_TOKEN ?? fixture?.token;
const evidence = {status: 'RUNNING', scope: 'M5-15-H actual authenticated history window; actual persisted pagination/loading checks', checks: [], expectedCount};
let server, chrome, vite, ws, session, store, tokenScript;
const output=process.env.CDTANK_HISTORY_OUTPUT ?? 'recovery/output/browser-account-history';
let serverLog = '', sequence = 0;
const pending = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop(child) {
  if (child?.exitCode === null && child.signalCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await ended;
  }
}
async function startServer() {
  serverLog = '';
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3158', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
}
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, ...(session ? {sessionId: session} : {})}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(expression) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error('History condition timeout: ' + expression);
}
async function click(selector) {
  await waitUntil(`!!document.querySelector(${JSON.stringify(selector)})`);
  const point = await evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point});
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point});
}
const rows = `[...document.querySelectorAll('#account-history [data-history-match]')].map(r=>({id:r.dataset.historyMatch,text:r.textContent}))`;
const loaded = `document.querySelector('#account-history')?.open&&document.querySelector('#account-history')?.getAttribute('aria-busy')==='false'&&!document.querySelector('[data-history-status]').value.includes('失败')`;
async function screenshot(name) {
  const result = await command('Page.captureScreenshot', {format: 'png'});
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
try {
  await startServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets', server: {
    port: 5205, strictPort: true, host: '127.0.0.1', hmr: false,
    proxy: {'/game': {target: 'ws://127.0.0.1:3158', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9277', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9277/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chrome failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw)); const callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
  });
  const {targetId} = await command('Target.createTarget', {url: 'about:blank'});
  ({sessionId: session} = await command('Target.attachToTarget', {targetId, flatten: true}));
  await command('Page.enable');
  if (token) ({identifier:tokenScript}=await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('cdtank-account-token',${JSON.stringify(token)})`}));
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
  await command('Page.navigate', {url: 'http://127.0.0.1:5205'});
  await waitUntil(`document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')`);
  if (token) {
    const tokenMatched = await evaluate(`localStorage.getItem('cdtank-account-token')===${JSON.stringify(token)}`);
    assert.equal(tokenMatched, true, 'Normal Web session must use the existing fixture account');
    evidence.checks.push({name: 'existing fixture account token reused', tokenMatched});
  }
  await click('#open-history'); await waitUntil(loaded);
  const initial = await evaluate(rows);
  assert.equal(initial.length, Math.min(20, expectedCount));
  assert.equal(await evaluate(`document.querySelector('[data-history-status]').value`), expectedCount ? `共 ${expectedCount} 场已保存比赛` : '还没有已保存的对局记录');
  evidence.checks.push({name: 'normal authenticated query', rows: initial});
  await screenshot('1080');
  await click('[data-history-close]');
  assert.equal(await evaluate(`!!document.querySelector('#account-history')?.open`), false);
  await click('#open-history'); await waitUntil(loaded); assert.deepEqual(await evaluate(rows), initial);
  await click('[data-history-refresh]'); await waitUntil(loaded); assert.deepEqual(await evaluate(rows), initial);
  await stop(server);
  await click('[data-history-refresh]');
  await waitUntil(`document.querySelector('[data-history-status]').value.includes('失败')&&!document.querySelector('[data-history-refresh]').disabled`);
  assert.deepEqual(await evaluate(rows),initial,'Failed refresh preserves confirmed rows');
  evidence.checks.push({name: 'visible server failure with retry', text: await evaluate(`document.querySelector('[data-history-status]').value`)});
  await startServer();
  await click('[data-history-refresh]'); await waitUntil(loaded); assert.deepEqual(await evaluate(rows), initial);
  await command('Page.reload');
  await waitUntil(`document.querySelector('#tank')?.options.length===21`);
  await click('#open-history'); await waitUntil(loaded); assert.deepEqual(await evaluate(rows), initial);
  evidence.checks.push({name: 'close/reopen/refresh/restart/page reload preserves server records'});
  await command('Emulation.setDeviceMetricsOverride', {width: 3840, height: 2160, deviceScaleFactor: 1, mobile: false});
  const layout = await evaluate(`(()=>{const r=document.querySelector('#account-history').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight}};})()`);
  assert(layout.x >= 0 && layout.y >= 0 && layout.x + layout.width <= layout.viewport.width && layout.y + layout.height <= layout.viewport.height);
  evidence.checks.push({name: '4K scale1 visible dialog controls', layout}); await screenshot('4k');
  await click('[data-history-close]');
  store=new AccountStore(database);
  const owner=store.open(await evaluate(`localStorage.getItem('cdtank-account-token')`));
  // Explicit persistence fixture adds twenty-one records; it does not claim natural matches.
  for(let i=0;i<21;i++)store.recordMatchHistory({matchId:'react-pagination-'+i,round:1,mode:4,mapId:7,
    endedAt:Date.now()+i,reason:'TIME_LIMIT'},[{accountId:owner.accountId,result:{id:'fixture',name:'分页夹具',team:0,
    rank:1,kills:2,deaths:3,objectivesDestroyed:0,combatScore:4,outcomeBonus:5,totalScore:9,outcome:'WIN'}}]);
  await click('#open-history');await waitUntil(loaded);
  const first=await evaluate(rows);assert.equal(first.length,20);
  const confirmedPage=await evaluate(`document.querySelector('[data-history-page]').textContent`);
  await stop(server);
  await click('[data-history-refresh]');
  await waitUntil(`document.querySelector('[data-history-status]').value.includes('失败')&&!document.querySelector('[data-history-refresh]').disabled`);
  assert.deepEqual(await evaluate(rows),first,'Failed refresh preserves twenty confirmed records');
  assert.equal(await evaluate(`document.querySelector('[data-history-page]').textContent`),confirmedPage);
  evidence.checks.push({name:'failed refresh retains twenty confirmed rows and page',rows:first.length,page:confirmedPage});
  await startServer();await click('[data-history-refresh]');await waitUntil(loaded);
  assert.deepEqual(await evaluate(rows),first);
  await click('[data-history-next]');await waitUntil(loaded);
  const second=await evaluate(rows);assert.equal(second.length,expectedCount+1);
  assert.equal(await evaluate(`document.querySelector('[data-history-next]').disabled`),true);
  await click('[data-history-previous]');await waitUntil(loaded);assert.deepEqual(await evaluate(rows),first);
  evidence.checks.push({name:'real authenticated 20-record pagination',fixture:'AccountStore.recordMatchHistory 21 explicit records',first,second});
  server.kill('SIGSTOP');
  await click('[data-history-refresh]');
  await waitUntil(`document.querySelector('#account-history')?.getAttribute('aria-busy')==='true'`);
  await click('[data-history-close]');await waitUntil(`!document.querySelector('#account-history')?.open`);
  await click('#open-history');
  server.kill('SIGCONT');await waitUntil(loaded);assert.deepEqual(await evaluate(rows),first);
  evidence.checks.push({name:'pending close/reopen isolates old response and new query'});
  await click('[data-history-close]');
  if(tokenScript)await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:tokenScript});
  await evaluate(`localStorage.removeItem('cdtank-account-token')`);await command('Page.reload');
  await waitUntil(`document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')`);
  await click('#open-history');await waitUntil(loaded);assert.deepEqual(await evaluate(rows),[]);
  assert.equal(await evaluate(`document.querySelector('[data-history-status]').value`),'还没有已保存的对局记录');
  evidence.checks.push({name:'new account empty state and isolation'});
  await click('[data-history-close]');
  const alternate=store.open(await evaluate(`localStorage.getItem('cdtank-account-token')`));
  store.replaceRoleProfile(alternate.accountId,{bytes:new Uint8Array(0x170),strings:['','']});
  await click('#open-shop');await waitUntil(`document.querySelector('[data-shop-buy]')&&!document.querySelector('[data-shop-buy]').disabled`);
  await evaluate(`(async()=>{const {AccountConnection}=await import('/src/network/accounts.ts');window.pendingShopCalls=[];const original=AccountConnection.prototype.shop;AccountConnection.prototype.shop=function(req){window.pendingShopCalls.push({...req});return original.call(this,req);};})()`);
  server.kill('SIGSTOP');await click('[data-shop-buy]');
  await waitUntil(`document.querySelector('[data-shop-buy]').disabled`);
  await click('[data-shop-close]');await waitUntil(`!document.querySelector('#account-shop')`);
  await click('#open-shop');server.kill('SIGCONT');
  await waitUntil(`document.querySelector('[data-shop-balance]')?.textContent.includes('金币：0')&&!document.querySelector('[data-shop-buy]').disabled`);
  assert.equal(await evaluate(`window.pendingShopCalls.filter(req=>req.operation==='BUY').length`),1);
  assert(!await evaluate(`document.querySelector('[data-shop-status]').value.includes('余额不足')`));
  assert.deepEqual(store.inventory(alternate.accountId).records,[]);
  evidence.checks.push({name:'active BUY pending close/reopen isolates rejection, one request, confirmed zero wallet'});
  await click('[data-shop-close]');

  await evaluate(`localStorage.setItem('cdtank-account-token',${JSON.stringify(owner.token)})`);
  await stop(server);await startServer();await command('Page.reload');
  await waitUntil(`document.querySelector('#tank')?.options.length===21`);
  await click('#open-history');await waitUntil(loaded);assert.deepEqual(await evaluate(rows),first);
  evidence.checks.push({name:'paginated records restore after real server restart'});
  evidence.status = 'PASS';
  evidence.isolation = {server: 3158, vite: 5205, chrome: 9277};
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log('PASS: actual account history query/reopen/refresh/failure/restart/reload, 1080/4K and persisted pagination/loading controls');
} catch (error) {
  await writeFile(`${output}.json`, JSON.stringify({...evidence, status: 'FAIL', error: String(error), stack: error.stack, serverLog}, null, 2) + '\n');
  throw error;
} finally {
  store?.close();if(server?.exitCode===null)server.kill('SIGCONT');ws?.close(); await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
}
