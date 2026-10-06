import assert from 'node:assert/strict';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MatchHistoryRecord} from '../apps/shared/protocols/PtlHistory';

async function main() {
  const source = 'recovery/output/account-history-browser.sqlite';
  const fixture = JSON.parse(readFileSync('recovery/output/account-history-browser-fixture.json', 'utf8'));
  const database = new DatabaseSync(source, {readOnly: true});
  const account = database.prepare('SELECT id FROM accounts WHERE token = ?').get(fixture.token)!;
  const rows = database.prepare(`SELECT record FROM match_history WHERE account_id = ?
    ORDER BY ended_at DESC, match_id DESC, round DESC`).all(String(account.id));
  const expected = rows.map(row => JSON.parse(String(row.record)) as MatchHistoryRecord);
  database.close();
  assert.equal(expected.length, fixture.expectedCount); assert(expected.length > 0);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-history-restore-'));
  const archive = join(directory, 'backup.sqlite'), restored = join(directory, 'restored.sqlite');
  const output = `recovery/output/account-backup-history-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const evidence: Record<string, unknown> = {status: 'RUNNING', port: 3431,
    scope: 'Restore existing ordinary two-round history checkpoint without new battle or settlement.',
    source, reusedOriginalEvidence: 'recovery/docs/account-history.md'};
  let server: ChildProcess | undefined;
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3431', logger: undefined});
  try {
    for (const [operation, input, destination] of [['backup', source, archive], ['restore', archive, restored]]) {
      const result = spawnSync(process.execPath, ['scripts/account-snapshot.mjs', operation, input, destination], {encoding: 'utf8'});
      assert.equal(result.status, 0, result.stderr);
    }
    let log = '';
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: '3431', ACCOUNT_DB_PATH: restored}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    const deadline = Date.now() + 15000;
    while (!log.includes('Server started') && Date.now() < deadline && server.exitCode === null) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(log.includes('Server started'));
    assert((await client.connect()).isSucc);
    const authenticated = await client.callApi('Account', {token: fixture.token}); assert(authenticated.isSucc);
    assert.equal(authenticated.res.accountId, account.id);
    const all = await client.callApi('History', {}); assert(all.isSucc);
    assert.deepEqual(all.res.records, expected); assert.equal(all.res.total, expected.length);
    for (let offset = 0; offset < expected.length; offset++) {
      const page = await client.callApi('History', {offset, limit: 1}); assert(page.isSucc);
      assert.deepEqual(page.res.records, [expected[offset]]); assert.equal(page.res.total, expected.length);
    }
    evidence.status = 'PASS_EXISTING_HISTORY_BACKUP_RESTORE';
    evidence.history = all.res; evidence.originalCheckpointReadOnly = true;
    console.log(`PASS ${output}`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    await client.disconnect();
    if (server?.exitCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill('SIGTERM'); await ended;
    }
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
