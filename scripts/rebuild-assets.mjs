import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const arguments_ = process.argv.slice(2);
let reuseVerified = false;
for (let index = 0; index < arguments_.length; index++) {
  const argument = arguments_[index];
  if (argument === '--reuse-verified') {
    reuseVerified = true;
  } else {
    throw new Error('Usage: node scripts/rebuild-assets.mjs [--reuse-verified]');
  }
}

const python = resolve(workspace, 'recovery/.venv/bin/python');
const verified = resolve(workspace, 'recovery/output/verified');
if (!existsSync(python)) throw new Error('Create recovery/.venv and install recovery/requirements.txt first.');
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
run(python, ['scripts/install-hd-assets.py']);
run('npm', ['run', 'assets:usage']);
console.log('Assets published: recovery/output/web-assets');
