import {spawnSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {copyFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';

/** Downloads the versioned runtime bundle and extracts it into the workspace. */
async function installAssets() {
  var workspace = fileURLToPath(new URL('../', import.meta.url));
  var version = '1.0.0';
  var filename = `cdtank-assets-${version}.tar.xz`;
  var parts = [`${filename}.part01`, `${filename}.part02`];
  var releaseUrl = `https://github.com/qq617564112/cdtank/releases/download/v${version}`;
  var tar = spawnSync('tar', ['--version'], {stdio: 'ignore'});
  if (tar.error || tar.status !== 0) {
    throw new Error('需要支持 .tar.xz 的 tar；Linux 可安装 tar 和 xz-utils，Windows 10/11 与 macOS 使用系统 tar。');
  }

  var arguments_ = process.argv.slice(2);
  if (arguments_.length && (arguments_.length !== 2 || arguments_[0] !== '--archive')) {
    throw new Error('Usage: npm run assets:install -- [--archive /path/to/cdtank-assets.tar.xz]');
  }
  var localArchive = arguments_.length ? resolve(arguments_[1]) : undefined;
  var temporary = await mkdtemp(join(tmpdir(), 'cdtank-assets-'));
  try {
    var archive = localArchive ?? join(temporary, filename);
    for (var index = 0; !localArchive && index < parts.length; index++) {
      var url = `${releaseUrl}/${parts[index]}`;
      console.log(`下载运行资源 ${version}，分卷 ${index + 1}/${parts.length}：${url}`);
      var response = await fetch(url);
      if (!response.ok) {
        throw new Error(`资源下载失败：HTTP ${response.status} ${response.statusText}`);
      }
      var download = Readable.fromWeb(response.body);
      var total = Number(response.headers.get('content-length'));
      var received = 0;
      var lastProgress = 0;
      download.on('data', chunk => {
        received += chunk.length;
        var progress = total > 0 ? Math.floor(received / total * 10) : 0;
        if (progress > lastProgress) {
          lastProgress = progress;
          console.log(`分卷 ${index + 1} 下载进度：${progress * 10}%`);
        }
      });
      await pipeline(download, createWriteStream(archive, {flags: index === 0 ? 'w' : 'a'}));
    }
    var listing = spawnSync('tar', ['-tJf', archive], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
    if (listing.error || listing.status !== 0) {
      throw listing.error ?? new Error('无法读取资源包目录。');
    }
    if (listing.stdout.split('\n').some(path => path.endsWith('/sprite-images.json'))) {
      throw new Error('该资源包使用精灵图，请使用包含原版 UI 单图、高清模型贴图和 minimap 的资源包；可通过 --archive 指定本地资源包。');
    }
    var entries = listing.stdout.split('\n').map(path => path.replace(/^\.\//, ''));
    if (!['apps/web/public/', 'apps/server/resources/tables/', 'apps/server/resources/assets/']
      .every(directory => entries.some(path => path.startsWith(directory)))) {
      throw new Error('资源包应包含 apps/web/public 和 apps/server/resources，请使用当前目录结构的运行资源包。');
    }
    console.log('解压模型、贴图、音频、界面、字体和数据表……');
    var extraction = spawnSync('tar', ['-xJf', archive, '-C', workspace], {stdio: 'inherit'});
    if (extraction.error) {
      throw extraction.error;
    }
    if (extraction.status !== 0) {
      throw new Error('资源解压失败，请确认 tar 支持 .xz；Linux 需要安装 xz-utils。');
    }
    var fontDirectory = join(workspace, 'apps/web/public/ui/fonts');
    await mkdir(fontDirectory, {recursive: true});
    await copyFile(join(workspace, 'deployment/assets/ui/fonts/xiangjiao-brush.ttf'),
      join(fontDirectory, 'xiangjiao-brush.ttf'));
    await copyFile(join(workspace, 'deployment/assets/ui/fonts/Silkscreen-Regular.ttf'),
      join(fontDirectory, 'Silkscreen-Regular.ttf'));
    await copyFile(join(workspace, 'deployment/assets/ui/fonts/fusion-pixel-hud.ttf'),
      join(fontDirectory, 'fusion-pixel-hud.ttf'));
    await copyFile(join(workspace, 'deployment/assets/ui/fonts/fusion-pixel-OFL.txt'),
      join(fontDirectory, 'fusion-pixel-OFL.txt'));
    var collision = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'assets:collision'], {cwd: workspace, stdio: 'inherit'});
    if (collision.error) {
      throw collision.error;
    }
    if (collision.status !== 0) {
      throw new Error('场景碰撞资产生成失败。');
    }
    console.log('资源安装完成：apps/web/public/、apps/server/resources/');
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

installAssets().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
