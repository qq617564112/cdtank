import {spawn} from 'node:child_process';
import {access, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import WebSocket from 'ws';

var workspace = fileURLToPath(new URL('../', import.meta.url));
var output = resolve(workspace, 'apps/web/src/assets/tanks/thumbnails');
var overviewOutput = resolve(workspace, 'recovery/output/tank-thumbnails-overview.png');
var assets = resolve(workspace, process.env.CDTANK_WEB_ASSETS ?? 'recovery/output/web-assets');

async function chromiumPath() {
  if (process.env.CDTANK_CHROME) {
    await access(process.env.CDTANK_CHROME);
    return process.env.CDTANK_CHROME;
  }
  var cache = join(homedir(), '.cache/ms-playwright');
  var versions = await readdir(cache).catch(() => []);
  var candidates = versions.filter(name => name.startsWith('chromium-')).sort().reverse()
    .flatMap(name => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(binary => join(cache, name, binary)));
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  for (var candidate of candidates) {
    try {await access(candidate); return candidate;} catch {}
  }
  throw new Error('未找到 Chromium，请用 CDTANK_CHROME 指定浏览器可执行文件。');
}

async function browserEndpoint(chrome) {
  return new Promise((resolveEndpoint, reject) => {
    var timer = setTimeout(() => finish(new Error('Chromium 启动超时')), 30000);
    var log = '';
    var onData = chunk => {
      log += String(chunk);
      var match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(log);
      if (match) finish(undefined, match[1]);
    };
    var onExit = () => finish(new Error(`Chromium 启动失败：${log}`));
    var finish = (error, endpoint) => {
      clearTimeout(timer);
      chrome.stderr.removeListener('data', onData);
      chrome.removeListener('exit', onExit);
      chrome.removeListener('error', finish);
      error ? reject(error) : resolveEndpoint(endpoint);
    };
    chrome.stderr.on('data', onData);
    chrome.once('exit', onExit);
    chrome.once('error', finish);
  });
}

async function stopChrome(chrome) {
  if (!chrome?.pid || chrome.exitCode !== null || chrome.signalCode !== null) return;
  await new Promise(resolveExit => {chrome.once('exit', resolveExit); chrome.kill();});
}

async function main() {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/render-tank-thumbnails.mjs');
  var executable = await chromiumPath();
  var catalog = JSON.parse(await readFile(join(assets, 'tanks.json'), 'utf8'));
  var shop = JSON.parse(await readFile(join(workspace, 'recovery/output/verified/tables/tankshop.json'), 'utf8'));
  var tanks = catalog.map(tank => {
    var values = shop.rows.find(row => Number(row.values['坦克ID']) === tank.id)?.values;
    return {id: tank.id, name: tank.name, textures: {
      U: Number(values?.['默认贴图(炮塔)'] ?? 0),
      M: Number(values?.['默认贴图(车身)'] ?? 0),
      XY: Number(values?.['默认贴图(履带)'] ?? 0),
    }};
  });
  var temporary = await mkdtemp(join(tmpdir(), 'cdtank-thumbnails-'));
  var vite, chrome, socket;
  var sequence = 0, pending = new Map();
  function command(method, params = {}, sessionId) {
    return new Promise((resolveCommand, reject) => {
      var id = ++sequence;
      var timer = setTimeout(() => {pending.delete(id); reject(new Error(`CDP 超时：${method}`));}, 60000);
      pending.set(id, {resolve: resolveCommand, reject, timer});
      socket.send(JSON.stringify({id, method, params, sessionId}));
    });
  }
  async function evaluate(sessionId, expression) {
    var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  function pngBytes(dataUrl) {
    if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('Viewer 未返回 PNG');
    return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  }
  try {
    vite = await createServer({configFile: false, root: workspace, publicDir: assets,
      cacheDir: join(temporary, 'vite'), optimizeDeps: {entries: ['scripts/tank-thumbnail-viewer/index.html']},
      server: {host: '127.0.0.1', port: 0, hmr: false}});
    await vite.listen();
    var origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    chrome = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=0',
      `--user-data-dir=${join(temporary, 'chrome')}`, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});
    var endpoint = await browserEndpoint(chrome);
    socket = new WebSocket(endpoint);
    await new Promise((resolveOpen, reject) => {socket.once('open', resolveOpen); socket.once('error', reject);});
    socket.on('message', raw => {
      var message = JSON.parse(String(raw)), callback = pending.get(message.id);
      if (!callback) return;
      pending.delete(message.id); clearTimeout(callback.timer);
      message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
    });
    var {targetId} = await command('Target.createTarget', {url: 'about:blank'});
    var {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
    await command('Page.enable', {}, sessionId);
    await command('Runtime.enable', {}, sessionId);
    await command('Page.navigate', {url: `${origin}/scripts/tank-thumbnail-viewer/index.html`}, sessionId);
    var ready = false;
    for (var attempt = 0; attempt < 120 && !ready; attempt++) {
      ready = await evaluate(sessionId, 'Boolean(window.tankThumbnailViewer)');
      if (!ready) await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
    }
    if (!ready) throw new Error('坦克 Viewer 载入超时');
    await mkdir(output, {recursive: true});
    console.log(`渲染 ${tanks.length} 种战车：45° 俯视，1024 × 1024 采样 → 512 × 512 透明 PNG`);
    for (var tank of tanks) {
      var png = await evaluate(sessionId, `window.tankThumbnailViewer.render(${JSON.stringify(tank)}, 512)`);
      var filename = `${String(tank.id).padStart(3, '0')}.png`;
      await writeFile(join(output, filename), pngBytes(png));
      console.log(`${filename} ${tank.name}`);
    }
    var entries = tanks.map(tank => {
      var id = String(tank.id).padStart(3, '0');
      return `  '${id}': new URL('./${id}.png', import.meta.url).href,`;
    });
    await writeFile(join(output, 'index.ts'),
      `export const tankThumbnails: Readonly<Record<string, string>> = {\n${entries.join('\n')}\n};\n`);
    await mkdir(resolve(overviewOutput, '..'), {recursive: true});
    await writeFile(overviewOutput, pngBytes(await evaluate(sessionId, 'window.tankThumbnailViewer.overview()')));
    console.log(`缩略图：${output}\n总览：${overviewOutput}`);
  } finally {
    for (var callback of pending.values()) clearTimeout(callback.timer);
    socket?.close();
    await stopChrome(chrome);
    await vite?.close();
    await rm(temporary, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
