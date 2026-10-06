import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo-life-')), port = 3265;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'),
      MATCH_TIME_LIMIT_SECONDS: '35'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 4, mapId: 7,
    scope: 'Fresh actual Accounts; ordinary CPU autonomous combat, natural death/respawn/settlement and normal unanimous Rematch. No owned/inventory imports or live state injection.'};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {})).isSucc);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
    }
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '弹匣生涯',
      name: '普通玩家', tankId: 1, minPlayers: 2, maxPlayers: 4}); assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id, clientId: 'ignored',
      name: '自然受击', tankId: 1}); assert(guest.isSucc);
    const cpu = await clients[0].callApi('Cpu', {operation: 'ADD', round: 1, tankId: 1}); assert(cpu.isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames[0].some(row => row.snapshot.phase === 'PLAYING'));
    const initial = frames[0].find(row => row.snapshot.phase === 'PLAYING')!;
    evidence.initial = initial;
    const initialPlayer = initial.snapshot.players.find(player => player.id === guest.res.playerId)!;
    const capacity = initialPlayer.ammoMagazine!.capacity;
    assert.equal(capacity, 6);
    // Only ordinary fire input changes the guest's starting magazine before death.
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0,
      fire: true, useItem: 0, clientTime: Date.now()})).isSucc);
    await wait(() => events[0].some(event => event.type === 'fire' && event.playerId === guest.res.playerId));
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 2, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    await wait(() => frames[0].some(row => row.snapshot.players.some(player =>
      player.id === guest.res.playerId && player.ammoMagazine?.remaining === capacity - 1)));
    await wait(() => events[0].some(event => event.type === 'respawn' && event.playerId === guest.res.playerId), 33000);
    const dead = frames[0].find(row => row.snapshot.players.some(player => player.id === guest.res.playerId && !player.alive))!;
    assert(dead, 'CPU must cause natural death');
    const restored = frames[0].find(row => row.snapshot.tick > dead.snapshot.tick
      && row.snapshot.players.some(player => player.id === guest.res.playerId && player.alive))!;
    assert(restored);
    const player = restored.snapshot.players.find(player => player.id === guest.res.playerId)!;
    assert.deepEqual(player.ammoMagazine, {remaining: capacity, capacity});
    assert.equal(player.ammoItemId, 2001);
    evidence.respawn = {dead, restored, serverSeconds: (restored.snapshot.serverTime - dead.snapshot.serverTime) / 1000,
      simulationSeconds: (restored.snapshot.tick - dead.snapshot.tick) * .05,
      wallSeconds: (restored.wallTime - dead.wallTime) / 1000};
    await wait(() => latest().phase === 'FINISHED', 22000);
    evidence.finished = frames[0].at(-1);
    for (const client of clients) assert((await client.callApi('Rematch', {round: 1})).isSucc);
    await wait(() => latest().match?.round === 2 && latest().phase === 'PLAYING');
    const restart = frames[0].find(row => row.snapshot.match?.round === 2 && row.snapshot.phase === 'PLAYING')!;
    for (const player of restart.snapshot.players) {
      assert.equal(player.ammoItemId, 2001);
      assert.deepEqual(player.ammoMagazine, {remaining: capacity, capacity});
      assert.equal(player.reload!.startedAt, 0);
    }
    evidence.rematch = restart;
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 3, move: 0, turn: 0, aim: 0,
      fire: true, useItem: 0, clientTime: Date.now()})).isSucc);
    await wait(() => latest().players.find(player => player.id === guest.res.playerId)?.ammoMagazine?.remaining === capacity - 1);
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 4, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    const shot = latest().players.find(player => player.id === guest.res.playerId)!;
    assert.equal(shot.reload!.duration, Math.fround(17 * Math.fround(.1)));
    assert.equal(shot.reload!.source, 'original-normal');
    evidence.round2Shot = frames[0].at(-1);
    const common = frames[0].filter(a => frames[1].some(b => b.snapshot.roomId === a.snapshot.roomId
      && b.snapshot.match?.round === a.snapshot.match?.round && b.snapshot.tick === a.snapshot.tick
      && b.snapshot.phase === a.snapshot.phase));
    assert(common.length > 100);
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.match?.round === a.snapshot.match?.round && b.snapshot.tick === a.snapshot.tick
        && b.snapshot.phase === a.snapshot.phase)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 2})).isSucc);
    evidence.status = 'PASS';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-ammo-player-lifecycle-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-ammo-player-lifecycle-${stamp}.log`, log);
  }
  console.log('PASS: fresh Accounts ordinary CPU natural death/respawn, computed magazine reset and unanimous Rematch round2 fire with dual synchronization');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
