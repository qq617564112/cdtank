import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgLobbyWhisper} from '../apps/shared/protocols/MsgLobbyWhisper';
import type {ReqLobbyWhisper} from '../apps/shared/protocols/PtlLobbyWhisper';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-lobby-whisper-'));
  const database = join(directory, 'accounts.sqlite'), port = 3203;
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open()];
  for (const [index, name] of ['发送者', '目标', '旁观者'].entries()) store.setDisplayName(accounts[index].accountId, name);
  store.close();
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', value => {log += String(value);});
  server.stderr!.on('data', value => {log += String(value);});
  const clients = Array.from({length: 5}, () => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined}));
  const messages: MsgLobbyWhisper[][] = clients.map(() => []), publicCounts = clients.map(() => 0);
  clients.forEach((client, index) => {
    client.listenMsg('LobbyWhisper', value => {messages[index].push(value);});
    client.listenMsg('LobbyChat', () => {publicCounts[index]++;});
  });
  const routes: Array<{recipients: number[]; message: MsgLobbyWhisper}> = [];
  let rejected = 0;
  const counts = () => messages.map(values => values.length);
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 10000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  async function settle(): Promise<void> {
    for (const client of clients.filter(client => client.isConnected)) assert((await client.callApi('ListRooms', {})).isSucc);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  async function send(req: ReqLobbyWhisper, recipients: number[]): Promise<void> {
    const before = counts(), publicBefore = [...publicCounts];
    const result = await clients[0].callApi('LobbyWhisper', req);
    assert(result.isSucc);
    const message = result.res.message;
    assert.equal(message.accountId, accounts[0].accountId);
    assert.equal(message.targetAccountId, accounts[1].accountId);
    assert.equal(message.senderName, '发送者');
    assert.equal(message.text, req.text.trim());
    assert.equal(message.message, `[密语] ${message.senderName} → ${message.targetName}: ${message.text}`);
    await wait(() => recipients.every(index => messages[index].length === before[index] + 1));
    await settle();
    assert.deepEqual(counts(), before.map((count, index) => count + Number(recipients.includes(index))));
    assert.deepEqual(publicCounts, publicBefore);
    for (const index of recipients) assert.deepEqual(messages[index].at(-1), message);
    routes.push({recipients, message});
  }
  async function reject(index: number, req: ReqLobbyWhisper, code: string): Promise<void> {
    const before = counts();
    const result = await clients[index].callApi('LobbyWhisper', req);
    assert(!result.isSucc && result.err.code === code);
    await settle();
    assert.deepEqual(counts(), before);
    rejected++;
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
    for (let index = 0; index < 3; index++) assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
    assert((await clients[3].callApi('Account', {token: accounts[1].token})).isSucc);
    await reject(4, {text: '未认证', targetName: '目标'}, 'ACCOUNT_REQUIRED');
    await send({text: '  中文密语  ', targetName: '  目标  '}, [0, 1, 3]);
    await send({text: '中'.repeat(72), targetAccountId: accounts[1].accountId}, [0, 1, 3]);
    for (const req of [{text: '', targetName: '目标'}, {text: '中'.repeat(73), targetName: '目标'},
      {text: '控制\n字符', targetName: '目标'}, {text: '\u007f', targetName: '目标'},
      {text: '两个目标', targetName: '目标', targetAccountId: accounts[1].accountId},
      {text: '无目标'}, {text: '空名', targetName: '  '}]) {
      await reject(0, req, 'WHISPER_REJECTED');
    }
    await reject(0, {text: '自己', targetAccountId: accounts[0].accountId}, 'WHISPER_SELF');
    await reject(0, {text: '离线', targetAccountId: 'missing-account'}, 'WHISPER_OFFLINE');
    assert((await clients[2].callApi('DisplayName', {name: '目标'})).isSucc);
    await reject(0, {text: '重名', targetName: '目标'}, 'WHISPER_AMBIGUOUS');
    await send({text: '同名按身份', targetAccountId: accounts[1].accountId}, [0, 1, 3]);
    const room = await clients[1].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '密语隔离', name: '冒名', tankId: 1});
    assert(room.isSucc);
    await send({text: '另一大厅连接仍在线', targetAccountId: accounts[1].accountId}, [0, 3]);
    const joined = await clients[3].callApi('Join', {roomId: room.res.room.id, clientId: 'ignored', name: 'Target2', tankId: 1});
    assert(joined.isSucc);
    await reject(1, {text: '房内发送', targetAccountId: accounts[0].accountId}, 'WHISPER_IN_ROOM');
    await reject(0, {text: '目标均在房', targetAccountId: accounts[1].accountId}, 'WHISPER_OFFLINE');
    assert((await clients[1].callApi('Leave', {roomId: room.res.room.id, round: 1})).isSucc);
    await send({text: '返回大厅恢复', targetAccountId: accounts[1].accountId}, [0, 1]);
    const publicBefore = [...publicCounts];
    assert((await clients[0].callApi('LobbyChat', {text: '普通公共聊天'})).isSucc);
    await wait(() => [0, 1, 2].every(index => publicCounts[index] === publicBefore[index] + 1));
    await settle();
    assert.deepEqual(publicCounts, publicBefore.map((count, index) => count + Number([0, 1, 2].includes(index))));
    await clients[1].disconnect();
    await reject(0, {text: '大厅目标断线', targetAccountId: accounts[1].accountId}, 'WHISPER_OFFLINE');
    await clients[3].disconnect();
    assert((await clients[1].connect()).isSucc);
    await reject(0, {text: '重连未认证', targetAccountId: accounts[1].accountId}, 'WHISPER_OFFLINE');
    assert((await clients[1].callApi('Account', {token: accounts[1].token})).isSucc);
    await send({text: '重新认证恢复', targetAccountId: accounts[1].accountId}, [0, 1]);
    assert.deepEqual(routes.map(route => route.message.id), [1, 2, 3, 4, 5, 6]);
    writeFileSync('recovery/output/lobby-whisper-network.json', JSON.stringify({status: 'PASS', port,
      scope: 'Actual index server, normal auth/name/CreateRoom/Join/Leave/disconnect; rebuilt whisper routing, no persistence changes or state injection.',
      rejectedRequests: rejected, routes, counts: counts(), publicCounts, publicRegression: true}, null, 2) + '\n');
    console.log('PASS: lobby whisper by name/ID, ambiguity, multi-connection room isolation, Leave/disconnect and public regression');
  } finally {
    await Promise.allSettled(clients.map(client => client.disconnect()));
    server.kill('SIGTERM');
    await new Promise<void>(resolve => {if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve());});
    writeFileSync('recovery/output/lobby-whisper-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
