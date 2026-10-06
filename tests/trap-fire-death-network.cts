import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/trap-fire-death-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-fire-network-2026-10-05T03-41-09-883Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-injection-jam-'));
  const database = join(directory, 'accounts.sqlite'), port = 3321;
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], []], events: MsgRoomEvent[][] = [[], []];
  const times: {tick: number; serverTime: number; wallTime: number}[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index].push(snapshot);
      times[index].push({tick: snapshot.tick, serverTime: snapshot.serverTime, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => events[index].push(event));
  });
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    fixture: 'Native SQLite checkpoint of two ordinary BUY3/pet2 Accounts, owner has one previously purchased3005/slot1. No new inventory acquisition; actual remaining3005 is consumed; no ownership/live state imports.',
    checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'FUNC05/12 purchased3005 active restraint natural death reset and real respawn/fire; pre-injury by ordinary shots, no active state injection, one room and Leave.'};
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Condition deadline; server tail: ' + log.slice(-500));
  }
  const sequence = [0, 0];
  const inputs: unknown[] = [];
  async function input(index: number, move = 0, turn = 0, useItem = 0, fire = false): Promise<void> {
    const value = {sequence: ++sequence[index], move, turn, aim: 0, fire, useItem, clientTime: Date.now()};
    inputs.push({index, ...value}); assert((await clients[index].sendMsg('PlayerInput', value)).isSucc);
  }
  const latest = () => snapshots[0].at(-1)!;
  const player = (id: string) => latest().players.find(row => row.id === id)!;
  try {
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '60'},
      stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const ownerStock = await clients[0].callApi('Inventory', {}); assert(ownerStock.isSucc);
    const trap = ownerStock.res.records.find(row => row.itemTableId === 3005)!;
    assert.equal(trap.ownedQuantity, 1);
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '陷阱死亡', name: 'Owner', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(frames => frames.at(-1)?.phase === 'PLAYING'
      && [ownerId, targetId].every(id => frames.at(-1)!.players.some(row => row.id === id))));
    assert.equal(player(targetId).hp, 700);
    let shooterAligned = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const owner = player(ownerId), target = player(targetId);
      const desired = Math.atan2(target.x - owner.x, target.z - owner.z);
      const delta = Math.atan2(Math.sin(desired - owner.yaw), Math.cos(desired - owner.yaw));
      if (Math.abs(delta) < .01) {shooterAligned = true; break;}
      await input(0, 0, Math.sign(delta)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(shooterAligned); await input(0);
    const initialHp = player(targetId).hp;
    await input(0, 0, 0, 0, true);
    await wait(() => player(targetId).hp < initialHp);
    const observedFirstHitDamage = initialHp - player(targetId).hp;
    assert(observedFirstHitDamage > 0 && player(targetId).alive);
    await wait(() => player(targetId).hp > 0 && player(targetId).hp <= observedFirstHitDamage, 45000);
    await input(0);
    evidence.preInjury = {player: {...player(targetId)}, tick: latest().tick, serverTime: latest().serverTime,
      wallTime: Date.now(), observedFirstHitDamage,
      source: 'Normal original2001 inputs and existing rebuilt damage authority; no damage-formula accuracy claim'};
    await input(0, 0, 0, 2);
    await wait(() => events[0].some(event => event.type === 'trapPlaced'));
    const placed = events[0].find(event => event.type === 'trapPlaced')!;
    await input(0, -1); const movingTick = latest().tick;
    await wait(() => latest().tick >= movingTick + 20); await input(0);
    assert(Math.hypot(player(ownerId).x - placed.x, player(ownerId).z - placed.z) > 100);
    let aligned = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const target = player(targetId), desired = Math.atan2(placed.x - target.x, placed.z - target.z);
      const delta = Math.atan2(Math.sin(desired - target.yaw), Math.cos(desired - target.yaw));
      if (Math.abs(delta) < .02) {aligned = true; break;}
      await input(1, 0, Math.sign(delta)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aligned); await input(1, 1);
    await wait(() => snapshots.every(frames => frames.at(-1)?.players.find(p => p.id === targetId)?.trapFireRestraint?.firePermissionCount === 0));
    await input(1);
    const restrained = {...player(targetId)}, beforeUse = latest();
    assert(restrained.trapFireRestraint); assert(beforeUse.serverTime < restrained.trapFireRestraint.expiresAt);
    evidence.restrained = {player: restrained, tick: beforeUse.tick, serverTime: beforeUse.serverTime, wallTime: Date.now()};
    assert(player(targetId).alive);
    await input(0, 0, 0, 0, true);
    await wait(() => snapshots.every(rows => rows.at(-1)?.players.find(p => p.id === targetId)?.alive === false));
    await input(0);
    const deadFrame = latest(), dead = {...player(targetId)};
    assert(deadFrame.serverTime < restrained.trapFireRestraint.expiresAt, 'Natural death must occur within active4003');
    assert.equal(dead.hp, 0); assert.equal(dead.trapFireRestraint, undefined);
    evidence.naturalDeath = {player: dead, tick: deadFrame.tick, serverTime: deadFrame.serverTime,
      wallTime: Date.now(), originalExpiresAt: restrained.trapFireRestraint.expiresAt};
    await wait(() => snapshots.every(rows => rows.at(-1)?.players.find(p => p.id === targetId)?.alive === true));
    const respawned = {...player(targetId)}, respawnFrame = latest();
    assert.equal(respawned.trapFireRestraint, undefined);
    assert.equal(respawned.hp, respawned.maxHp); assert.equal(respawned.maxHp, 700);
    assert(respawned.ammoMagazine && respawned.ammoMagazine.remaining === respawned.ammoMagazine.capacity);
    evidence.respawned = {player: respawned, tick: respawnFrame.tick, serverTime: respawnFrame.serverTime, wallTime: Date.now()};
    const targetFireCount = events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length;
    await input(1, 0, 0, 0, true);
    await wait(() => events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length === targetFireCount + 1);
    await input(1);
    await wait(() => player(targetId).ammoMagazine?.remaining === respawned.ammoMagazine!.capacity - 1);
    evidence.resumedFire = {player: {...player(targetId)}, tick: latest().tick, serverTime: latest().serverTime, wallTime: Date.now()};
    await wait(() => latest().serverTime >= restrained.trapFireRestraint!.expiresAt + 100);
    assert.equal(player(targetId).trapFireRestraint, undefined);
    assert.equal(events[0].filter(e => e.type === 'trapRestraintEnded' && e.playerId === targetId).length, 0);
    evidence.afterOldDeadline = {player: {...player(targetId)}, tick: latest().tick, serverTime: latest().serverTime,
      oldExpiresAt: restrained.trapFireRestraint.expiresAt, restraintEndEvents: 0};
    const other = new Map(snapshots[1].map(frame => [frame.tick, frame]));
    const common = snapshots[0].filter(frame => other.has(frame.tick));
    for (const frame of common) assert.deepEqual(frame.players, other.get(frame.tick)!.players);
    const dualEvents = ['trapTriggered', 'destroy', 'respawn'];
    for (const type of dualEvents) {
      const event = events[0].find(e => e.type === type && (e.playerId === targetId || e.targetId === targetId))!;
      assert(event); assert(events[1].some(row => JSON.stringify(row) === JSON.stringify(event)));
    }
    evidence.sharedTicks = common.map(frame => frame.tick);
    evidence.leave = [];
    for (const client of clients) {const result = await client.callApi('Leave', {roomId, round: 1});
      (evidence.leave as unknown[]).push(result); assert(result.isSucc);}
    evidence.status = 'PASS_LIMITED_ACTIVE4003_NATURAL_DEATH_RESPAWN_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    evidence.snapshots = snapshots; evidence.snapshotTimes = times; evidence.events = events; evidence.inputs = inputs;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {const done = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await done;}
    rmSync(directory, {recursive: true, force: true});
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
