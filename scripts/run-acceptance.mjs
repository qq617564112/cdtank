import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const group = process.argv[2];
const endpoint = process.argv[3];
if (group !== 'browser' || !endpoint || process.argv.length !== 4) {
  console.error('Usage: npm run test:acceptance:browser -- <Chromium CDP WebSocket URL>');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [
  'test:tanks:textures:selection:browser',
  'test:combat:healing:browser',
  'test:cpu:owned-textures:browser',
];
for (const check of checks) {
  console.log(`Browser acceptance: ${check}`);
  const child = spawn('npm', ['run', check, '--', endpoint], {
    cwd: root,
    stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) process.exit(code ?? 1);
}
