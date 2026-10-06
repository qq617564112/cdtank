import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';

async function main(): Promise<void> {
  const source = 'recovery/output/tank-purchased-trap-turn-network-2026-10-05T03-13-11-335Z';
  const raw = JSON.parse(readFileSync(source + '.json', 'utf8'));
  assert.equal(raw.status, 'PASS_PURCHASED_JAM_TURN_SCOPE');
  assert.equal(raw.normalLeaves, 2);
  const accounts = JSON.parse(readFileSync(raw.checkpoint.identityFile, 'utf8')).accounts;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-jam-restart-'));
  const database = join(directory, 'accounts.sqlite');
  copyFileSync(raw.checkpoint.database, database);
  const output = 'recovery/output/trap3004-restart-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', source: source + '.json',
    checkpoint: raw.checkpoint.database,
    scope: 'Actual server restart from the native same-run database backup after ordinary purchased3004 contact, expiry and dual Leave. No repeated purchase/contact or inventory imports.'};
  const native = new AccountStore(database);
  let baseline;
  try {
    const identity = native.open(accounts[0].token);
    assert.equal(identity.accountId, accounts[0].accountId);
    baseline = native.inventory(identity.accountId);
    assert.deepEqual(baseline, raw.persistedInventory);
    const jam = baseline.records.find(row => row.itemTableId === 3004)!;
    assert.equal(jam.ownedQuantity, 1);
    assert.equal(jam.battleQuantity, 0);
    assert.equal(baseline.hotkeys[0], jam.instanceId);
    evidence.nativeInventory = baseline;
  } finally {native.close();}
  let log = '';
  const server = spawn(process.execPath, ['dist/server/server/src/index.js'], {
    env: {...process.env, PORT: '3308', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout!.on('data', data => {log += String(data);});
  server.stderr!.on('data', data => {log += String(data);});
  const clients = accounts.map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3308', logger: undefined}));
  try {
    const deadline = Date.now() + 15000;
    while (!log.includes('Server started at 3308.') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(log.includes('Server started at 3308.'), log.slice(-500));
    const restored = [];
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const identity = await client.callApi('Account', {token: accounts[index].token});
      assert(identity.isSucc && identity.res.accountId === accounts[index].accountId);
      const inventory = await client.callApi('Inventory', {}); assert(inventory.isSucc);
      const shop = await client.callApi('Shop', {operation: 'QUERY'}); assert(shop.isSucc);
      if (index === 0) {
        assert.deepEqual(inventory.res, baseline);
        assert.equal(shop.res.money, raw.purchase.money);
        assert.equal(shop.res.tokens, raw.purchase.tokens);
      }
      restored.push({index, inventory: inventory.res, money: shop.res.money, tokens: shop.res.tokens});
    }
    evidence.restored = restored;
    evidence.status = 'PASS_PURCHASED3004_NATIVE_BACKUP_SERVER_RESTART';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
