import {cpSync, existsSync, mkdirSync, readdirSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const destination = process.argv[2] && resolve(process.argv[2]);
const withoutPublic = process.argv[3] === '--without-public';
if (!destination || existsSync(destination) || process.argv.length > 4
  || (process.argv[3] && !withoutPublic)) {
  throw new Error('Usage: npm run release:package -- <new-directory> [--without-public]');
}
for (const filename of ['dist/server/server/src/index.js', 'dist/web/index.html',
  'apps/server/resources/tables', 'apps/server/resources/assets', 'deployment/server-package-lock.json']) {
  if (!existsSync(resolve(workspace, filename))) throw new Error(`Missing release input: ${filename}`);
}
// Public and Vite outputs share assets/; exclude individual public files only.
var publicFiles = new Set();
function collectPublicFiles(directory) {
  for (var entry of readdirSync(directory, {withFileTypes: true})) {
    var path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectPublicFiles(path);
    else publicFiles.add(relative(resolve(workspace, 'apps/web/public'), path).split(sep).join('/'));
  }
}
if (withoutPublic) collectPublicFiles(resolve(workspace, 'apps/web/public'));
mkdirSync(destination, {recursive: true});
for (const [input, output] of [
  ['dist/server', 'server'], ['dist/web', 'web'],
  ['apps/server/resources/tables', 'content/tables'],
  ['apps/server/resources/assets', 'content/assets'],
  ['deployment/server-package-lock.json', 'server/package-lock.json'],
  ['deployment/start-release.mjs', 'start.mjs'],
  ['scripts/account-snapshot.mjs', 'account-snapshot.mjs'],
  ['deployment/nginx.conf.example', 'nginx.conf.example'],
  ['deployment/operations.md', 'operations.md'],
]) cpSync(resolve(workspace, input), resolve(destination, output), {
  recursive: true,
  filter: path => input !== 'dist/web' || !withoutPublic
    || !publicFiles.has(relative(resolve(workspace, input), path).split(sep).join('/')),
});
console.log(`Release assembled: ${destination}`);
