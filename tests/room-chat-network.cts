import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import {serviceProto} from '../apps/shared/protocols/serviceProto';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-room-chat-'));
  const database = join(directory, 'accounts.sqlite');
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open()];
  store.close();
  const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3155', ACCOUNT_DB_PATH: database};
  delete environment.MATCH_MIN_PLAYERS;
  delete environment.MATCH_TIME_LIMIT_SECONDS;
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', value => {log += String(value);});
  server.stderr!.on('data', value => {log += String(value);});
  const clients = accounts.map(() => new WsClient(serviceProto, {
    server: 'ws://127.0.0.1:3155', logger: undefined,
  }));
  const chats: MsgRoomEvent[][] = clients.map(() => []);
  const snapshots: (MsgRoomSnapshot | undefined)[] = clients.map(() => undefined);
  const snapshotCounts = clients.map(() => 0);
  clients.forEach((client, index) => {
    client.listenMsg('RoomEvent', message => {
      if (message.type === 'chat') chats[index].push(message);
    });
    client.listenMsg('RoomSnapshot', message => {
      snapshots[index] = message;
      snapshotCounts[index]++;
    });
  });
  async function wait(check: () => boolean, timeout = 8000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Room chat timeout; server log: ${log.slice(-1500)}`);
  }
  const counts = () => chats.map(messages => messages.length);
  async function advance(index: number): Promise<void> {
    const count = snapshotCounts[index];
    await wait(() => snapshotCounts[index] >= count + 2);
  }
  async function accepted(index: number, text: string, name: string, playerId: string,
      roomId: string, recipients: number[]): Promise<MsgRoomEvent> {
    const before = counts();
    const response = await clients[index].callApi('RoomChat', {text, channel: 0});
    assert(response.isSucc);
    assert.deepEqual(response.res, {message: `${name}: ${text.trim()}`, playerId, roomId});
    await wait(() => recipients.every(recipient => chats[recipient].length === before[recipient] + 1));
    await advance(index);
    assert.deepEqual(counts(), before.map((count, recipient) => count + Number(recipients.includes(recipient))));
    const event = chats[recipients[0]].at(-1)!;
    assert.equal(event.roomId, roomId);
    assert.equal(event.playerId, playerId);
    assert.equal(event.message, response.res.message);
    for (const recipient of recipients) assert.deepEqual(chats[recipient].at(-1), event);
    return event;
  }
  try {
    await wait(() => log.includes('Server started at 3155.'), 15000);
    for (let index = 0; index < clients.length; index++) {
      assert((await clients[index].connect()).isSucc);
      assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const notJoined = await clients[0].callApi('RoomChat', {text: '加入前', channel: 0});
    assert(!notJoined.isSucc);
    assert.equal(notJoined.err.code, 'NOT_JOINED');
    assert.deepEqual(counts(), [0, 0, 0]);
    const owner = await clients[0].callApi('CreateRoom', {
      mode: 1, mapId: 7, roomName: '房间聊天', name: 'Owner', tankId: 1,
    });
    assert(owner.isSucc);
    const guest = await clients[1].callApi('Join', {
      roomId: owner.res.room.id, clientId: 'untrusted-identity', name: 'Guest', tankId: 1,
    });
    assert(guest.isSucc);
    const other = await clients[2].callApi('CreateRoom', {
      mode: 1, mapId: 7, roomName: '另一个房间', name: 'Other', tankId: 1,
    });
    assert(other.isSucc);
    await wait(() => snapshots.every(Boolean) && snapshots[0]!.players.length === 2);
    assert.equal(snapshots[0]!.phase, 'WAITING');
    assert.notEqual(owner.res.playerId, guest.res.playerId);
    assert.notEqual(guest.res.playerId, 'untrusted-identity');
    const waiting = await accepted(0, '  集合进攻，中文聊天  ', 'Owner', owner.res.playerId,
      owner.res.room.id, [0, 1]);
    const invalid = [
      {text: '   ', channel: 0},
      {text: '伪造\n姓名', channel: 0},
      {text: '中'.repeat(73), channel: 0},
      {text: '不支持的频道', channel: 2},
    ];
    const beforeRejected = counts();
    for (const request of invalid) {
      const response = await clients[0].callApi('RoomChat', request);
      assert(!response.isSucc);
      assert.equal(response.err.code, 'CHAT_REJECTED');
    }
    await advance(0);
    assert.deepEqual(counts(), beforeRejected, 'Rejected chat must emit no room events');
    const boundary = await accepted(0, '中'.repeat(72), 'Owner', owner.res.playerId,
      owner.res.room.id, [0, 1]);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]!.phase === 'PLAYING' && snapshots[1]!.phase === 'PLAYING');
    const playing = await accepted(1, '战斗中继续聊天', 'Guest', guest.res.playerId,
      owner.res.room.id, [0, 1]);
    assert(snapshots[0]!.players.every(player => player.hp === player.maxHp));
    assert.equal(snapshots[0]!.bullets.length, 0);
    await clients[1].disconnect();
    await wait(() => !snapshots[0]!.players.some(player => player.id === guest.res.playerId));
    assert((await clients[1].connect()).isSucc);
    assert((await clients[1].callApi('Account', {token: accounts[1].token})).isSucc);
    snapshots[1] = undefined;
    const rejoined = await clients[1].callApi('Join', {
      roomId: other.res.room.id, clientId: 'untrusted-identity', name: 'Rejoined', tankId: 1,
    });
    assert(rejoined.isSucc);
    assert.notEqual(rejoined.res.playerId, guest.res.playerId);
    assert.notEqual(rejoined.res.playerId, 'untrusted-identity');
    await wait(() => snapshots[1]?.roomId === other.res.room.id);
    const formerRoom = await accepted(0, '原房间消息', 'Owner', owner.res.playerId,
      owner.res.room.id, [0]);
    const newRoom = await accepted(1, '新房间消息', 'Rejoined', rejoined.res.playerId,
      other.res.room.id, [1, 2]);
    assert.deepEqual(counts(), [4, 4, 1]);
    writeFileSync('recovery/output/room-chat-network.json', JSON.stringify({
      status: 'PASS', port: 3155, authenticatedClients: 3, acceptedRequests: 5,
      rejectedRequests: 5, deliveredChatEvents: 9, perClientChatEvents: counts(),
      rejectedCodes: {beforeJoin: 'NOT_JOINED', invalid: 'CHAT_REJECTED'},
      invalidRequests: invalid, boundaryCharacters: 72,
      ownerPlayerId: owner.res.playerId, guestPlayerId: guest.res.playerId,
      rejoinedPlayerId: rejoined.res.playerId,
      events: {waiting, boundary, playing, formerRoom, newRoom},
      scope: 'Isolated TSRPC server3155, three authenticated clients, normal CreateRoom/Join/Ready, acknowledged room chat, waiting/playing delivery, validation, room isolation and disconnect/rejoin identity. No player input or HP injection.',
    }, null, 2));
    console.log('PASS: room chat acknowledged requests, five rejections, waiting/playing, Chinese/72-character text, three-client room isolation and disconnect/rejoin identity; 5 accepted requests, 9 delivered events');
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const exited = new Promise<void>(resolve => server.once('exit', () => resolve()));
      server.kill('SIGTERM');
      await exited;
    }
    writeFileSync('recovery/output/room-chat-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
