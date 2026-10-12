import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {cp, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {downloadArchive} from '../deployment/install-release.mjs';

/** Installs public assets and server content from matching 1.0.1+ Release archives. */
async function installAssets() {
  var workspace = fileURLToPath(new URL('../', import.meta.url));
  var version = JSON.parse(readFileSync(resolve(workspace, 'package.json'), 'utf8')).version;
  var releaseUrl = `https://github.com/qq617564112/cdtank/releases/download/v${version}`;
  var localArchives = {};
  var arguments_ = process.argv.slice(2);
  for (var index = 0; index < arguments_.length; index += 2) {
    var option = arguments_[index];
    if (!['--archive', '--program'].includes(option) || !arguments_[index + 1]) {
      throw new Error('Usage: npm run assets:install -- [--archive <assets.tar.gz>] [--program <cdtank.tar.gz>]');
    }
    localArchives[option] = resolve(arguments_[index + 1]);
  }
  function extract(args) {
    var result = spawnSync('tar', args, {stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('资源解压失败，需要支持 .tar.gz 的系统 tar。');
  }
  var temporary = await mkdtemp(join(tmpdir(), 'cdtank-assets-'));
  try {
    var assets = localArchives['--archive'] ?? join(temporary, `cdtank-assets-${version}.tar.gz`);
    var program = localArchives['--program'] ?? join(temporary, `cdtank-${version}.tar.gz`);
    if (!localArchives['--archive']) await downloadArchive(`${releaseUrl}/cdtank-assets-${version}.tar.gz`, assets);
    if (!localArchives['--program']) await downloadArchive(`${releaseUrl}/cdtank-${version}.tar.gz`, program);
    var resources = join(temporary, 'resources');
    await mkdir(resources);
    extract(['-xzf', assets, '-C', temporary]);
    extract(['-xzf', program, '-C', resources, '--strip-components=2', `cdtank-${version}/content`]);
    for (var filename of ['public/manifests/sprite-images.json', 'public/manifests/battle-artwork.json',
      'public/manifests/ui.json', 'resources/tables', 'resources/assets/scene-collision']) {
      if (!existsSync(join(temporary, filename))) throw new Error(`缺少同版本运行资源：${filename}`);
    }
    for (var [source, destination] of [['public', 'apps/web/public'], ['resources', 'apps/server/resources']]) {
      var target = resolve(workspace, destination);
      await rm(target, {recursive: true, force: true});
      await mkdir(target, {recursive: true});
      await cp(join(temporary, source), target, {recursive: true});
    }
    console.log(`资源 ${version} 安装完成：apps/web/public/、apps/server/resources/`);
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

installAssets().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
