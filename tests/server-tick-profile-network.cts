import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const disconnectBurst = process.argv.includes('--disconnect-burst');
  const finishBurst = process.argv.includes('--finish-burst');
  const verifyTiming = process.argv.includes('--verify-timing');
  const prefix = resolve(`recovery/output/server-tick-profile-${stamp}`);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-tick-profile-'));
  const port = disconnectBurst ? 3396 : 3383, frames: MsgRoomSnapshot[][] = [], clients: WsClient<ServiceType>[] = [];
  const rooms: {id: string; host: WsClient<ServiceType>; guest: WsClient<ServiceType>}[] = [];
  let log = '';
  const tokens = new Map<WsClient<ServiceType>, string>();
  const disconnectHistories: {total: number; reason: string; matchId: string}[] = [];
  let disconnected = 0, removedRooms = 0;
  const server = spawn(process.execPath, ['--cpu-prof', '--cpu-prof-dir=recovery/output',
    `--cpu-prof-name=server-tick-profile-${stamp}.cpuprofile`, '--import', 'tsx', 'tests/server-tick-profile-entry.cts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'),
      CDTANK_TICK_PROFILE_STEPS: `${prefix}-steps.json`, MATCH_TIME_LIMIT_SECONDS: '75'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const wait = async (condition: () => boolean, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), log.slice(-700));
  };
  let status = 'FAIL', leaves = 0, observationStartedAt = 0;
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    // The original failing load used empty accounts and the supported default-role path.
    await Promise.all(Array.from({length: 20}, async (_, index) => {
      const pair = [0, 1].map(() => {
        const client = new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined,
          heartbeat: {interval: 5000, timeout: 10000}});
        const snapshots: MsgRoomSnapshot[] = []; frames.push(snapshots); clients.push(client);
        client.listenMsg('RoomSnapshot', snapshot => {snapshots.push(snapshot);});
        return client;
      });
      for (const client of pair) {
        assert((await client.connect()).isSucc);
        const account = await client.callApi('Account', {}); assert(account.isSucc);
        tokens.set(client, account.res.token);
      }
      const created = await pair[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: `节拍${index}`,
        name: '普通射手', tankId: 1, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
      assert((await pair[1].callApi('Join', {roomId: created.res.room.id, name: '观察',
        clientId: 'ignored', tankId: 1})).isSucc);
      rooms.push({id: created.res.room.id, host: pair[0], guest: pair[1]});
      for (const client of pair) assert((await client.callApi('Ready', {round: 1})).isSucc);
    }));
    await wait(() => frames.every(values => values.at(-1)?.phase === 'PLAYING'));
    observationStartedAt = Date.now();
    for (const room of rooms) assert((await room.host.sendMsg('PlayerInput', {sequence: 1, move: 0,
      turn: 0, aim: 0, fire: true, useItem: 0, clientTime: Date.now()})).isSucc);
    const started = Date.now();
    await wait(() => Date.now() - started >= ((finishBurst || disconnectBurst) ? 2000 : 20000), 25000);
    async function leave(room: (typeof rooms)[number]): Promise<void> {
      assert((await room.host.sendMsg('PlayerInput', {sequence: 2, move: 0, turn: 0, aim: 0,
        fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      for (const client of [room.guest, room.host]) {
        assert((await client.callApi('Leave', {roomId: room.id, round: 1})).isSucc); leaves++;
      }
    }
    if (disconnectBurst) {
      await Promise.all(rooms.slice(1).flatMap(room => [room.guest, room.host]).map(async client => {
        await client.disconnect(); disconnected++;
      }));
      // Client close completion precedes the server departure flow; wait for authoritative removal.
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const listed = await rooms[0].host.callApi('ListRooms', {}); assert(listed.isSucc);
        removedRooms = rooms.slice(1).filter(room => !listed.res.rooms.some(value => value.id === room.id)).length;
        if (removedRooms === 19) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(removedRooms, 19);
      const finished = Date.now();
      await wait(() => Date.now() - finished >= 1000);
      for (const room of rooms.slice(1)) for (const client of [room.host, room.guest]) {
        assert((await client.connect()).isSucc);
        assert((await client.callApi('Account', {token: tokens.get(client)!})).isSucc);
        const history = await client.callApi('History', {}); assert(history.isSucc);
        assert.equal(history.res.total, 1); assert.equal(history.res.records[0].reason, 'FORFEIT');
        disconnectHistories.push({total: history.res.total, reason: history.res.records[0].reason,
          matchId: history.res.records[0].matchId});
      }
      await leave(rooms[0]);
    } else if (finishBurst) {
      await Promise.all(rooms.slice(1).map(leave));
      const finished = Date.now();
      await wait(() => Date.now() - finished >= 1000);
      await leave(rooms[0]);
    } else for (const room of rooms) await leave(room);
    if (verifyTiming) {
      const gaps = frames.flatMap(values => values.slice(1).flatMap((snapshot, index) =>
        values[index].serverTime >= observationStartedAt && snapshot.phase === 'PLAYING'
          ? [snapshot.serverTime - values[index].serverTime] : []));
      assert(gaps.length > 100);
      assert(Math.max(...gaps) <= 150, `live room tick gap ${Math.max(...gaps)}ms exceeds 150ms`);
    }
    status = verifyTiming ? 'PASS_TIMING_SCOPE' : 'MEASURED';
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    const steps = JSON.parse(readFileSync(`${prefix}-steps.json`, 'utf8'));
    const series = frames.map(values => {
      const playing = values.filter(snapshot => snapshot.phase === 'PLAYING');
      return {ticks: playing.length, gaps: playing.slice(1).map((snapshot, index) =>
        ({tick: snapshot.tick, milliseconds: snapshot.serverTime - playing[index].serverTime}))};
    });
    writeFileSync(`${prefix}.json`, JSON.stringify({status, leaves, finishBurst, disconnectBurst, disconnected, removedRooms, disconnectHistories, observationStartedAt, series, steps,
      scope: '20 legal rooms/40 empty Account connections, default role and normal held2001 input. CPU profile is measurement overhead; no active-state injection or full maximum-map claim.'}, null, 2));
    writeFileSync(`${prefix}.log`, log); rmSync(directory, {recursive: true, force: true});
  }
  console.log(`MEASURED: ${prefix}.json`);
}
void main();
