import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqFriends, FriendRecord} from '../apps/shared/protocols/PtlFriends';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-friends-'));
  const database = join(directory, 'accounts.sqlite'), port = 3207;
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open()];
  accounts.forEach((account, index) => store.setDisplayName(account.accountId, ['甲', '乙', '丙'][index]));
  const profile = {bytes: new Uint8Array(0x170).fill(37), strings: ['原名', '原资料'] as [string, string]};
  store.replaceRoleProfile(accounts[0].accountId, profile);
  store.close();
  let server: ChildProcess | undefined, log = '';
  const clients = Array.from({length: 5}, () => new WsClient(serviceProto,
    {server: `ws://127.0.0.1:${port}`, logger: undefined}));
  const evidence: {label: string; friends?: FriendRecord[]; code?: string}[] = [];
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 10000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    await Promise.allSettled(clients.map(client => client.disconnect()));
    if (!server || server.exitCode !== null) return;
    server.kill('SIGTERM');
    await new Promise<void>(resolve => server!.once('exit', () => resolve()));
  }
  async function authenticate(index: number, account: number): Promise<void> {
    assert((await clients[index].connect()).isSucc);
    assert((await clients[index].callApi('Account', {token: accounts[account].token})).isSucc);
  }
  async function request(index: number, req: ReqFriends, label: string): Promise<FriendRecord[]> {
    const result = await clients[index].callApi('Friends', req);
    assert(result.isSucc, JSON.stringify(result));
    evidence.push({label, friends: result.res.friends});
    return result.res.friends;
  }
  async function reject(index: number, req: ReqFriends, code: string): Promise<void> {
    const result = await clients[index].callApi('Friends', req);
    assert(!result.isSucc && result.err.code === code, JSON.stringify(result));
    evidence.push({label: req.operation, code});
  }
  const query: ReqFriends = {operation: 'QUERY'};
  const add: ReqFriends = {operation: 'ADD', targetAccountId: accounts[1].accountId};
  const remove: ReqFriends = {operation: 'REMOVE', targetAccountId: accounts[1].accountId};
  try {
    await start();
    await authenticate(0, 0); await authenticate(1, 1); await authenticate(2, 2);
    assert((await clients[4].connect()).isSucc);
    await reject(4, query, 'ACCOUNT_REQUIRED');
    assert.deepEqual(await request(0, query, 'initial'), []);
    assert.deepEqual(await request(0, add, 'add-online'), [{accountId: accounts[1].accountId, name: '乙', online: true, inRoom: false}]);
    assert.equal((await request(0, add, 'duplicate-idempotent')).length, 1);
    assert.deepEqual(await request(1, query, 'unilateral-target'), []);
    assert.deepEqual(await request(2, query, 'unrelated-owner'), []);
    await reject(0, {operation: 'ADD', targetAccountId: accounts[0].accountId}, 'FRIEND_SELF');
    await reject(0, {operation: 'REMOVE', targetAccountId: accounts[0].accountId}, 'FRIEND_SELF');
    await reject(0, {operation: 'ADD', targetAccountId: 'absent'}, 'FRIEND_TARGET_NOT_FOUND');
    await reject(0, {operation: 'REMOVE', targetAccountId: 'absent'}, 'FRIEND_TARGET_NOT_FOUND');
    await authenticate(3, 1);
    const room = await clients[1].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '好友状态', name: '乙', tankId: 1});
    assert(room.isSucc);
    assert.equal((await request(0, query, 'one-target-connection-in-room'))[0].inRoom, true);
    assert((await clients[1].callApi('Leave', {roomId: room.res.room.id, round: 1})).isSucc);
    assert.equal((await request(0, query, 'leave-updates-state'))[0].inRoom, false);
    await clients[1].disconnect();
    assert.equal((await request(0, query, 'second-authenticated-connection-online'))[0].online, true);
    await clients[3].disconnect();
    await wait(() => !clients[3].isConnected);
    const offline = await request(0, query, 'all-target-connections-offline');
    assert.equal(offline[0].online, false); assert.equal(offline[0].inRoom, false);
    assert.deepEqual(await request(2, remove, 'other-owner-remove-no-effect'), []);
    assert.equal((await request(0, query, 'owner-relationship-retained')).length, 1);
    await stop(); await start(); await authenticate(0, 0);
    assert.deepEqual(await request(0, query, 'actual-server-restart'), [{accountId: accounts[1].accountId, name: '乙', online: false, inRoom: false}]);
    await authenticate(1, 1);
    assert((await clients[1].callApi('DisplayName', {name: '新乙'})).isSucc);
    assert.equal((await request(0, query, 'authoritative-renamed-target'))[0].name, '新乙');
    assert.deepEqual(await request(0, remove, 'remove'), []);
    assert.deepEqual(await request(0, remove, 'remove-idempotent'), []);
    await clients[1].disconnect();
    assert.equal((await request(0, add, 'add-existing-offline-account')).length, 1);
    await stop();
    const restored = new AccountStore(database);
    assert.deepEqual(restored.roleProfile(accounts[0].accountId), profile);
    assert.deepEqual(restored.friends(accounts[0].accountId, query), [accounts[1].accountId]);
    assert.deepEqual(restored.friends(accounts[1].accountId, query), []);
    restored.close();
    writeFileSync('recovery/output/friends-network.json', JSON.stringify({status: 'PASS', port,
      actualServerRestart: true, profileUnchanged: true, evidence}, null, 2) + '\n');
    console.log('PASS: friends network authority, unilateral owners, presence, idempotence, offline add and actual restart');
  } finally {
    await stop(); writeFileSync('recovery/output/friends-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
