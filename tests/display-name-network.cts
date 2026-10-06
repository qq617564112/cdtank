import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgLobbyChat} from '../apps/shared/protocols/MsgLobbyChat';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-display-name-'));
  const database = join(directory, 'accounts.sqlite'), port = 3201;
  let store = new AccountStore(database);
  const accounts = [store.open(), store.open()];
  const profile = {bytes: new Uint8Array(0x170), strings: ['原字段一', '原字段二'] as [string, string]};
  const profileView = new DataView(profile.bytes.buffer);
  profileView.setUint32(0xa8, 500, true);
  profileView.setUint32(0x70, 12345, true);
  profileView.setUint32(0x74, 678, true);
  store.replaceRoleRecords(accounts[0].accountId, {base: [], equipment: [
    {name: 'Owned tank fixture', fields: new Map([[0x1c, 500], [0x24, 1]])},
  ]});
  const inventory = [{instanceId: 77, itemTableId: 1, ownedQuantity: 3, battleQuantity: 0,
    state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}];
  store.replaceRoleProfile(accounts[0].accountId, profile);
  store.replaceInventory(accounts[0].accountId, inventory);
  assert.throws(() => store.setDisplayName('missing-account', '名称'), /账户不存在/);
  store.close();
  let server: ChildProcess | undefined, log = '';
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined}));
  const messages: MsgLobbyChat[] = [], snapshots: MsgRoomSnapshot[] = [];
  clients[1].listenMsg('LobbyChat', message => {messages.push(message);});
  clients[0].listenMsg('RoomSnapshot', snapshot => {snapshots.push(snapshot);});
  async function wait(check: () => boolean): Promise<void> {
    const end = Date.now() + 10000;
    while (!check() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  async function start(): Promise<void> {
    log += '\nSERVER START\n';
    let ready = false;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {log += String(value); ready ||= String(value).includes(`Server started at ${port}.`);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => ready);
  }
  async function stop(): Promise<void> {
    await Promise.allSettled(clients.map(client => client.disconnect()));
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => server!.once('exit', () => resolve()));
    }
    server = undefined;
  }
  let rejected = 0;
  async function set(index: number, name: string): Promise<void> {
    const result = await clients[index].callApi('DisplayName', {name});
    assert(result.isSucc);
    assert.equal(result.res.name, name.trim());
  }
  async function query(index: number, expected: string): Promise<void> {
    const result = await clients[index].callApi('DisplayName', {});
    assert(result.isSucc && result.res.name === expected);
  }
  async function reject(index: number, name: string | undefined, code: string): Promise<void> {
    const result = await clients[index].callApi('DisplayName', name === undefined ? {} : {name});
    assert(!result.isSucc && result.err.code === code);
    rejected++;
  }
  try {
    await start();
    for (const client of clients) assert((await client.connect()).isSucc);
    for (const [index, account] of [[0, accounts[0]], [1, accounts[1]], [2, accounts[0]]] as const) {
      assert((await clients[index].callApi('Account', {token: account.token})).isSucc);
    }
    await reject(3, undefined, 'ACCOUNT_REQUIRED');
    await query(0, `坦克手-${accounts[0].accountId.slice(0, 6)}`);
    await set(0, '  中文坦克手  ');
    await query(2, '中文坦克手');
    for (const name of ['', '   ', '中'.repeat(17), '控制\n字符', '\u007f']) await reject(0, name, 'NAME_REJECTED');
    await query(0, '中文坦克手');
    await set(0, '😀'.repeat(16));
    await reject(0, '😀'.repeat(17), 'NAME_REJECTED');
    await set(0, '中文坦克手');
    await set(0, '中文坦克手');
    await query(1, `坦克手-${accounts[1].accountId.slice(0, 6)}`);
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '昵称验证', name: '冒名请求', tankId: 1});
    assert(created.isSucc);
    await wait(() => snapshots.some(snapshot => snapshot.players.some(player => player.id === created.res.playerId && player.name === '中文坦克手')));
    await query(0, '中文坦克手');
    await reject(0, '房内修改', 'NAME_IN_ROOM');
    await reject(2, '第二连接绕过', 'NAME_IN_ROOM');
    const ownProfile = await clients[0].callApi('RoleProfile', {});
    assert(ownProfile.isSucc);
    assert.deepEqual(ownProfile.res.profile, {bytes: [...profile.bytes], strings: profile.strings});
    assert((await clients[0].callApi('Leave', {roomId: created.res.room.id, round: 1})).isSucc);
    await set(2, '确认新昵称');
    const chat = await clients[0].callApi('LobbyChat', {text: '昵称确认消息'});
    assert(chat.isSucc && chat.res.message.message === '确认新昵称: 昵称确认消息');
    await wait(() => messages.some(message => message.id === chat.res.message.id));
    const presence = await clients[1].callApi('LobbyPlayers', {});
    assert(presence.isSucc && presence.res.players.find(player => player.accountId === accounts[0].accountId)?.name === '确认新昵称');
    await stop();
    await start();
    assert((await clients[0].connect()).isSucc);
    assert((await clients[0].callApi('Account', {token: accounts[0].token})).isSucc);
    await query(0, '确认新昵称');
    await stop();
    store = new AccountStore(database);
    assert.equal(store.displayName(accounts[0].accountId), '确认新昵称');
    assert.deepEqual(store.roleProfile(accounts[0].accountId), profile);
    assert.deepEqual(store.inventory(accounts[0].accountId).records, inventory);
    store.close();
    writeFileSync('recovery/output/display-name-network.json', JSON.stringify({status: 'PASS', port,
      scope: 'Actual server restart, authenticated nickname query/set, same-account room gate, normal room/chat/presence identity and independent persistence; rebuilt names, no original profile interpretation.',
      rejectedRequests: rejected, unicodeCodePointBoundary: 16, roomName: '中文坦克手', persistedName: '确认新昵称',
      profileBytesAndStringsUnchanged: true, inventoryUnchanged: true, balancesUnchanged: true,
      chat: chat.res.message, presence: presence.res.players}, null, 2) + '\n');
    console.log('PASS: confirmed Unicode nickname, cross-connection room gate, authority consumers, actual restart and untouched original data');
  } finally {
    await stop();
    writeFileSync('recovery/output/display-name-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
