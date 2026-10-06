import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const arguments_ = process.argv.slice(2);
let reuseVerified = false;
let fontInput;
for (let index = 0; index < arguments_.length; index++) {
  const argument = arguments_[index];
  if (argument === '--reuse-verified') {
    reuseVerified = true;
  } else if (argument === '--font' && arguments_[index + 1] &&
    !arguments_[index + 1].startsWith('--')) {
    fontInput = resolve(arguments_[++index]);
  } else {
    throw new Error('Usage: node scripts/rebuild-assets.mjs [--reuse-verified] [--font /path/to/font.ttf]');
  }
}

const python = resolve(workspace, 'recovery/.venv/bin/python');
const verified = resolve(workspace, 'recovery/output/verified');
const fontOutput = resolve(workspace, 'recovery/output/web-assets/ui/fonts/xiangjiao-brush.ttf');
if (!existsSync(python)) throw new Error('Create recovery/.venv and install recovery/requirements.txt first.');
if (!existsSync(fontInput ?? fontOutput)) {
  throw new Error('Supply the attachment XiangJiaoKuanMaoShuaLingGanTi-2.ttf with --font.');
}
if (reuseVerified) {
  for (const input of ['summary.json', 'assets/data/Data', 'assets/music', 'tables']) {
    if (!existsSync(resolve(verified, input))) throw new Error(`Missing extracted input: ${input}`);
  }
} else if (existsSync(verified)) {
  throw new Error('recovery/output/verified already exists; use --reuse-verified to keep it.');
}

function run(command, arguments_) {
  console.log([command, ...arguments_].join(' '));
  const result = spawnSync(command, arguments_, {cwd: workspace, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!reuseVerified) {
  run(python, ['recovery/inspect_assets.py', '--out', 'recovery/output/verified']);
}
run('npm', ['run', 'assets:catalog']);
run('npm', ['run', 'assets']);
if (fontInput && fontInput !== fontOutput) {
  mkdirSync(dirname(fontOutput), {recursive: true});
  copyFileSync(fontInput, fontOutput);
}
run('npm', ['run', 'assets:usage']);
console.log('Assets published: recovery/output/web-assets');
