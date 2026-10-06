import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgLobbyChat} from '../apps/shared/protocols/MsgLobbyChat';
import {serviceProto} from '../apps/shared/protocols/serviceProto';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-lobby-chat-'));
  const database = join(directory, 'accounts.sqlite');
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open()];
  store.close();
  const port = 3198;
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', value => {log += String(value);});
  server.stderr!.on('data', value => {log += String(value);});
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
  }));
  const received: MsgLobbyChat[][] = clients.map(() => []);
  clients.forEach((client, index) => client.listenMsg('LobbyChat', value => {received[index].push(value);}));
  const counts = () => received.map(values => values.length);
  const routes: Array<{sender: number; recipients: number[]; message: MsgLobbyChat}> = [];
  let rejected = 0;
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 10000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Lobby chat timeout: ${log.slice(-1000)}`);
  }
  async function settle(): Promise<void> {
    // A normal request/response barrier after broadcast catches duplicate or rejected sends.
    for (const client of clients.filter(client => client.isConnected)) {
      assert((await client.callApi('ListRooms', {})).isSucc);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  async function reject(index: number, text: string, code: string): Promise<void> {
    const before = counts();
    const result = await clients[index].callApi('LobbyChat', {text});
    assert(!result.isSucc && result.err.code === code);
    await settle();
    assert.deepEqual(counts(), before);
    rejected++;
  }
  async function send(index: number, text: string, recipients: number[]): Promise<void> {
    const before = counts();
    const result = await clients[index].callApi('LobbyChat', {text});
    assert(result.isSucc);
    const payload = result.res.message;
    assert.equal(payload.accountId, accounts[index].accountId);
    assert.equal(payload.text, text.trim());
    assert.equal(payload.message, `坦克手-${accounts[index].accountId.slice(0, 6)}: ${text.trim()}`);
    await wait(() => recipients.every(recipient => received[recipient].length === before[recipient] + 1));
    await settle();
    assert.deepEqual(counts(), before.map((count, recipient) => count + Number(recipients.includes(recipient))));
    for (const recipient of recipients) assert.deepEqual(received[recipient].at(-1), payload);
    routes.push({sender: index, recipients, message: payload});
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
    for (let index = 0; index < accounts.length; index++) {
      assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
    }
    await reject(3, '未认证冒名', 'ACCOUNT_REQUIRED');
    const created = await clients[2].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '隔离', name: '客户端名', tankId: 1});
    assert(created.isSucc);
    await send(0, '  大厅中文集合  ', [0, 1]);
    await send(1, '中'.repeat(72), [0, 1]);
    for (const text of ['', '   ', '中'.repeat(73), '冒名\n文本', '\u007f']) {
      await reject(0, text, 'CHAT_REJECTED');
    }
    await reject(2, '房间不能发大厅', 'LOBBY_CHAT_IN_ROOM');
    assert((await clients[2].callApi('Leave', {roomId: created.res.room.id, round: 1})).isSucc);
    await send(2, '离房返回大厅', [0, 1, 2]);
    await clients[1].disconnect();
    await send(0, '断线后仅在线大厅', [0, 2]);
    assert((await clients[1].connect()).isSucc);
    await reject(1, '重连未认证', 'ACCOUNT_REQUIRED');
    await send(2, '重连身份隔离', [0, 2]);
    assert((await clients[1].callApi('Account', {token: accounts[1].token})).isSucc);
    await send(1, '重新认证恢复大厅', [0, 1, 2]);
    assert.deepEqual(routes.map(route => route.message.id), [1, 2, 3, 4, 5, 6]);
    writeFileSync('recovery/output/lobby-chat-network.json', JSON.stringify({status: 'PASS', port,
      scope: 'Actual server and four WebSocket clients, three authenticated accounts, normal CreateRoom/Leave/reconnect; rebuilt account alias and lobby eligibility, no state injection.',
      rejectedRequests: rejected, counts: counts(), routes, disconnectReauthentication: true}, null, 2) + '\n');
    console.log('PASS: authoritative lobby chat, text refusals, lobby/room isolation, Leave return and disconnect authentication cleanup');
  } finally {
    await Promise.allSettled(clients.map(client => client.disconnect()));
    server.kill('SIGTERM');
    await new Promise<void>(resolve => {if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve());});
    writeFileSync('recovery/output/lobby-chat-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
