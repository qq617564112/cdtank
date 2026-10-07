import {spawnSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';

/** Downloads the versioned runtime bundle and extracts it into the workspace. */
async function installAssets() {
  var workspace = fileURLToPath(new URL('../', import.meta.url));
  var version = '0.9.0';
  var filename = `cdtank-assets-${version}.tar.xz`;
  var url = `https://github.com/qq617564112/cdtank/releases/download/v${version}/${filename}`;
  var tar = spawnSync('tar', ['--version'], {stdio: 'ignore'});
  if (tar.error || tar.status !== 0) {
    throw new Error('需要支持 .tar.xz 的 tar；Linux 可安装 tar 和 xz-utils，Windows 10/11 与 macOS 使用系统 tar。');
  }

  var temporary = await mkdtemp(join(tmpdir(), 'cdtank-assets-'));
  try {
    console.log(`下载运行资源 ${version}：${url}`);
    var response = await fetch(url);
    if (!response.ok) {
      throw new Error(`资源下载失败：HTTP ${response.status} ${response.statusText}`);
    }
    var archive = join(temporary, filename);
    var download = Readable.fromWeb(response.body);
    var total = Number(response.headers.get('content-length'));
    var received = 0;
    var lastProgress = 0;
    download.on('data', chunk => {
      received += chunk.length;
      var progress = total > 0 ? Math.floor(received / total * 10) : 0;
      if (progress > lastProgress) {
        lastProgress = progress;
        console.log(`下载进度：${progress * 10}%`);
      }
    });
    await pipeline(download, createWriteStream(archive));
    console.log('解压模型、贴图、音频、界面、字体和数据表……');
    var extraction = spawnSync('tar', ['-xJf', archive, '-C', workspace], {stdio: 'inherit'});
    if (extraction.error) {
      throw extraction.error;
    }
    if (extraction.status !== 0) {
      throw new Error('资源解压失败，请确认 tar 支持 .xz；Linux 需要安装 xz-utils。');
    }
    console.log('资源安装完成：recovery/output/web-assets/、recovery/output/verified/tables/');
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

installAssets().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
