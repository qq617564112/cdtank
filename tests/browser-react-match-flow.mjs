import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Run the existing business fixtures unchanged and retain their complete output.
var output = 'recovery/output';
var run = new Date().toISOString().replace(/[:.]/g, '-');
var prefix = `${output}/react-match-${run}`;
var uiOnly = process.argv.includes('--ui-only');
var healingOnly = process.argv.includes('--healing-only');
var disconnectOnly = process.argv.includes('--disconnect-only');
var reentryOnly = process.argv.includes('--reentry-only');
var from = process.argv.find(argument => argument.startsWith('--from='))?.slice(7);
assert([uiOnly, healingOnly, disconnectOnly, reentryOnly].filter(Boolean).length <= 1, 'Choose one subset');
await mkdir(output, {recursive: true});
var result = {status: 'RUNNING', run, startedAt: new Date().toISOString(), fixtures: []};
var chrome;
var directory;
var fixtures = [
  {name: 'create-dialog', file: 'browser-room-create-dialog.mjs', artifact: 'browser-room-create-dialog'},
  {name: 'room-cards', file: 'browser-room-cards.mjs', artifact: 'browser-room-cards'},
  {name: 'waiting-room', file: 'browser-waiting-room.mjs', artifact: 'browser-waiting-room'},
  {name: 'map-selector', file: 'browser-room-map-selector.mjs', artifact: 'browser-room-map-selector'},
  {name: 'room-invitations', file: 'browser-room-invitations.mjs', artifact: 'browser-room-invitations'},
  {name: 'healing-reentry', file: 'browser-healing-item.mjs', artifact: 'browser-healing-item-hd'},
  {name: 'disconnect', file: 'browser-react-disconnect.mjs', artifact: 'react-match-disconnect'},
].filter(fixture => uiOnly ? !['healing-reentry', 'disconnect'].includes(fixture.name) : healingOnly ? fixture.name === 'healing-reentry' : disconnectOnly ? fixture.name === 'disconnect' : true);
if (reentryOnly) fixtures = [{name: 'healing-continuation', file: 'browser-healing-item.mjs', artifact: 'browser-healing-item-hd-reentry-only'}];
if (from) {
  var index = fixtures.findIndex(fixture => fixture.name === from);
  assert(index >= 0, 'Unknown starting fixture');
  fixtures = fixtures.slice(index);
}

async function stopChrome() {
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    var ended = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await ended;
  }
  if (directory) await rm(directory, {recursive: true, force: true});
}

async function healingEndpoint() {
  directory = await mkdtemp(join(tmpdir(), 'cdtank-react-match-'));
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9361',
    `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  for (var attempt = 0; attempt < 100; attempt++) {
    try {
      return (await (await fetch('http://127.0.0.1:9361/json/version')).json()).webSocketDebuggerUrl;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw new Error('Dedicated Chromium on port 9361 failed to start');
}

async function runFixture(fixture) {
  var args = ['--import', 'tsx', `tests/${fixture.file}`];
  if (['healing-reentry', 'healing-continuation'].includes(fixture.name)) args.push(await healingEndpoint(), '--hd', reentryOnly ? '--reentry-only' : '--reentry');
  var started = Date.now();
  var log = '';
  var child = spawn(process.execPath, args, {env: process.env, stdio: ['ignore', 'pipe', 'pipe']});
  for (var stream of [child.stdout, child.stderr]) stream.on('data', data => {
    log += String(data);
    process.stdout.write(data);
  });
  var exit = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({code, signal}));
  });
  var logPath = `${prefix}-${fixture.name}.log`;
  await writeFile(logPath, log);
  var artifacts = [];
  for (var name of await readdir(output)) {
    if (!(name === `${fixture.artifact}.json` || name.startsWith(`${fixture.artifact}-`) || name === `${fixture.artifact}.log`)) continue;
    var source = join(output, name);
    if ((await stat(source)).mtimeMs < started) continue;
    var target = `${prefix}-${fixture.name}${name.slice(fixture.artifact.length)}`;
    if (target === logPath) target = `${prefix}-${fixture.name}-server.log`;
    await copyFile(source, target);
    artifacts.push(target);
  }
  var evidence = JSON.parse(await readFile(`${output}/${fixture.artifact}.json`, 'utf8'));
  var row = {name: fixture.name, command: [process.execPath, ...args], ...exit,
    elapsedMs: Date.now() - started, status: evidence.status, logPath, artifacts};
  result.fixtures.push(row);
  await writeFile(`${prefix}.json`, JSON.stringify(result, null, 2) + '\n');
  assert.equal(exit.code, 0, `${fixture.name}: see ${logPath}`);
  assert.equal(evidence.status, 'PASS', `${fixture.name}: fixture evidence did not pass`);
  assert(log.includes('PASS:'), `${fixture.name}: original PASS output missing`);
}

try {
  var mainSource = await readFile('apps/web/src/main.ts', 'utf8');
  assert.equal((mainSource.match(/\bcreateRoot\(/g) ?? []).length, 1);
  var viewFiles = ['app.tsx', 'interface/lobby/room-controls.tsx', 'interface/lobby/room-cards.tsx',
    'interface/lobby/room-create-dialog.tsx', 'interface/lobby/room-map-selector.tsx',
    'interface/lobby/room-invitations.tsx', 'interface/lobby/waiting-room.tsx', 'interface/battle/battle-match.tsx'];
  for (var file of viewFiles) {
    var source = await readFile(`apps/web/src/${file}`, 'utf8');
    assert(!/document\.createElement\(|\.innerHTML\s*=/.test(source), `${file}: imperative view construction`);
  }
  result.reactBoundary = {singleRoot: 'apps/web/src/main.ts', jsxViews: viewFiles,
    scope: 'Source boundary evidence alongside the real business fixtures.'};
  for (var fixture of fixtures) await runFixture(fixture);
  result.status = 'PASS';
  result.scope = fixtures.map(fixture => fixture.name === 'disconnect' ?
    'Real server shutdown, resource cleanup, React return and normal WAITING reentry.' : fixture.name === 'healing-continuation' ?
    'Restored prior verified account quantity fixture, actual save/restart, ordinary two-page final healing and zero-stock persistence; no natural rounds in this subset.' : fixture.name === 'healing-reentry' ?
    'Two normal webpages, two natural rounds, Digit5 healing, Effect11/GA15, rematch and restart/reentry at 1080p.' :
    `${fixture.name} original source UI fixture at 1080p/4K.`).join(' ');
  console.log(`PASS: React match business fixture subset (${fixtures.map(fixture => fixture.name).join(', ')})`);
} catch (error) {
  result.status = 'FAIL';
  result.error = String(error);
  throw error;
} finally {
  await stopChrome();
  result.finishedAt = new Date().toISOString();
  await writeFile(`${prefix}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(`Evidence: ${prefix}.json`);
}
