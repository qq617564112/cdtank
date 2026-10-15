import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

/** Builds the program/public archives, then publishes them under one Git tag. */
function publishRelease() {
  var workspace = fileURLToPath(new URL('../', import.meta.url));
  var prepareOnly = false;
  var notesFile;
  var arguments_ = process.argv.slice(2);
  for (var index = 0; index < arguments_.length; index++) {
    if (arguments_[index] === '--prepare-only') prepareOnly = true;
    else if (arguments_[index] === '--notes' && arguments_[index + 1]) {
      notesFile = resolve(arguments_[++index]);
    } else throw new Error('Usage: npm run release:github -- [--prepare-only] [--notes <file>]');
  }

  /** @return {string} Captured output, or an empty string for inherited output. */
  function run(command, args, capture = false) {
    var result = spawnSync(command, args, {cwd: workspace,
      stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8',
      shell: process.platform === 'win32' && command === 'npm.cmd'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 失败。${result.stderr ?? ''}`);
    return result.stdout?.trim() ?? '';
  }

  var metadata = JSON.parse(readFileSync(resolve(workspace, 'package.json'), 'utf8'));
  var version = metadata.version;
  var versionParts = version.split('.').map(Number);
  if (!/^\d+\.\d+\.\d+$/.test(version)
    || versionParts[0] < 1 || (versionParts[0] === 1 && versionParts[1] === 0 && versionParts[2] < 1)) {
    throw new Error('此发布流程适用于 1.0.1 及以后版本，package.json 必须使用正式版本号。');
  }
  var lock = JSON.parse(readFileSync(resolve(workspace, 'package-lock.json'), 'utf8'));
  var web = JSON.parse(readFileSync(resolve(workspace, 'apps/web/package.json'), 'utf8'));
  if (lock.version !== version || lock.packages[''].version !== version || web.version !== version) {
    throw new Error('请同步根 package.json、package-lock.json 和 apps/web/package.json 的版本。');
  }
  if (run('git', ['status', '--porcelain', '--untracked-files=normal'], true)) {
    throw new Error('请先提交拟发布的源码和文档；发布必须从干净的 Git 工作区构建。');
  }
  var commit = run('git', ['rev-parse', 'HEAD'], true);
  var tag = `v${version}`;
  var remote = run('git', ['remote', 'get-url', 'origin'], true);
  var match = remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error('origin 必须指向要发布的 GitHub 仓库。');
  var repository = match[1];
  var localTag = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`],
    {cwd: workspace, encoding: 'utf8'});
  if (localTag.status === 0 && localTag.stdout.trim() !== commit) {
    throw new Error(`${tag} 已指向其它提交，请使用新的版本号。`);
  }
  for (var filename of ['apps/web/public/assets', 'apps/web/public/data',
    'apps/web/public/assets/models/original', 'apps/web/public/assets/textures/original',
    'apps/web/public/assets/models/hd', 'apps/web/public/assets/textures/hd',
    'apps/web/public/manifests/sprite-images.json', 'apps/web/public/manifests/battle-artwork.json',
    'apps/web/public/manifests/ui.json', 'apps/server/resources/tables',
    'apps/server/resources/assets/scene-collision']) {
    if (!existsSync(resolve(workspace, filename))) throw new Error(`缺少配套发布资源：${filename}`);
  }
  var artwork = JSON.parse(readFileSync(resolve(workspace, 'apps/web/public/manifests/battle-artwork.json'), 'utf8'));
  if (!artwork.variants.original || !artwork.variants.hd || !artwork.summary.models || !artwork.summary.textures) {
    throw new Error('缺少怀旧或 HD 战斗素材映射，请先执行 assets:compressed 和 assets:battle-artwork。');
  }
  if (notesFile && !existsSync(notesFile)) throw new Error(`发布说明不存在：${notesFile}`);
  var customNotes = notesFile ? readFileSync(notesFile, 'utf8') : undefined;
  run('tar', ['--version'], true);
  var existingRelease;
  if (!prepareOnly) {
    run('gh', ['auth', 'status']);
    var remoteTags = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`], true);
    var remoteCommit = remoteTags.split('\n').find(line => line.endsWith('^{}'))
      ?? remoteTags.split('\n').find(line => line.includes(`refs/tags/${tag}`));
    if (remoteCommit && remoteCommit.split(/\s/)[0] !== commit) {
      throw new Error(`GitHub ${tag} 已指向其它提交，请使用新的版本号。`);
    }
    var view = spawnSync('gh', ['release', 'view', tag, '--repo', repository, '--json', 'isDraft'],
      {cwd: workspace, encoding: 'utf8'});
    if (view.error) throw view.error;
    if (view.status === 0) existingRelease = JSON.parse(view.stdout);
    else if (!/release not found|HTTP 404/i.test(view.stderr)) {
      throw new Error(`无法读取 ${tag} 的发布状态：${view.stderr}`);
    }
    if (existingRelease && !existingRelease.isDraft) throw new Error(`${tag} 已公开，请使用新的版本号。`);
  }

  var npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['ci']);
  run(npm, ['run', 'build:web']);
  run(npm, ['run', 'build:server']);
  var output = resolve(workspace, 'dist/github', tag);
  rmSync(output, {recursive: true, force: true});
  mkdirSync(output, {recursive: true});
  var rootName = `cdtank-${version}`;
  var program = resolve(output, rootName);
  run(process.execPath, [resolve(workspace, 'scripts/package-release.mjs'), program, '--without-public']);
  for (var [input, filename] of [['deployment/install-release.mjs', 'install.mjs'],
    ['LICENSE', 'LICENSE'], ['NOTICE', 'NOTICE']]) {
    copyFileSync(resolve(workspace, input), resolve(program, filename));
  }
  var programName = `${rootName}.tar.gz`;
  var assetsName = `cdtank-assets-${version}.tar.gz`;
  writeFileSync(resolve(program, 'release.json'), JSON.stringify({version, tag, repository, commit,
    assets: assetsName}, null, 2) + '\n');
  var programArchive = resolve(output, programName);
  var assetsArchive = resolve(output, assetsName);
  run('tar', ['-czf', programArchive, '-C', output, rootName]);
  run('tar', ['-czf', assetsArchive, '-C', resolve(workspace, 'apps/web'), 'public']);
  for (var archive of [programArchive, assetsArchive]) {
    var bytes = statSync(archive).size;
    if (bytes >= 2 * 1024 ** 3) throw new Error(`${archive} 达到 GitHub 单附件 2 GiB 上限，请按素材配方缩减资源后重新打包。`);
    console.log(`发行附件：${archive}（${(bytes / 1024 ** 2).toFixed(1)} MiB）`);
  }
  notesFile = resolve(output, 'release-notes.md');
  writeFileSync(notesFile, customNotes ?? [
    `CDTank ${tag}`, '',
    `下载程序包 \`${programName}\`，解压后使用 Node.js 24.16 或更高版本运行 \`node install.mjs\`。`,
    `安装器会自动下载同版本的 \`${assetsName}\`、安装运行依赖、启动服务并打开浏览器。`,
    '', '本机入口为 http://localhost:3001/；域名及局域网部署必须使用 HTTPS，以启用 WebGPU。',
    '', `源码提交：${commit}`, `更新日志：https://github.com/${repository}/blob/${tag}/CHANGELOG.md`, '',
  ].join('\n'));
  if (prepareOnly) {
    console.log(`本地打包完成：${output}`);
    return;
  }

  // Tag the exact build source; create a draft before uploading either archive.
  if (localTag.status !== 0) run('git', ['tag', tag, commit]);
  run('git', ['push', 'origin', `refs/tags/${tag}`]);
  if (!existingRelease) {
    run('gh', ['release', 'create', tag, '--repo', repository, '--draft', '--verify-tag',
      '--title', `CDTank ${tag}`, '--notes-file', notesFile]);
  } else {
    run('gh', ['release', 'edit', tag, '--repo', repository, '--notes-file', notesFile]);
  }
  run('gh', ['release', 'upload', tag, programArchive, assetsArchive, '--repo', repository, '--clobber']);
  run('gh', ['release', 'edit', tag, '--repo', repository, '--draft=false']);
  console.log(`已发布：https://github.com/${repository}/releases/tag/${tag}`);
}

try {
  publishRelease();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
