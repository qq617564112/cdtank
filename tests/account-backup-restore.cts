import assert from 'node:assert/strict';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-backup-'));
  const source = join(directory, 'live.sqlite'), archive = join(directory, 'backup.sqlite');
  const restored = join(directory, 'restored.sqlite');
  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/account-backup-restore-${run}.json`;
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    scope: 'Live SQLite WAL backup and new-path restore through compiled production server; real nickname/purchase/kitbag/friends state and purchase receipt reuse.',
    fixture: 'Two new empty accounts; funds-only profile10000/all other bytes0. Roles/items are genuine API purchases. No live battle state or database restore over a running server.',
    port: 3430};
  const store = new AccountStore(source);
  const accounts = [store.open(), store.open()];
  for (const account of accounts) {
    const bytes = new Uint8Array(0x170);
    new DataView(bytes.buffer).setUint32(0x70, 10000, true);
    store.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
  }
  store.close();
  let server: ChildProcess | undefined;
  const clients = accounts.map(() => new WsClient(serviceProto,
    {server: 'ws://127.0.0.1:3430', logger: undefined}));
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  async function start(database: string) {
    let log = '';
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: '3430', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    const deadline = Date.now() + 15000;
    while (!log.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
    assert(log.includes('Server started'), 'Compiled production server must start');
    for (let index = 0; index < clients.length; index++) {
      assert((await clients[index].connect()).isSucc);
      const result = await clients[index].callApi('Account', {token: accounts[index].token});
      assert(result.isSucc); assert.equal(result.res.accountId, accounts[index].accountId);
    }
  }
  async function stop() {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve));
      server.kill('SIGTERM'); await ended;
    }
  }
  function command(operation: string, input: string, destination: string) {
    return spawnSync(process.execPath, ['scripts/account-snapshot.mjs', operation, input, destination],
      {encoding: 'utf8'});
  }
  async function savedState() {
    const client = clients[0];
    const inventory = await client.callApi('Inventory', {}); assert(inventory.isSucc);
    const name = await client.callApi('DisplayName', {}); assert(name.isSucc);
    const roles = await client.callApi('OwnedRoles', {}); assert(roles.isSucc);
    const profile = await client.callApi('RoleProfile', {}); assert(profile.isSucc);
    const friends = await client.callApi('Friends', {operation: 'QUERY'}); assert(friends.isSucc);
    const history = await client.callApi('History', {}); assert(history.isSucc);
    return {inventory: inventory.res, name: name.res, roles: roles.res, profile: profile.res,
      friends: friends.res, history: history.res};
  }
  try {
    await start(source);
    assert((await clients[0].callApi('DisplayName', {name: '备份玩家'})).isSucc);
    assert((await clients[1].callApi('DisplayName', {name: '另一个账户'})).isSucc);
    assert((await clients[0].callApi('Friends', {operation: 'ADD', targetAccountId: accounts[1].accountId})).isSucc);
    const tank = await clients[0].callApi('TankShop', {operation: 'BUY', tankId: 3,
      currency: 'MONEY', requestId: 'backup_tank'}); assert(tank.isSucc);
    const pet = await clients[0].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'backup_pet'}); assert(pet.isSucc);
    const tankId = new Map(tank.res.purchased!.fields).get(0x1c)!;
    const petId = new Map(pet.res.purchased!.fields).get(0)!;
    assert((await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: tankId})).isSucc);
    assert((await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: petId})).isSucc);
    const purchase = {operation: 'BUY' as const, itemTableId: 4, quantity: 2,
      currency: 'MONEY' as const, requestId: 'backup_item'};
    const bought = await clients[0].callApi('Shop', purchase); assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 4})).isSucc);
    const before = await savedState();
    assert(statSync(`${source}-wal`).size > 32, 'Live source has committed WAL content');
    const backup = command('backup', source, archive); assert.equal(backup.status, 0, backup.stderr);
    assert.equal(command('backup', source, archive).status, 1, 'Existing destination is preserved');
    assert.equal(command('backup', source, source).status, 1, 'Source path is never overwritten');
    assert.equal(command('backup', join(directory, 'missing.sqlite'), join(directory, 'unused.sqlite')).status, 1);
    assert((await clients[0].callApi('DisplayName', {name: '备份之后'})).isSucc);
    assert((await clients[0].callApi('Shop', {...purchase, quantity: 1, requestId: 'after_backup'})).isSucc);
    assert.notDeepEqual(await savedState(), before, 'Later live commits remain outside saved snapshot');
    await stop();
    const restore = command('restore', archive, restored); assert.equal(restore.status, 0, restore.stderr);
    assert.equal(command('restore', archive, restored).status, 1, 'Restore requires a new destination');
    await start(restored);
    assert.deepEqual(await savedState(), before, 'Cold restored authority equals the saved API state');
    const other = await clients[1].callApi('Inventory', {}); assert(other.isSucc);
    assert.deepEqual(other.res.records, []); assert(other.res.hotkeys.every(value => value === 0));
    const replay = await clients[0].callApi('Shop', purchase); assert(replay.isSucc);
    assert.equal(replay.res.purchased!.instanceId, instanceId);
    assert.deepEqual(await savedState(), before, 'Persisted purchase receipt does not charge or duplicate on replay');
    evidence.status = 'PASS_LIVE_BACKUP_COLD_RESTORE';
    evidence.confirmed = {accountIdentityRestored: true, state: before, otherAccountEmpty: true,
      liveWalCaptured: true, laterCommitsExcluded: true, purchaseReceiptReplayPreserved: true,
      existingDestinationRefused: true, compiledServerStartup: true};
    console.log(`PASS ${output}`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    await stop(); rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
