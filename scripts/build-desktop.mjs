import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

var workspace = fileURLToPath(new URL('../', import.meta.url));
var desktop = join(workspace, 'apps/desktop');
var runtime = join(workspace, 'dist/desktop/runtime');
var metadata = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'));
var desktopMetadata = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'));
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows 客户端请在 Windows x64 上打包。');
}
if (desktopMetadata.version !== metadata.version) throw new Error('桌面端版本必须与项目版本一致。');
var [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 24 || (nodeMajor === 24 && nodeMinor < 16)) throw new Error('打包需要 Node.js 24.16 或更高版本。');
for (var filename of ['apps/web/public/manifests/battle-artwork.json',
  'apps/server/resources/tables', 'apps/server/resources/assets']) {
  if (!existsSync(join(workspace, filename))) throw new Error(`缺少运行资源：${filename}`);
}

/** Invoke build tools with the same Node runtime that will ship with the client. */
function run(script, args, cwd = workspace) {
  var result = spawnSync(process.execPath, [script, ...args], {cwd, stdio: 'inherit'});
  if (result.status !== 0) throw new Error(`构建失败：${script}（${result.status ?? result.error?.message}）`);
}

rmSync(runtime, {recursive: true, force: true});
mkdirSync(runtime, {recursive: true});
// Transpile for packaging; verification is separate from the package command.
run(join(workspace, 'node_modules/vite/bin/vite.js'), ['build', '--config', 'apps/web/vite.config.ts']);
run(join(workspace, 'node_modules/typescript/bin/tsc'), ['-p', 'apps/server/tsconfig.json',
  '--noCheck', '--sourceMap', 'false', '--outDir', join(runtime, 'server')]);
cpSync(join(workspace, 'apps/shared/content/definitions'), join(runtime, 'server/shared/content/definitions'), {recursive: true});
var lock = JSON.parse(readFileSync(join(workspace, 'deployment/server-package-lock.json'), 'utf8'));
writeFileSync(join(runtime, 'server/package.json'), JSON.stringify({private: true, type: 'commonjs',
  dependencies: lock.packages[''].dependencies}, null, 2) + '\n');
cpSync(join(workspace, 'deployment/server-package-lock.json'), join(runtime, 'server/package-lock.json'));
run(join(resolve(process.execPath, '..'), 'node_modules/npm/bin/npm-cli.js'),
  ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], join(runtime, 'server'));
for (var [source, destination] of [
  ['dist/web', 'web'], ['apps/server/resources/tables', 'content/tables'],
  ['apps/server/resources/assets', 'content/assets'], ['LICENSE', 'LICENSE'], ['NOTICE', 'NOTICE'],
  ['docs/desktop-client.md', 'README.zh-CN.md'],
]) cpSync(join(workspace, source), join(runtime, destination), {recursive: true});
cpSync(process.execPath, join(runtime, 'node.exe'));
var nodeLicense = join(resolve(process.execPath, '..'), 'LICENSE');
if (existsSync(nodeLicense)) cpSync(nodeLicense, join(runtime, 'NODE-LICENSE'));
run(join(desktop, 'node_modules/esbuild/bin/esbuild'), [
  'apps/desktop/src/main.ts', 'apps/desktop/src/preload.ts', '--bundle', '--platform=node',
  '--format=cjs', '--target=node22', '--packages=external', '--outdir=apps/desktop/bundle', '--out-extension:.js=.cjs',
]);
if (!process.argv.includes('--prepare-only')) {
  run(join(desktop, 'node_modules/electron-builder/cli.js'),
    ['--projectDir', desktop, '--win', 'zip', '--x64', '--publish', 'never']);
}
