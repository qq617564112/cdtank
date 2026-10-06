import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const child = spawn(process.execPath, [resolve(workspace, 'dist/server/server/src/index.js')], {
  cwd: workspace,
  stdio: 'inherit',
  env: {...process.env,
    CONTENT_TABLES: process.env.CONTENT_TABLES ?? resolve(workspace, 'recovery/output/verified/tables'),
    WEB_ASSETS: process.env.WEB_ASSETS ?? resolve(workspace, 'recovery/output/web-assets'),
    ACCOUNT_DB_PATH: process.env.ACCOUNT_DB_PATH ?? resolve(workspace, 'recovery/output/accounts.sqlite')},
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => {console.error(error); process.exitCode = 1;});
child.on('exit', code => {process.exitCode = code ?? 1;});
