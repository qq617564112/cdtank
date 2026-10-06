import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(workspace, 'dist/server');
rmSync(output, {recursive: true, force: true});
const result = spawnSync(process.execPath,
  [resolve(workspace, 'node_modules/typescript/bin/tsc'), '-p', resolve(workspace, 'apps/server/tsconfig.json')],
  {cwd: workspace, stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(output, {recursive: true});
writeFileSync(resolve(output, 'package.json'), JSON.stringify({private: true, type: 'commonjs',
  scripts: {start: 'node server/src/index.js'},
  dependencies: {tsrpc: '3.4.21'}}, null, 2) + '\n');
console.log('Server built: dist/server/server/src/index.js');
