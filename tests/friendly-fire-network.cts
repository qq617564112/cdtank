import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {MAPS} from '../apps/server/src/config';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-friendly-fire-'));
  let server: ChildProcess | undefined, log = '';
  const clients = Array.from({length: 3}, () => new WsClient(serviceProto,
    {server: 'ws://127.0.0.1:3180', logger: undefined}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const events: MsgRoomEvent[] = [], rows: object[] = [];
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', value => {snapshots[index] = value;}));
  clients[0].listenMsg('RoomEvent', value => {events.push(value);});
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1500));
  }
  try {
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3180', TICK_RATE: '20',
      ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')};
    delete environment.MATCH_MIN_PLAYERS; delete environment.MATCH_TIME_LIMIT_SECONDS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'],
      {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started'));
    for (const enabled of [false, true]) {
      snapshots.length = 0; events.length = 0;
      for (const client of clients) {
        assert((await client.connect()).isSucc);
        assert((await client.callApi('Account', {})).isSucc);
      }
      if (!enabled) {
        const before = await clients[0].callApi('ListRooms', {}); assert(before.isSucc);
        for (const mode of [4, 5]) {
          const rejected = await clients[0].callApi('CreateRoom', {mode,
            mapId: MAPS.find(map => map.mode === mode)!.mapId,
            roomName: 'Bad', name: 'Owner', tankId: 1, friendlyFire: true});
          assert(!rejected.isSucc && rejected.err.message.includes('友军伤害'));
        }
        const invalid = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7,
          roomName: 'Bad', name: 'Owner', tankId: 1, friendlyFire: 1 as unknown as boolean});
        assert(!invalid.isSucc);
        const after = await clients[0].callApi('ListRooms', {}); assert(after.isSucc);
        assert.deepEqual(after.res, before.res);
      }
      const request = {mode: 1, mapId: 7, roomName: 'Friendly fire', name: 'Owner', tankId: 1,
        minPlayers: 3, maxPlayers: 4, ...(enabled ? {friendlyFire: true} : {})};
      const owner = await clients[0].callApi('CreateRoom', request); assert(owner.isSucc);
      const roomId = owner.res.room.id;
      const retry = await clients[0].callApi('CreateRoom', {...request, friendlyFire: enabled});
      assert(retry.isSucc); assert.equal(retry.res.playerId, owner.res.playerId);
      assert(!(await clients[0].callApi('CreateRoom', {...request, friendlyFire: !enabled})).isSucc);
      const friend = await clients[1].callApi('Join', {roomId, name: 'Friend', tankId: 1, clientId: ''});
      assert(friend.isSucc);
      assert((await clients[1].callApi('ChangeTeam', {round: 1, team: 0})).isSucc);
      assert((await clients[2].callApi('Join', {roomId, name: 'Enemy', tankId: 1, clientId: ''})).isSucc);
      const listed = await clients[2].callApi('ListRooms', {}); assert(listed.isSucc);
      assert.equal(listed.res.rooms.find(room => room.id === roomId)!.friendlyFire, enabled);
      for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
      await wait(() => snapshots.length === 3 && snapshots.every(snapshot => snapshot?.phase === 'PLAYING'));
      assert(snapshots.every(snapshot => snapshot!.match!.friendlyFire === enabled));
      const initial = snapshots[0]!.players.find(player => player.id === friend.res.playerId)!;
      let sequence = 0, observedTick = -1;
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline && !events.some(event => event.type === 'friendlyFire')) {
        const snapshot = snapshots[0]!;
        if (snapshot.tick !== observedTick) {
          observedTick = snapshot.tick;
          const attacker = snapshot.players.find(player => player.id === owner.res.playerId)!;
          const target = snapshot.players.find(player => player.id === friend.res.playerId)!;
          const desired = Math.atan2(target.x - attacker.x, target.z - attacker.z);
          const error = Math.atan2(Math.sin(desired - attacker.yaw - attacker.aim), Math.cos(desired - attacker.yaw - attacker.aim));
          assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0, useItem: 0,
            aim: Math.max(-1, Math.min(1, error / (.9 * .05))), fire: Math.abs(error) < .02,
            clientTime: Date.now()})).isSucc);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert(events.some(event => event.type === 'friendlyFire' && event.targetId === friend.res.playerId));
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0, useItem: 0,
        aim: 0, fire: false, clientTime: Date.now()})).isSucc);
      await new Promise(resolve => setTimeout(resolve, 100));
      const final = snapshots[0]!;
      const attacker = final.players.find(player => player.id === owner.res.playerId)!;
      const target = final.players.find(player => player.id === friend.res.playerId)!;
      const hitEvents = events.filter(event => event.type === 'friendlyFire');
      assert.equal(attacker.score, hitEvents.length * -10); assert.equal(attacker.kills, 0);
      assert.deepEqual(final.teamScores, [0, 0]);
      assert(events.some(event => event.type === 'fire' && event.playerId === owner.res.playerId));
      if (enabled) {
        assert(target.hp < initial.hp);
        assert(events.some(event => event.type === 'hit' && event.targetId === friend.res.playerId && event.value > 0));
      } else {
        assert.equal(target.hp, initial.hp); assert(!events.some(event => event.type === 'hit'));
      }
      rows.push({enabled, initial, attacker, target, teamScores: final.teamScores,
        snapshotsAgree: snapshots.every(snapshot => snapshot!.match!.friendlyFire === enabled), events: [...events]});
      for (const client of clients) await client.disconnect();
    }
    writeFileSync('recovery/output/friendly-fire-network.json', JSON.stringify({status: 'PASS', port: 3180,
      authenticatedConnectionsPerRoom: 3, rows, unsupportedModesRejected: [4, 5], invalidBooleanRejected: true,
      normalizedRetry: true, differentFlagRejected: true,
      scope: 'Real WebSocket server, ordinary Account/CreateRoom/Join/ChangeTeam/Ready and snapshot-derived PlayerInput aim/fire. No state injection.'}, null, 2));
    console.log('PASS: real :3180 authenticated config/rejections/snapshots and actual ordinary teammate aim/fire OFF noHP / ON HP loss');
  } finally {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
