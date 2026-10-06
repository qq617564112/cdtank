import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

async function main(): Promise<void> {
  const root = resolve(__dirname, '..');
  const entry = process.env.CDTANK_SERVER_ENTRY ?? join(root, 'dist/server/server/src/index.js');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-built-server-'));
  const env = {...process.env, CDTANK_SERVER_ENTRY: entry, CDTANK_SERVER_CWD: directory,
    CONTENT_TABLES: join(root, 'recovery/output/verified/tables'), WEB_ASSETS: join(root, 'recovery/output/web-assets')};
  const checks = [
    {test: 'account-network.cts', evidence: 'account-network.json', port: 3129},
    {test: 'tank-texture-network.cts', evidence: 'tank-texture-network.json', port: 3018},
  ];
  try {
    for (const check of checks) {
      console.log(`Compiled server acceptance: ${check.test}`);
      const child = spawn(process.execPath, ['--import', 'tsx', join(root, 'tests', check.test)], {
        cwd: root,
        env,
        stdio: 'inherit',
      });
      const code = await new Promise<number | null>((resolveExit, reject) => {
        child.once('error', reject);
        child.once('exit', resolveExit);
      });
      assert.equal(code, 0, `Compiled server acceptance failed: ${check.test}`);
      const result: {status: string; restartRecovered?: boolean; restartRecovery?: boolean} = JSON.parse(
        readFileSync(join(root, 'recovery/output', check.evidence), 'utf8'));
      assert.equal(result.status, 'PASS');
      assert(result.restartRecovered || result.restartRecovery);
    }
    const cpuFixture = join(directory, 'autopilot-match.cts');
    const sourceFixture = readFileSync(join(root, 'tests/autopilot-match.cts'), 'utf8');
    const compiledFixture = sourceFixture
      .replace("'../apps/server/src/account-store'", JSON.stringify(join(root, 'dist/server/server/src/account-store.js')))
      .replace("'../apps/server/src/world'", JSON.stringify(join(root, 'dist/server/server/src/world.js')));
    assert.notEqual(compiledFixture, sourceFixture);
    writeFileSync(cpuFixture, compiledFixture);
    console.log('Compiled World acceptance: autopilot-match.cts, all five modes and two rounds');
    const cpu = spawn(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), cpuFixture], {
      cwd: root, env, stdio: 'inherit',
    });
    const cpuCode = await new Promise<number | null>((resolveExit, reject) => {
      cpu.once('error', reject);
      cpu.once('exit', resolveExit);
    });
    assert.equal(cpuCode, 0, 'Compiled World CPU acceptance failed');
    const cpuEvidence = readFileSync(join(root, 'recovery/output/autopilot-match.json'), 'utf8');
    writeFileSync(join(root, 'recovery/output/server-build-autopilot-match.json'), cpuEvidence);
    writeFileSync(join(root, 'recovery/output/server-build-runtime.json'), JSON.stringify({
      status: 'PASS', entry, runtime: 'node',
      serverCwdOutsideWorkspace: true,
      contentTables: 'recovery/output/verified/tables', webAssets: 'recovery/output/web-assets',
      checks: checks.map(check => ({test: `tests/${check.test}`, evidence: `recovery/output/${check.evidence}`,
        port: check.port, restartPersistence: true})),
      cpu: {fixture: 'tests/autopilot-match.cts', modules: ['account-store.js', 'world.js'],
        modes: [1, 2, 3, 4, 5], roundsPerMode: 2, evidence: 'recovery/output/server-build-autopilot-match.json'},
    }, null, 2));
    console.log('PASS: compiled Node server account, tank texture and five-mode two-round CPU acceptance');
  } finally {rmSync(directory, {recursive: true, force: true});}
}

main().catch(error => {console.error(error); process.exitCode = 1;});
