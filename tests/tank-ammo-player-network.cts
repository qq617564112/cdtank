import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, MAPS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo-player-'));
  const port = 3264;
  const mode = Number(process.argv[2] ?? 4);
  assert(mode === 3 || mode === 4);
  const map = MAPS.find(map => map.mode === mode && map.mapId === 7)!;
  assert(map, 'Actual map7 must exist for the requested mode');
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'),
      MATCH_TIME_LIMIT_SECONDS: '65'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: mode === 3 ? 4 : 2}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000},
  }));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)?.snapshot;
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timed out; service output: ${log.slice(-1500)}`);
  }
  const expected = recomputeRoleAmmo({tank: TANKS.find(tank => tank.id === 1)!.recomputeBase,
    sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds, extraSkill: {baseId: 0, rank: 0}},
    skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode, mapId: 7, expected,
    scope: `Fresh Account APIs, actual room creation${mode === 4 ? '/CPU creation' : '/four human participants'} and ordinary PlayerInput; no account import or state injection. Ammo only; no complete pet/equipment/ownership claim.`};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    const accounts = [];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc);
      accounts.push({accountId: account.res.accountId});
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
      const profile = await client.callApi('RoleProfile', {}); assert(profile.isSucc);
      assert.equal(profile.res.profile, undefined);
    }
    evidence.accounts = accounts;
    const host = await clients[0].callApi('CreateRoom', {mode, mapId: 7, roomName: '弹匣实战',
      name: '普通玩家', tankId: 1, minPlayers: mode === 3 ? 4 : 2, maxPlayers: 4}); assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: '双端观察', tankId: 1}); assert(guest.isSucc);
    let cpuId: string | undefined;
    if (mode === 4) {
      const cpu = await clients[0].callApi('Cpu', {operation: 'ADD', round: 1, tankId: 1}); assert(cpu.isSucc);
      cpuId = cpu.res.playerId;
    } else {
      // Four actual accounts meet source mode3's minimum without autonomous combat.
      for (const client of clients.slice(2)) assert((await client.callApi('Join', {
        roomId: host.res.room.id, clientId: 'ignored', name: '普通队员', tankId: 1})).isSucc);
    }
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => latest()?.phase === 'PLAYING');
    const id = host.res.playerId;
    const player = () => latest()!.players.find(player => player.id === id)!;
    assert.equal(player().isVIP, mode === 3);
    assert.equal(player().petId, undefined);
    for (const participant of latest()!.players) {
      assert.deepEqual(participant.ammoMagazine, {remaining: expected.capacity, capacity: expected.capacity});
    }
    evidence.initial = latest();
    let sequence = 0;
    async function input(fire: boolean): Promise<void> {
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
        move: 0, turn: 0, aim: 0, fire, useItem: 0, clientTime: Date.now()})).isSucc);
    }
    const fires = () => events[0].filter(event => event.playerId === id && event.type === 'fire');
    await input(true);
    await wait(() => fires().length >= expected.capacity, 22000);
    await input(false);
    await wait(() => player().ammoMagazine?.remaining === 0);
    const lastShot = player().reload!;
    assert.equal(lastShot.source, 'original-normal');
    assert.equal(lastShot.duration, expected.lastBulletSeconds);
    evidence.empty = {wallTime: Date.now(), snapshot: latest()};
    await wait(() => player().ammoMagazine?.remaining === expected.capacity,
      Math.ceil(expected.lastBulletSeconds * 1000) + 3000);
    evidence.refilled = {wallTime: Date.now(), snapshot: latest()};
    assert.equal(fires().length, expected.capacity, 'Stopped input must not fire on refill');
    await input(true); await wait(() => fires().length === expected.capacity + 1);
    await input(false); await wait(() => player().ammoMagazine?.remaining === expected.capacity - 1);

    const changes = frames[0].filter(frame => frame.snapshot.phase === 'PLAYING')
      .map(frame => ({tick: frame.snapshot.tick, serverTime: frame.snapshot.serverTime,
        wallTime: frame.wallTime, player: frame.snapshot.players.find(player => player.id === id)!}))
      .filter((row, index, rows) => row.player.reload!.startedAt > 0
        && (index === 0 || row.player.reload!.startedAt !== rows[index - 1].player.reload!.startedAt));
    const firstMagazine = changes.slice(0, expected.capacity);
    assert.equal(firstMagazine.length, expected.capacity);
    assert(firstMagazine.slice(0, -1).every(row => row.player.reload!.duration === expected.normalSeconds));
    assert(firstMagazine.every(row => row.player.reload!.source === 'original-normal'));
    assert.deepEqual(firstMagazine.map(row => row.player.ammoMagazine!.remaining),
      Array.from({length: expected.capacity}, (_, index) => expected.capacity - index - 1));
    const intervals = firstMagazine.slice(1).map((row, index) => ({
      simulationSeconds: (row.tick - firstMagazine[index].tick) * .05,
      serverSeconds: (row.player.reload!.startedAt - firstMagazine[index].player.reload!.startedAt) / 1000,
      wallSeconds: (row.wallTime - firstMagazine[index].wallTime) / 1000,
    }));
    for (const interval of intervals) {
      assert(interval.serverSeconds >= expected.normalSeconds - .00001);
      assert(interval.serverSeconds <= expected.normalSeconds + .1);
    }
    const refill = evidence.refilled as {snapshot: MsgRoomSnapshot};
    assert(refill.snapshot.serverTime >= lastShot.startedAt + expected.lastBulletSeconds * 1000 - 1);
    const cpuFires = events[0].filter(event => event.playerId === cpuId && event.type === 'fire');
    if (cpuId) assert(cpuFires.length > 0, 'Real CPU must autonomously fire');
    const cpuFrames = frames[0].map(frame => frame.snapshot.players.find(player => player.id === cpuId)!)
      .filter(player => player?.reload?.startedAt);
    if (cpuId) assert(cpuFrames.some(player => player.ammoMagazine!.remaining < expected.capacity));
    assert(cpuFrames.every(player => player.reload!.source === 'original-normal'));
    evidence.measurements = {firstMagazine, intervals, cpuFireCount: cpuFires.length};
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING' && frames[1].some(b =>
      b.snapshot.roomId === a.snapshot.roomId && b.snapshot.tick === a.snapshot.tick
      && b.snapshot.phase === a.snapshot.phase));
    assert(common.length > 100);
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === a.snapshot.phase)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 1})).isSucc);
    evidence.status = 'PASS';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; evidence.frames = frames; evidence.events = events;
    writeFileSync(`recovery/output/tank-ammo-player-network-mode${mode}-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-ammo-player-network-mode${mode}-${stamp}.log`, log);
  }
  console.log(`PASS: fresh Account mode${mode}, tank1 ordinary magazine/reload/refill${mode === 4 ? ', real CPU fire' : ', VIP identity'} and dual snapshots`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
