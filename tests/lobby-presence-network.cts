import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ResLobbyPlayers} from '../apps/shared/protocols/PtlLobbyPlayers';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-lobby-presence-'));
  const database = join(directory, 'accounts.sqlite');
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open(), store.open()];
  store.close();
  const port = 3199;
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', value => {log += String(value);});
  server.stderr!.on('data', value => {log += String(value);});
  const clients = Array.from({length: 5}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
  }));
  const evidence: Array<{stage: string; players: ResLobbyPlayers['players']}> = [];
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 10000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Lobby presence timeout: ${log.slice(-1000)}`);
  }
  async function list(index: number, ids: string[], stage: string): Promise<void> {
    const expected = [...ids].sort().map(accountId => ({accountId, name: `坦克手-${accountId.slice(0, 6)}`}));
    const deadline = Date.now() + 5000;
    let result = await clients[index].callApi('LobbyPlayers', {});
    while (result.isSucc && JSON.stringify(result.res.players) !== JSON.stringify(expected)
      && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
      result = await clients[index].callApi('LobbyPlayers', {});
    }
    assert(result.isSucc);
    assert.deepEqual(result.res, {players: expected});
    assert(!accounts.some(account => JSON.stringify(result.res).includes(account.token)));
    evidence.push({stage, players: result.res.players});
  }
  async function rejected(index: number, code: string): Promise<void> {
    const result = await clients[index].callApi('LobbyPlayers', {});
    assert(!result.isSucc && result.err.code === code);
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
    for (let index = 0; index < 3; index++) {
      assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
    }
    assert((await clients[3].callApi('Account', {token: accounts[0].token})).isSucc);
    await rejected(4, 'ACCOUNT_REQUIRED');
    const room = await clients[2].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '成员隔离', name: 'RoomOnly', tankId: 1});
    assert(room.isSucc);
    await list(0, [accounts[0].accountId, accounts[1].accountId], 'two lobby accounts, duplicate connection and one room');
    await list(1, [accounts[0].accountId, accounts[1].accountId], 'same stable roster on second lobby');
    await rejected(2, 'LOBBY_PLAYERS_IN_ROOM');
    const duplicateRoom = await clients[3].callApi('Join', {roomId: room.res.room.id,
      clientId: 'ignored', name: 'Duplicate', tankId: 1});
    assert(duplicateRoom.isSucc);
    await list(0, [accounts[0].accountId, accounts[1].accountId], 'one connection in room, same account remains in lobby');
    assert((await clients[3].callApi('Leave', {roomId: room.res.room.id, round: 1})).isSucc);
    await clients[0].disconnect();
    await list(1, [accounts[0].accountId, accounts[1].accountId], 'one duplicate disconnected, other remains');
    const guestRoom = await clients[1].callApi('Join', {roomId: room.res.room.id,
      clientId: 'ignored', name: 'Second', tankId: 1});
    assert(guestRoom.isSucc);
    await list(3, [accounts[0].accountId], 'Join removes account from lobby');
    assert((await clients[1].callApi('Leave', {roomId: room.res.room.id, round: 1})).isSucc);
    await list(3, [accounts[0].accountId, accounts[1].accountId], 'Leave restores lobby account');
    assert((await clients[2].callApi('Leave', {roomId: room.res.room.id, round: 1})).isSucc);
    await list(1, accounts.slice(0, 3).map(account => account.accountId), 'room owner returns to lobby');
    await Promise.all(clients.slice(0, 4).map(client => client.disconnect()));
    assert((await clients[4].callApi('Account', {token: accounts[3].token})).isSucc);
    await list(4, [accounts[3].accountId], 'all previous disconnected, new account sees only itself');
    writeFileSync('recovery/output/lobby-presence-network.json', JSON.stringify({status: 'PASS', port,
      scope: 'Actual index server, five WebSocket connections and four accounts, current lobby membership, same-account deduplication, normal Join/Leave and disconnect. Rebuilt identity/alias; no persistence changes or state injection.',
      evidence, noTokenDisclosure: true}, null, 2) + '\n');
    console.log('PASS: authoritative current lobby roster, duplicate account isolation, Join/Leave and all-disconnect cleanup');
  } finally {
    await Promise.allSettled(clients.map(client => client.disconnect()));
    server.kill('SIGTERM');
    await new Promise<void>(resolve => {if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve());});
    writeFileSync('recovery/output/lobby-presence-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
