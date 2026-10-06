import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const release = fileURLToPath(new URL('./', import.meta.url));
const child = spawn(process.execPath, [resolve(release, 'server/server/src/index.js')], {
  cwd: release,
  stdio: 'inherit',
  env: {...process.env,
    CONTENT_TABLES: process.env.CONTENT_TABLES ?? resolve(release, 'content/tables'),
    WEB_ASSETS: process.env.WEB_ASSETS ?? resolve(release, 'web'),
    ACCOUNT_DB_PATH: process.env.ACCOUNT_DB_PATH ?? resolve(release, 'state/accounts.sqlite')},
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => {console.error(error); process.exitCode = 1;});
child.on('exit', code => {process.exitCode = code ?? 1;});
