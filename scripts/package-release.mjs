import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const destination = process.argv[2] && resolve(process.argv[2]);
if (!destination || existsSync(destination)) {
  throw new Error('Usage: npm run release:package -- <new-directory>');
}
for (const filename of ['dist/server/server/src/index.js', 'dist/web/index.html',
  'recovery/output/verified/tables', 'deployment/server-package-lock.json']) {
  if (!existsSync(resolve(workspace, filename))) throw new Error(`Missing release input: ${filename}`);
}
mkdirSync(destination, {recursive: true});
for (const [input, output] of [
  ['dist/server', 'server'], ['dist/web', 'web'],
  ['recovery/output/verified/tables', 'content/tables'],
  ['deployment/server-package-lock.json', 'server/package-lock.json'],
  ['deployment/start-release.mjs', 'start.mjs'],
  ['scripts/account-snapshot.mjs', 'account-snapshot.mjs'],
  ['deployment/nginx.conf.example', 'nginx.conf.example'],
  ['deployment/operations.md', 'operations.md'],
]) cpSync(resolve(workspace, input), resolve(destination, output), {recursive: true});
console.log(`Release assembled: ${destination}`);
