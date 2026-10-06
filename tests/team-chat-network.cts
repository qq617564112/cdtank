import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {MAPS} from '../apps/server/src/config';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';
import {serviceProto} from '../apps/shared/protocols/serviceProto';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-team-chat-'));
  const database = join(directory, 'accounts.sqlite');
  const store = new AccountStore(database);
  const accounts = [store.open(), store.open(), store.open(), store.open()];
  store.close();
  const env: NodeJS.ProcessEnv = {...process.env, PORT: '3186', ACCOUNT_DB_PATH: database};
  delete env.MATCH_MIN_PLAYERS;
  delete env.MATCH_TIME_LIMIT_SECONDS;
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', value => {log += String(value);});
  server.stderr!.on('data', value => {log += String(value);});
  const clients = accounts.map(() => new WsClient(serviceProto, {
    server: 'ws://127.0.0.1:3186', logger: undefined,
  }));
  const chats: MsgRoomEvent[][] = clients.map(() => []);
  const snapshots: (MsgRoomSnapshot | undefined)[] = clients.map(() => undefined);
  const snapshotCounts = clients.map(() => 0);
  clients.forEach((client, index) => {
    client.listenMsg('RoomEvent', value => {if (value.type === 'chat') chats[index].push(value);});
    client.listenMsg('RoomSnapshot', value => {snapshots[index] = value; snapshotCounts[index]++;});
  });
  const counts = () => chats.map(values => values.length);
  async function wait(check: () => boolean, timeout = 8000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Team chat timeout: ${log.slice(-1500)}`);
  }
  async function advance(index: number): Promise<void> {
    const count = snapshotCounts[index];
    await wait(() => snapshotCounts[index] >= count + 2);
  }
  const acceptedEvents: MsgRoomEvent[] = [];
  const routes: {text: string; channel: number; recipients: number[]; legacy: boolean}[] = [];
  async function accepted(index: number, text: string, channel: number, recipients: number[], legacy = false): Promise<void> {
    const before = counts();
    const sender = snapshots[index]!.players.find(value => value.id === playerIds[index])!;
    const message = `${channel === 1 ? '[队伍] ' : ''}${sender.name}: ${text.trim()}`;
    if (legacy) assert((await clients[index].sendMsg('Chat', {text, channel})).isSucc);
    else {
      const response = await clients[index].callApi('RoomChat', {text, channel});
      assert(response.isSucc);
      assert.deepEqual(response.res, {roomId: snapshots[index]!.roomId,
        playerId: playerIds[index], message});
    }
    await wait(() => recipients.every(recipient => chats[recipient].length === before[recipient] + 1));
    await advance(index);
    assert.deepEqual(counts(), before.map((count, recipient) => count + Number(recipients.includes(recipient))));
    const event = chats[recipients[0]].at(-1)!;
    assert.equal(event.message, message);
    assert.equal(event.value, channel);
    assert.equal(event.playerId, playerIds[index]);
    for (const recipient of recipients) assert.deepEqual(chats[recipient].at(-1), event);
    acceptedEvents.push(event);
    routes.push({text, channel, recipients, legacy});
  }
  let rejected = 0;
  async function reject(index: number, text: string, channel: number, legacy = false): Promise<void> {
    const before = counts();
    if (legacy) assert((await clients[index].sendMsg('Chat', {text, channel})).isSucc);
    else {
      const response = await clients[index].callApi('RoomChat', {text, channel});
      assert(!response.isSucc);
      assert.equal(response.err.code, 'CHAT_REJECTED');
    }
    await advance(index);
    assert.deepEqual(counts(), before, 'Rejected chat broadcasts nothing');
    rejected++;
  }
  const playerIds: string[] = [];
  try {
    await wait(() => log.includes('Server started at 3186.'), 15000);
    for (let index = 0; index < clients.length; index++) {
      assert((await clients[index].connect()).isSucc);
      assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const noRoom = await clients[0].callApi('RoomChat', {text: '加入前', channel: 1});
    assert(!noRoom.isSucc && noRoom.err.code === 'NOT_JOINED');
    const created = await clients[0].callApi('CreateRoom', {
      mode: 1, mapId: 7, roomName: '队伍聊天', name: 'Owner', tankId: 1,
    });
    assert(created.isSucc);
    playerIds[0] = created.res.playerId;
    for (const [index, name] of [[1, 'Friend'], [2, 'Enemy']] as const) {
      const joined = await clients[index].callApi('Join', {
        roomId: created.res.room.id, clientId: 'untrusted', name, tankId: 1,
      });
      assert(joined.isSucc);
      playerIds[index] = joined.res.playerId;
    }
    const personal = await clients[3].callApi('CreateRoom', {
      mode: 4, mapId: MAPS.find(value => value.mode === 4)!.mapId,
      roomName: '个人房间', name: 'Other', tankId: 1,
    });
    assert(personal.isSucc);
    playerIds[3] = personal.res.playerId;
    // Use only current-round ChangeTeam requests to establish the intended composition.
    assert((await clients[0].callApi('ChangeTeam', {round: 1, team: 0})).isSucc);
    assert((await clients[1].callApi('ChangeTeam', {round: 1, team: 0})).isSucc);
    assert((await clients[2].callApi('ChangeTeam', {round: 1, team: 1})).isSucc);
    await wait(() => snapshots.every(Boolean) && snapshots[0]!.players.length === 3
      && snapshots[0]!.players.find(value => value.id === playerIds[1])?.team === 0);
    assert.equal(snapshots[0]!.phase, 'WAITING');
    await accepted(0, '  同队集合  ', 1, [0, 1]);
    await accepted(2, '对方队伍', 1, [2]);
    await accepted(0, '公共频道', 0, [0, 1, 2]);
    assert((await clients[1].callApi('ChangeTeam', {round: 1, team: 1})).isSucc);
    await wait(() => snapshots[0]!.players.find(value => value.id === playerIds[1])?.team === 1);
    await accepted(0, '换队后旧队', 1, [0]);
    await accepted(1, '换队后新队', 1, [1, 2]);
    await accepted(2, '旧消息入口', 1, [1, 2], true);
    await accepted(1, '中'.repeat(72), 1, [1, 2]);
    for (const [text, channel] of [['空频道', 2], [' ', 1], ['伪造\n姓名', 1], ['中'.repeat(73), 1]] as const) {
      await reject(0, text, channel);
    }
    await reject(0, '旧入口无效频道', 2, true);
    await reject(3, '个人战不能发队伍', 1);
    await reject(3, '个人战旧入口', 1, true);
    await accepted(3, '个人房间公共', 0, [3]);
    for (const index of [0, 1, 2]) assert((await clients[index].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.slice(0, 3).every(value => value?.phase === 'PLAYING'));
    await accepted(1, '对局中队伍', 1, [1, 2]);
    await accepted(0, '对局中公共', 0, [0, 1, 2]);
    const changed = await clients[1].callApi('ChangeTeam', {round: 1, team: 0});
    assert(!changed.isSucc, 'Playing team changes remain rejected');
    await accepted(1, '对局队伍仍一致', 1, [1, 2]);
    // Reconnect the fourth account normally, in mode5, to cover both personal modes.
    await clients[3].disconnect();
    assert((await clients[3].connect()).isSucc);
    assert((await clients[3].callApi('Account', {token: accounts[3].token})).isSucc);
    snapshots[3] = undefined;
    const breach = await clients[3].callApi('CreateRoom', {
      mode: 5, mapId: MAPS.find(value => value.mode === 5)!.mapId,
      roomName: '破坏房间', name: 'Other5', tankId: 1,
    });
    assert(breach.isSucc);
    playerIds[3] = breach.res.playerId;
    await wait(() => snapshots[3]?.roomId === breach.res.room.id);
    await reject(3, '破坏模式队伍', 1);
    await accepted(3, '破坏模式公共', 0, [3]);
    writeFileSync('recovery/output/team-chat-network.json', JSON.stringify({status: 'PASS',
      port: 3186, authenticatedClients: 4, teamMode: 1, personalModesRejected: [4, 5],
      phases: ['WAITING', 'PLAYING'], noRoomCode: 'NOT_JOINED', rejectedRequests: rejected,
      boundaryCharacters: 72, dynamicTeamChange: true, legacyRoute: true,
      perClientChatEvents: counts(), routes, events: acceptedEvents,
      scope: 'Actual server3186, four account-owned clients, normal CreateRoom/Join/ChangeTeam/Ready, API and legacy chat, current-team and room isolation, public regression, both personal-mode rejections. No state injection.'}, null, 2));
    console.log('PASS: four-client team chat, current-team changes, enemy/other-room isolation, waiting/playing, API/legacy, personal4/5 rejection and public baseline');
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const exited = new Promise<void>(resolve => server.once('exit', () => resolve()));
      server.kill('SIGTERM');
      await exited;
    }
    writeFileSync('recovery/output/team-chat-network.log', log);
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
