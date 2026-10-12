import {spawn, spawnSync} from 'node:child_process';
import {createWriteStream, existsSync, readFileSync, writeFileSync} from 'node:fs';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

/**
 * Downloads one versioned archive without buffering the whole asset package.
 * @param {string} url
 * @param {string} destination
 * @return {Promise<void>}
 */
export async function downloadArchive(url, destination) {
  console.log(`下载：${url}`);
  var response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${response.statusText}（${url}）`);
  var stream = Readable.fromWeb(response.body);
  var total = Number(response.headers.get('content-length'));
  var received = 0;
  var lastProgress = 0;
  stream.on('data', chunk => {
    received += chunk.length;
    var progress = total > 0 ? Math.floor(received / total * 10) : 0;
    if (progress > lastProgress) {
      lastProgress = progress;
      console.log(`下载进度：${progress * 10}%`);
    }
  });
  await pipeline(stream, createWriteStream(destination));
}

/** Installs matching public assets and runtime dependencies, then runs the game. */
async function installRelease() {
  var nodeVersion = process.versions.node.split('.').map(Number);
  if (nodeVersion[0] < 24 || (nodeVersion[0] === 24 && nodeVersion[1] < 16)) {
    throw new Error('请安装 Node.js 24.16 或更高版本。');
  }
  var release = fileURLToPath(new URL('./', import.meta.url));
  var metadata = JSON.parse(readFileSync(resolve(release, 'release.json'), 'utf8'));
  var localArchive;
  var browser = true;
  var arguments_ = process.argv.slice(2);
  for (var index = 0; index < arguments_.length; index++) {
    if (arguments_[index] === '--no-browser') browser = false;
    else if (arguments_[index] === '--archive' && arguments_[index + 1]) {
      localArchive = resolve(arguments_[++index]);
    } else throw new Error('Usage: node install.mjs [--no-browser] [--archive <assets.tar.gz>]');
  }
  var port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1 至 65535 的整数。');

  function run(command, args, cwd = release) {
    var result = spawnSync(command, args, {cwd, stdio: 'inherit',
      shell: process.platform === 'win32' && command === 'npm.cmd'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 失败。`);
  }
  function installed(marker, directory) {
    return existsSync(marker) && readFileSync(marker, 'utf8').trim() === metadata.version
      && existsSync(directory);
  }

  var assetsMarker = resolve(release, '.assets-version');
  var web = resolve(release, 'web');
  if (localArchive || !installed(assetsMarker, resolve(web, 'manifests/sprite-images.json'))) {
    run('tar', ['--version']);
    if (localArchive && !existsSync(localArchive)) throw new Error(`资产包不存在：${localArchive}`);
    var temporary = await mkdtemp(join(tmpdir(), 'cdtank-release-'));
    try {
      var archive = localArchive ?? join(temporary, metadata.assets);
      if (!localArchive) {
        await downloadArchive(`https://github.com/${metadata.repository}/releases/download/${metadata.tag}/${metadata.assets}`, archive);
      }
      await rm(assetsMarker, {force: true});
      await mkdir(web, {recursive: true});
      console.log(`安装 ${metadata.version} 资产……`);
      run('tar', ['-xzf', archive, '-C', web, '--strip-components=1']);
      for (var filename of ['sprite-images.json', 'battle-artwork.json', 'ui.json']) {
        if (!existsSync(resolve(web, 'manifests', filename))) throw new Error(`资产包缺少 manifests/${filename}`);
      }
      writeFileSync(assetsMarker, metadata.version + '\n');
    } finally {
      await rm(temporary, {recursive: true, force: true});
    }
  }
  var dependenciesMarker = resolve(release, '.dependencies-version');
  var server = resolve(release, 'server');
  if (!installed(dependenciesMarker, resolve(server, 'node_modules'))) {
    await rm(dependenciesMarker, {force: true});
    console.log('安装服务端运行依赖……');
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--ignore-scripts'], server);
    writeFileSync(dependenciesMarker, metadata.version + '\n');
  }

  // Avoid opening an unrelated service when the chosen port is already occupied.
  await new Promise((resolve_, reject) => {
    var probe = createServer();
    probe.once('error', error => reject(new Error(`端口 ${port} 无法使用：${error.message}。请设置 PORT 后重试。`)));
    probe.listen(port, () => probe.close(resolve_));
  });
  var url = `http://localhost:${port}/`;
  var child = spawn(process.execPath, [resolve(server, 'server/src/index.js')], {
    cwd: release, stdio: 'inherit', env: {...process.env,
      CONTENT_TABLES: process.env.CONTENT_TABLES ?? resolve(release, 'content/tables'),
      SERVER_ASSETS: process.env.SERVER_ASSETS ?? resolve(release, 'content/assets'),
      WEB_ASSETS: process.env.WEB_ASSETS ?? web,
      WEB_ROOT: process.env.WEB_ROOT ?? web,
      ACCOUNT_DB_PATH: process.env.ACCOUNT_DB_PATH ?? resolve(release, 'state/accounts.sqlite')},
  });
  var stopped = false;
  var exited = false;
  var result;
  var exitPromise = new Promise(resolve_ => {
    child.once('error', error => {
      exited = true;
      result = {code: 1, error};
      resolve_(result);
    });
    child.once('exit', (code, signal) => {
      exited = true;
      result = {code: code ?? (stopped ? 0 : 1), signal};
      resolve_(result);
    });
  });
  function stop(signal) {
    stopped = true;
    child.kill(signal);
  }
  var interrupt = () => stop('SIGINT');
  var terminate = () => stop('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    var ready = false;
    var deadline = Date.now() + 60000;
    while (!exited && !stopped && Date.now() < deadline) {
      try {
        var response = await fetch(url, {signal: AbortSignal.timeout(1000)});
        ready = response.ok;
        await response.body?.cancel();
        if (ready) break;
      } catch (_) {
        // The HTTP listener becomes available after server initialization.
      }
      await delay(500);
    }
    if (stopped) return;
    if (!ready || exited) throw result?.error ?? new Error('服务器未能启动，请查看上方日志。');
    console.log(`游戏已启动：${url}（Ctrl+C 停止服务）`);
    if (browser) openBrowser(url);
    result = await exitPromise;
    if (result.error) throw result.error;
    process.exitCode = result.code;
  } finally {
    if (!exited) {
      child.kill('SIGTERM');
      await exitPromise;
    }
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
  }
}

/** @param {string} url */
function openBrowser(url) {
  var command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  var args = process.platform === 'win32' ? ['/d', '/c', 'start', '', url] : [url];
  var child = spawn(command, args, {stdio: 'ignore', detached: true, windowsHide: true});
  child.once('error', () => console.log(`请在浏览器中打开：${url}`));
  child.once('exit', code => {
    if (code !== 0) console.log(`请在浏览器中打开：${url}`);
  });
  child.unref();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installRelease().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
