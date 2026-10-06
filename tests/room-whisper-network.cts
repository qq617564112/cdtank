import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomWhisper} from '../apps/shared/protocols/MsgRoomWhisper';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-room-whisper-'));
  const database = join(directory, 'accounts.sqlite'), port = 3205;
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open(), store.open()];
  for (const [index, name] of ['发送者', '目标', '同房旁观', '异房旁观'].entries()) store.setDisplayName(accounts[index].accountId, name);
  store.close();
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_MIN_PLAYERS: '2', MATCH_TIME_LIMIT_SECONDS: '3'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', value => {log += String(value);});
  server.stderr!.on('data', value => {log += String(value);});
  const clients = Array.from({length: 6}, () => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined}));
  const received: MsgRoomWhisper[][] = clients.map(() => []), publicCounts = clients.map(() => 0);
  let snapshot: MsgRoomSnapshot | undefined;
  clients.forEach((client, index) => {
    client.listenMsg('RoomWhisper', message => {received[index].push(message);});
    client.listenMsg('RoomEvent', event => {if (event.type === 'chat') publicCounts[index]++;});
  });
  clients[0].listenMsg('RoomSnapshot', value => {snapshot = value;});
  const routes: Array<{phase: string; recipients: number[]; message: MsgRoomWhisper}> = [];
  let roomId = '', rejected = 0;
  const counts = () => received.map(values => values.length);
  async function wait(check: () => boolean): Promise<void> {
    const end = Date.now() + 10000;
    while (!check() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  async function settle(): Promise<void> {
    for (const client of clients.filter(client => client.isConnected)) assert((await client.callApi('ListRooms', {})).isSucc);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  async function send(targetName: string, recipients: number[]): Promise<void> {
    const before = counts();
    const result = await clients[0].callApi('RoomWhisper', {roomId, round: snapshot!.match!.round, targetName, text: '  普通房间密语  '});
    assert(result.isSucc);
    assert.equal(result.res.message.roomId, roomId);
    assert.equal(result.res.message.round, snapshot!.match!.round);
    assert.equal(result.res.message.accountId, accounts[0].accountId);
    assert.equal(result.res.message.senderName, '发送者');
    assert.equal(result.res.message.targetName, targetName.trim());
    await wait(() => recipients.every(index => received[index].length === before[index] + 1));
    await settle();
    assert.deepEqual(counts(), before.map((count, index) => count + Number(recipients.includes(index))));
    for (const index of recipients) assert.deepEqual(received[index].at(-1), result.res.message);
    routes.push({phase: snapshot!.phase, recipients, message: result.res.message});
  }
  async function reject(index: number, code: string, changes: {text?: string; targetName?: string; roomId?: string; round?: number} = {}): Promise<void> {
    const before = counts();
    const result = await clients[index].callApi('RoomWhisper', {roomId, round: snapshot!.match!.round,
      text: '拒绝', targetName: '目标', ...changes});
    assert(!result.isSucc && result.err.code === code);
    await settle();
    assert.deepEqual(counts(), before);
    rejected++;
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
    for (const [index, account] of [[0, accounts[0]], [1, accounts[1]], [2, accounts[2]], [3, accounts[3]], [4, accounts[1]]] as const) {
      assert((await clients[index].callApi('Account', {token: account.token})).isSucc);
    }
    const created = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7, roomName: '房间密语', name: '冒名', tankId: 1});
    assert(created.isSucc);
    roomId = created.res.room.id;
    assert((await clients[2].callApi('Join', {roomId, clientId: 'ignored', name: '第三方', tankId: 1})).isSucc);
    const other = await clients[3].callApi('CreateRoom', {mode: 1, mapId: 7, roomName: '另一房', name: '第三方', tankId: 1});
    assert(other.isSucc);
    await wait(() => snapshot?.players.length === 2);
    await send('  目标  ', [0, 1, 4]);
    await reject(5, 'ACCOUNT_REQUIRED');
    await reject(1, 'NOT_JOINED');
    await reject(0, 'ROUND_CONFLICT', {roomId: 'wrong-room'});
    await reject(0, 'ROUND_CONFLICT', {round: 99});
    for (const text of ['', '中'.repeat(73), '控制\n字符']) await reject(0, 'WHISPER_REJECTED', {text});
    await reject(0, 'WHISPER_SELF', {targetName: '发送者'});
    await reject(0, 'WHISPER_OFFLINE', {targetName: '不存在'});
    assert((await clients[1].callApi('Join', {roomId, clientId: 'ignored', name: '冒名', tankId: 1})).isSucc);
    await send('目标', [0, 1, 4]);
    assert((await clients[4].callApi('Join', {roomId: other.res.room.id, clientId: 'ignored', name: '冒名', tankId: 1})).isSucc);
    await send('目标', [0, 1, 4]);
    const chat = await clients[0].callApi('RoomChat', {channel: 0, text: '公共回归'});
    assert(chat.isSucc);
    await settle();
    assert.deepEqual(publicCounts, [1, 1, 1, 0, 0, 0]);
    assert((await clients[0].callApi('ChangeTeam', {round: 1, team: 0})).isSucc);
    assert((await clients[1].callApi('ChangeTeam', {round: 1, team: 0})).isSucc);
    assert((await clients[2].callApi('ChangeTeam', {round: 1, team: 1})).isSucc);
    assert((await clients[0].callApi('RoomChat', {channel: 1, text: '队伍回归'})).isSucc);
    await settle();
    assert.deepEqual(publicCounts, [2, 2, 1, 0, 0, 0]);
    for (const index of [0, 1, 2]) assert((await clients[index].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshot?.phase === 'PLAYING');
    await send('目标', [0, 1, 4]);
    await wait(() => snapshot?.phase === 'FINISHED');
    assert.equal(snapshot!.match!.result!.reason, 'TIME_LIMIT');
    await send('目标', [0, 1, 4]);
    for (const index of [0, 1, 2]) assert((await clients[index].callApi('Rematch', {round: 1})).isSucc);
    await wait(() => snapshot?.match?.round === 2);
    await reject(0, 'ROUND_CONFLICT', {round: 1});
    await send('目标', [0, 1, 4]);
    await clients[1].disconnect();
    await send('目标', [0, 4]);
    await clients[4].disconnect();
    await reject(0, 'WHISPER_OFFLINE');
    assert((await clients[1].connect()).isSucc);
    assert((await clients[1].callApi('Account', {token: accounts[1].token})).isSucc);
    assert((await clients[1].callApi('DisplayName', {name: '异房旁观'})).isSucc);
    await reject(0, 'WHISPER_AMBIGUOUS', {targetName: '异房旁观'});
    writeFileSync('recovery/output/room-whisper-network.json', JSON.stringify({status: 'PASS', port,
      scope: 'Actual server, normal authenticated joins/teams/ready, natural3s TIME_LIMIT, consensus rematch and disconnect; rebuilt cross-account whispers with sender room/round, no state injection.',
      rejectedRequests: rejected, routes, counts: counts(), publicCounts,
      phases: ['WAITING', 'PLAYING', 'FINISHED'], staleRoundRejected: true}, null, 2) + '\n');
    console.log('PASS: room whisper cross-lobby/room accounts, phase lifecycle, stale round, ambiguity, disconnect and public/team regression');
  } finally {
    await Promise.allSettled(clients.map(client => client.disconnect()));
    server.kill('SIGTERM');
    await new Promise<void>(resolve => {if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve());});
    writeFileSync('recovery/output/room-whisper-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
