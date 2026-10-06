import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-room-limits-'));
  let server: ChildProcess | undefined, log = '';
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto,
    {server: 'ws://127.0.0.1:3178', logger: undefined}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', value => {snapshots[index] = value;}));
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1500));
  }
  try {
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3178', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')};
    delete environment.MATCH_MIN_PLAYERS; delete environment.MATCH_TIME_LIMIT_SECONDS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'],
      {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started'));
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {})).isSucc);
    }
    const before = await clients[0].callApi('ListRooms', {}); assert(before.isSucc);
    for (const limits of [{minPlayers: 1, maxPlayers: 3}, {minPlayers: 3, maxPlayers: 7},
      {minPlayers: 4, maxPlayers: 3}, {minPlayers: 2.5, maxPlayers: 3}]) {
      const rejected = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7,
        roomName: 'Bad', name: 'Owner', tankId: 1, ...limits});
      assert(!rejected.isSucc);
    }
    const after = await clients[0].callApi('ListRooms', {}); assert(after.isSucc);
    assert.deepEqual(after.res, before.res);
    const request = {mode: 1, mapId: 7, roomName: '三人房', name: 'Owner', tankId: 1, minPlayers: 3, maxPlayers: 3};
    const owner = await clients[0].callApi('CreateRoom', request); assert(owner.isSucc);
    const roomId = owner.res.room.id;
    const retry = await clients[0].callApi('CreateRoom', request); assert(retry.isSucc);
    assert.equal(retry.res.playerId, owner.res.playerId);
    assert(!(await clients[0].callApi('CreateRoom', {...request, minPlayers: 2})).isSucc);
    const joinRequest = {roomId, name: 'Guest', tankId: 1, clientId: ''};
    assert((await clients[1].callApi('Join', joinRequest)).isSucc);
    for (const client of clients.slice(0, 2)) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]?.players.length === 2 && snapshots[0]?.match?.readyPlayerIds.length === 2);
    assert.equal(snapshots[0]!.phase, 'WAITING');
    assert((await clients[2].callApi('Join', {...joinRequest, name: 'Third'})).isSucc);
    const denied = await clients[3].callApi('Join', {...joinRequest, name: 'Fourth'});
    assert(!denied.isSucc && denied.err.message.includes('房间已满'));
    const listed = await clients[3].callApi('ListRooms', {}); assert(listed.isSucc);
    const summary = listed.res.rooms.find(room => room.id === roomId)!;
    assert.equal(summary.playerCount, 3); assert.equal(summary.minPlayers, 3); assert.equal(summary.maxPlayers, 3);
    assert((await clients[2].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.slice(0, 3).every(value => value?.phase === 'PLAYING'));
    for (const value of snapshots.slice(0, 3)) {
      assert.equal(value!.match!.minPlayers, 3); assert.equal(value!.match!.maxPlayers, 3);
      assert.equal(value!.players.length, 3);
    }
    writeFileSync('recovery/output/room-player-limits-network.json', JSON.stringify({status: 'PASS',
      port: 3178, authenticatedAccounts: 4, joinedAccounts: 3, fourthFullRejected: true,
      readyTwoWaiting: true, readyThreeStarted: true, summary, snapshotLimits: [3, 3],
      invalidRequestsRejected: 4, invalidRequestsLeaveNoRooms: true, sameSettingsRetry: true,
      differentSettingsRejected: true}, null, 2));
    console.log('PASS: isolated TCP/WebSocket :3178, authenticated create/join/ready 3/3, fourth denied, snapshots and directory agree');
  } finally {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
