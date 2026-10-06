import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

type TimedFrame = {wallTime: number; snapshot: MsgRoomSnapshot};

function verifyDeadlineFrames(frames: TimedFrame[], playerId: string, capacity: number): void {
  const playing = frames.filter(frame => frame.snapshot.phase === 'PLAYING');
  const shots = playing.map(frame => ({...frame,
    player: frame.snapshot.players.find(player => player.id === playerId)!}))
    .filter((frame, index, all) => frame.player.reload!.startedAt > 0
      && (index === 0 || frame.player.reload!.startedAt !== all[index - 1].player.reload!.startedAt));
  for (let index = 1; index < capacity; index++) {
    const previous = shots[index - 1], current = shots[index];
    const deadline = previous.player.reload!.startedAt + previous.player.reload!.duration * 1000;
    assert(current.player.reload!.startedAt >= deadline - 1);
    // Server deadlines use relative f32 seconds; absolute millisecond projection
    // can differ by less than1ms. No available tick may pass the ready deadline.
    const missed = playing.filter(frame => frame.snapshot.tick > previous.snapshot.tick
      && frame.snapshot.tick < current.snapshot.tick && frame.snapshot.serverTime > deadline + 1);
    assert.equal(missed.length, 0, `tank${current.player.tankId} missed an eligible fire tick`);
  }
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-three-ammo-')), port = 3293;
  const accepted = JSON.parse(readFileSync('recovery/output/tank-ammo-player-accepted.json', 'utf8'));
  assert.equal(accepted.ordinary.status, 'PASS');
  const models = [104, 154, 157].map(id => TANKS.find(tank => tank.id === id)!);
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'),
      MATCH_TIME_LIMIT_SECONDS: '75'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; service output: ${log.slice(-600)}`);
  }
  const rows: Record<string, unknown>[] = [];
  const evidence: Record<string, unknown> = {status: 'RUNNING', models: models.map(tank => tank.id),
    reusedTank1: accepted.ordinary.path, rows,
    scope: 'Only104/154/157 prior realtime/normalLeave gaps; one service sequential three rooms, six empty Accounts with no profile or owned import. Definition-only official account branch, not normal BUY or full loadout. Ordinary input, normal/final realtime bounds and normal Leave; old17/tank1/source evidence reused, not parallel-load performance.'};
  async function run(tank: (typeof TANKS)[number]): Promise<void> {
    const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
      logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
    const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = [[], []];
    const events: MsgRoomEvent[][] = [[], []];
    clients.forEach((client, index) => {
      client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
      client.listenMsg('RoomEvent', event => {events[index].push(event);});
    });
    const expected = recomputeRoleAmmo({tank: tank.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}}, skills: combatSkills, items: combatItemSkills,
      limits: combatLimits, roleValue9: 0})!;
    const row: Record<string, unknown> = {tankId: tank.id, status: 'RUNNING', expected,
      sourceTankDelay: tank.recomputeBase.reloadDuration, sourceTankBullet: tank.recomputeBase.field90,
      sources: {ownedTank: false, ownedPet: false, boundGear: false, parts: [],
        skills: expected.selectedSkillIds, ownedField34: 'absent; not treated as zero'}};
    rows.push(row);
    const latest = () => frames[0].at(-1)!.snapshot;
    try {
      for (const client of clients) {
        assert((await client.connect()).isSucc);
        assert((await client.callApi('Account', {})).isSucc);
        const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
        assert.deepEqual(owned.res, {base: [], equipment: []});
        const profile = await client.callApi('RoleProfile', {}); assert(profile.isSucc);
        assert.equal(profile.res.profile, undefined);
      }
      const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
        roomName: `弹量${tank.id}`, name: '普通玩家', tankId: tank.id,
        minPlayers: 2, maxPlayers: 2}); row.roomCreation = host; assert(host.isSucc, JSON.stringify(host));
      const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
        clientId: 'ignored', name: '双端观察', tankId: 1}); assert(guest.isSucc);
      for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
      await wait(() => frames[0].some(frame => frame.snapshot.phase === 'PLAYING'));
      const id = host.res.playerId;
      const player = () => latest().players.find(player => player.id === id)!;
      assert.equal(player().tankId, tank.id);
      assert.equal(player().petId, undefined);
      assert.deepEqual(player().ammoMagazine, {capacity: expected.capacity, remaining: expected.capacity});
      row.initial = latest();
      let sequence = 0;
      const fireCount = () => events[0].filter(event => event.type === 'fire' && event.playerId === id).length;
      async function input(fire: boolean): Promise<void> {
        assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
          move: 0, turn: 0, aim: 0, fire, useItem: 0, clientTime: Date.now()})).isSucc);
      }
      await input(true);
      await wait(() => fireCount() >= expected.capacity,
        Math.ceil(expected.normalSeconds * expected.capacity * 1000) + 8000);
      await input(false);
      await wait(() => player().ammoMagazine?.remaining === 0);
      row.empty = {wallTime: Date.now(), snapshot: latest()};
      assert.equal(player().reload!.duration, expected.lastBulletSeconds);
      await wait(() => player().ammoMagazine?.remaining === expected.capacity,
        Math.ceil(expected.lastBulletSeconds * 1000) + 5000);
      row.refilled = {wallTime: Date.now(), snapshot: latest()};
      assert.equal(fireCount(), expected.capacity);
      await input(true); await wait(() => fireCount() === expected.capacity + 1);
      await input(false); await wait(() => player().ammoMagazine?.remaining === expected.capacity - 1);
      const changes = frames[0].filter(frame => frame.snapshot.phase === 'PLAYING')
        .map(frame => ({tick: frame.snapshot.tick, serverTime: frame.snapshot.serverTime,
          wallTime: frame.wallTime, player: frame.snapshot.players.find(player => player.id === id)!}))
        .filter((frame, index, all) => frame.player.reload!.startedAt > 0
          && (index === 0 || frame.player.reload!.startedAt !== all[index - 1].player.reload!.startedAt));
      const firstMagazine = changes.slice(0, expected.capacity);
      assert.equal(firstMagazine.length, expected.capacity);
      assert(firstMagazine.every(frame => frame.player.reload!.source === 'original-normal'));
      assert(firstMagazine.slice(0, -1).every(frame => frame.player.reload!.duration === expected.normalSeconds));
      assert.deepEqual(firstMagazine.map(frame => frame.player.ammoMagazine!.remaining),
        Array.from({length: expected.capacity}, (_, index) => expected.capacity - index - 1));
      const intervals = changes.slice(1, expected.capacity).map((frame, index) => ({
        simulationSeconds: (frame.tick - changes[index].tick) * .05,
        serverSeconds: (frame.player.reload!.startedAt - changes[index].player.reload!.startedAt) / 1000,
        wallSeconds: (frame.wallTime - changes[index].wallTime) / 1000,
      }));
      for (const interval of intervals) {
        assert(interval.serverSeconds >= expected.normalSeconds - .00001);
        assert(interval.serverSeconds <= expected.normalSeconds + .15);
        assert(interval.wallSeconds <= expected.normalSeconds + .15);
      }
      verifyDeadlineFrames(frames[0], id, expected.capacity);
      const empty = row.empty as {wallTime: number; snapshot: MsgRoomSnapshot};
      const refill = row.refilled as {wallTime: number; snapshot: MsgRoomSnapshot};
      assert(refill.snapshot.serverTime >= firstMagazine.at(-1)!.player.reload!.startedAt
        + expected.lastBulletSeconds * 1000 - 1);
      const lastShot = firstMagazine.at(-1)!;
      const refillServerSeconds = (refill.snapshot.serverTime - lastShot.player.reload!.startedAt) / 1000;
      const lastShotFrame = frames[0].find(frame => frame.snapshot.tick === lastShot.tick)!;
      const refillWallSeconds = (refill.wallTime - lastShotFrame.wallTime) / 1000;
      assert(refillServerSeconds <= expected.lastBulletSeconds + .15);
      assert(refillWallSeconds <= expected.lastBulletSeconds + .15);
      const serverPauses = frames[0].slice(1).flatMap((frame, index) => {
        const before = frames[0][index];
        if (frame.snapshot.phase !== 'PLAYING' || before.snapshot.phase !== 'PLAYING') return [];
        const milliseconds = frame.snapshot.serverTime - before.snapshot.serverTime;
        return milliseconds > 100 ? [{tick: frame.snapshot.tick, serverMilliseconds: milliseconds,
          wallMilliseconds: frame.wallTime - before.wallTime}] : [];
      });
      row.realtime = {refillServerSeconds, refillWallSeconds, serverPauses, upperSlackSeconds: .15};
      row.measured = {firstMagazine, intervals, refill: {
        simulationSeconds: (refill.snapshot.tick - empty.snapshot.tick) * .05,
        serverSeconds: (refill.snapshot.serverTime - empty.snapshot.serverTime) / 1000,
        wallSeconds: (refill.wallTime - empty.wallTime) / 1000}};
      const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING' && frames[1].some(b =>
        b.snapshot.roomId === a.snapshot.roomId && b.snapshot.phase === a.snapshot.phase
        && b.snapshot.tick === a.snapshot.tick));
      assert(common.length > 100);
      for (const a of common) {
        const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
          && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick)!;
        assert.deepEqual(a.snapshot.players, b.snapshot.players);
      }
      row.commonTicks = common.length;
      const leaves = [];
      for (const client of clients) {
        const started = Date.now();
        const response = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
        leaves.push({response, wallMilliseconds: Date.now() - started}); assert(response.isSucc);
      }
      row.normalLeaves = leaves;
      row.status = 'PASS';
    } catch (error) {
      row.status = 'FAIL'; row.error = String(error); throw error;
    } finally {
      for (const client of clients) await client.disconnect();
      row.frames = frames; row.events = events;
    }
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const tank of models) await run(tank);
    evidence.status = 'PASS_AMMO_SCOPE_ONLY';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    rows.sort((a, b) => Number(a.tankId) - Number(b.tankId));
    writeFileSync(`recovery/output/tank-three-models-ammo-realtime-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-three-models-ammo-realtime-network-${stamp}.log`, log);
  }
  console.log('PASS: three prior realtime/normalLeave gaps, sequential normal rooms; old17/tank1 reused');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
