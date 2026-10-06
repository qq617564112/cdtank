import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {readTrapFireRestraintRule} from '../apps/server/src/battle/items/trap-fire-restraint';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/tank-purchased-trap-fire-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-trap-fire-'));
  const database = join(directory, 'accounts.sqlite'), port = 3309;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], []], events: MsgRoomEvent[][] = [[], []];
  const snapshotTimes: {tick: number; serverTime: number; wallTime: number}[][] = [[], []];
  const eventTimes: {eventIndex: number; wallTime: number; precedingTick?: number;
    precedingServerTime?: number}[][] = [[], []];
  const inputs: {index: number; sequence: number; move: number; turn: number; aim: number;
    fire: boolean; useItem: number}[] = [];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index].push(snapshot);
      snapshotTimes[index].push({tick: snapshot.tick, serverTime: snapshot.serverTime, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {
      const preceding = snapshots[index].at(-1);
      eventTimes[index].push({eventIndex: events[index].length, wallTime: Date.now(),
        precedingTick: preceding?.tick, precedingServerTime: preceding?.serverTime});
      events[index].push(event);
    });
  });
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), log.slice(-700));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '60'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server && server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    scope: 'First3005 genuine BUY/placement/contact; source fire permission blocks accepted shots and ammo consumption; straight/body/turret movement remain; server5s expiry restores fire, dual snapshots/finite stock/Leave. Func12/5 producer policy rebuilt.',
    fixture: 'Legitimate native checkpoint of two ordinary trueBUY3/pet2 Accounts reused. New actualBUY3005 only; no ownership/stock or activeHP/pose/flags/events import.'};
  const origin = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  copyFileSync(origin + '-checkpoint.sqlite', database);
  const accounts: {accountId: string; token: string}[] = JSON.parse(readFileSync(origin + '-identity.private.json', 'utf8')).accounts;
  try {
    await start();
    for (const [index, client] of clients.entries()) {
      assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const actualOwned = await clients[1].callApi('OwnedRoles', {}); assert(actualOwned.isSucc);
    const ownedTank = actualOwned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!;
    const ownedPet = actualOwned.res.base.find(row => new Map(row.fields).get(8) === 2)!;
    evidence.owned = actualOwned.res;
    const equipment = {name: ownedTank.name, fields: new Map(ownedTank.fields)};
    const baseFields = new Map(ownedPet.fields);
    const actualTank = TANKS.find(row => row.id === equipment.fields.get(0x24))!;
    const actualPet = PET_BASES.find(row => row.id === baseFields.get(8))!;
    const oracleRole = createRoleCombatState();
    for (const id of combatItemSkills.get(2001)!.skillIds) if (id) oracleRole.addSkill(id);
    const originalMovement = () => {
      const value = recomputeQualifiedRoleMovement({tank: actualTank.recomputeBase, pet: actualPet,
        ownedField34: equipment.fields.get(0x34), tankType: actualTank.recomputeBase.tankType,
        sources: readRoleSkillSources({currentSkillIds: [...oracleRole.record!.arrays.get(4)!],
          boundGear: undefined, equipment, roleFields: oracleRole.record!.numericFields!}),
        skills: combatSkills, items: combatItemSkills, limits: combatLimits,
        roleValue9: oracleRole.recomputeCounter, movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
      assert(value); return value;
    };
    const expectedBaseline = originalMovement();
    evidence.expected = {tankId: actualTank.id, petId: actualPet.id,
      ownedField34: equipment.fields.get(0x34), baseline: expectedBaseline,
      source: 'Actual purchased fields, readRoleSkillSources, original qualified movement module; no boundGear inferred',
      acquisitionPolicy: 'Paid availability/owned initial fields including+34=0 are reconstructed'};

    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 3005,
      quantity: 2, currency: 'MONEY', requestId: 'trap_fire_purchase'});
    evidence.purchaseReceipt = bought; assert(bought.isSucc);
    const trapInstance = bought.res.purchased!.instanceId;
    assert.equal(bought.res.purchased!.ownedQuantity, 2);
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId: trapInstance})).isSucc);
    evidence.purchase = bought.res;
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '软木塞禁射', name: 'Medic', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id, clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(frames => {
      const frame = frames.at(-1);
      return frame?.phase === 'PLAYING' && [ownerId, targetId].every(id =>
        frame.players.some(player => player.id === id));
    }));
    const sequences = [0, 0];
    const sendInput = async (index: number, move = 0, turn = 0, aim = 0, fire = false, useItem = 0) => {
      const command = {index, sequence: ++sequences[index], move, turn, aim, fire, useItem}; inputs.push(command);
      assert((await clients[index].sendMsg('PlayerInput', {sequence: command.sequence, move, turn, aim, fire, useItem, clientTime: Date.now()})).isSucc);
    };
    const player = (id: string) => snapshots[0].at(-1)!.players.find(p => p.id === id)!;
    const latest = () => snapshots[0].at(-1)!;
    const initial = {...player(ownerId)};
    await sendInput(0, 0, 0, 0, false, 2);
    await wait(() => events[0].some(event => event.type === 'trapPlaced' && event.playerId === ownerId));
    const placed = events[0].find(event => event.type === 'trapPlaced' && event.playerId === ownerId)!;
    assert.equal(placed.skillId, 3005);
    assert(Math.hypot(placed.x - initial.x, placed.z - initial.z) < .02);
    evidence.placed = placed;
    const rule = readTrapFireRestraintRule(); assert(rule);
    await wait(() => snapshots.every(frames => frames.at(-1)?.match?.groundTraps?.some(trap =>
      trap.id === placed.targetId)));
    const ground = latest().match!.groundTraps!.find(trap => trap.id === placed.targetId)!;
    assert.equal(ground.ownerId, ownerId); assert.equal(ground.itemTableId, rule.itemTableId);
    assert.equal(ground.modelId, rule.groundModelId);
    assert.equal(ground.x, placed.x); assert.equal(ground.z, placed.z);
    evidence.ground = ground;
    const stock = await clients[0].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === trapInstance)!.ownedQuantity, 1);
    evidence.afterPlacementStock = stock.res;
    await sendInput(0, 1);
    const startTick = latest().tick;
    await wait(() => latest().tick >= startTick + 20);
    await sendInput(0);
    assert(Math.hypot(player(ownerId).x - placed.x, player(ownerId).z - placed.z) > 100);
    let aligned = false;
    for (let tick = 0; tick < 100; tick++) {
      const target = player(targetId);
      const desired = Math.atan2(placed.x - target.x, placed.z - target.z);
      const delta = Math.atan2(Math.sin(desired - target.yaw), Math.cos(desired - target.yaw));
      if (Math.abs(delta) < .02) {aligned = true; break;}
      await sendInput(1, 0, Math.sign(delta));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aligned); await sendInput(1, 1);
    await wait(() => events[0].some(event => event.type === 'trapTriggered' && event.targetId === targetId));
    await sendInput(1);
    const triggered = events[0].find(event => event.type === 'trapTriggered' && event.targetId === targetId)!;
    evidence.triggered = triggered;
    assert.equal(triggered.skillId, rule.effectSkillId); assert.equal(triggered.value, 0);
    await wait(() => snapshots.every(frames => frames.at(-1)?.players.find(p =>
      p.id === targetId)?.trapFireRestraint !== undefined));
    const restraint = player(targetId).trapFireRestraint!;
    assert.equal(restraint.skillId, rule.effectSkillId); assert.equal(restraint.firePermissionCount, 0);
    assert(!latest().match!.groundTraps!.some(trap => trap.id === ground.id));
    const appliedAt = restraint.expiresAt - rule.restraintDurationMs;
    evidence.restraint = {state: restraint, appliedAt, durationMs: rule.restraintDurationMs,
      source: 'Rebuilt authoritative server-ms expiry from source Func5.T; original time unit not confirmed'};
    const hp = player(targetId).hp;
    const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    const sample = async (name: string, move: number, turn: number, aim: number, fire = false) => {
      await sendInput(1, move, turn, aim, fire);
      const start = latest().tick;
      await wait(() => latest().tick >= start + 7);
      await sendInput(1);
      const frames = snapshots[0].filter(frame => frame.phase === 'PLAYING' && frame.tick >= start + 1 && frame.tick <= start + 6);
      assert.equal(frames.length, 6);
      const first = frames[0], last = frames.at(-1)!;
      const before = first.players.find(row => row.id === targetId)!, after = last.players.find(row => row.id === targetId)!;
      const simulatedSeconds = (last.tick - first.tick) * .05;
      const distance = Math.hypot(after.x - before.x, after.z - before.z);
      const bodyRadians = angleDifference(after.bodyYaw ?? after.yaw, before.bodyYaw ?? before.yaw);
      const turretRadians = angleDifference(after.yaw + after.aim, before.yaw + before.aim);
      const firstWall = snapshotTimes[0].find(row => row.tick === first.tick)!;
      const lastWall = snapshotTimes[0].find(row => row.tick === last.tick)!;
      return {name, input: {move, turn, aim, fire}, ticks: frames.map(frame => frame.tick), distance,
        bodyRadians, turretRadians, simulatedSeconds, serverSeconds: (last.serverTime - first.serverTime) / 1000,
        wallSeconds: (lastWall.wallTime - firstWall.wallTime) / 1000, speed: distance / simulatedSeconds};
    };
    const forward = await sample('restrainedForward', 1, 0, 0);
    const reverse = await sample('restrainedReverse', -1, 0, 0);
    const body = await sample('restrainedBody', 0, 1, 0);
    const beforeFireCount = events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length;
    const beforeMagazine = {...player(targetId).ammoMagazine!};
    assert(beforeMagazine.capacity > 0);
    const turret = await sample('restrainedTurretAndFire', 0, 0, 1, true);
    for (const result of [forward, reverse]) assert(Math.abs(result.speed - expectedBaseline.speed) < .1);
    assert(Math.abs(body.bodyRadians - expectedBaseline.turn * body.simulatedSeconds) < .001);
    assert(Math.abs(turret.turretRadians - expectedBaseline.turn * turret.simulatedSeconds) < .001);
    assert.equal(events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length, beforeFireCount);
    assert.deepEqual(player(targetId).ammoMagazine, beforeMagazine);
    evidence.controls = {forward, reverse, body, turret, beforeMagazine, afterMagazine: player(targetId).ammoMagazine};
    assert.equal(player(targetId).hp, hp, 'Trap permission must not heal or damage');
    await wait(() => events[0].some(event => event.type === 'trapRestraintEnded' && event.playerId === targetId));
    evidence.expiry = events[0].find(event => event.type === 'trapRestraintEnded' && event.playerId === targetId)!;
    assert.equal((evidence.expiry as MsgRoomEvent).value, 1);
    await wait(() => player(targetId).trapFireRestraint === undefined);
    const activeFrames = snapshots[0].filter(frame => frame.players.find(p => p.id === targetId)?.trapFireRestraint);
    assert(activeFrames.length > 1);
    for (const frame of activeFrames) {
      const state = frame.players.find(p => p.id === targetId)!.trapFireRestraint!;
      assert.equal(state.expiresAt, restraint.expiresAt); assert.equal(state.firePermissionCount, 0);
      assert(frame.serverTime >= appliedAt && frame.serverTime < restraint.expiresAt);
    }
    const firstExpired = snapshots[0].find(frame => frame.phase === 'PLAYING'
      && frame.serverTime >= restraint.expiresAt)!;
    assert(firstExpired); assert.equal(firstExpired.players.find(p => p.id === targetId)!.trapFireRestraint, undefined);
    evidence.deadline = {appliedAt, expiresAt: restraint.expiresAt, activeTicks: activeFrames.map(frame => frame.tick),
      lastActive: {tick: activeFrames.at(-1)!.tick, serverTime: activeFrames.at(-1)!.serverTime},
      firstExpired: {tick: firstExpired.tick, serverTime: firstExpired.serverTime},
      serverOvershootMs: firstExpired.serverTime - restraint.expiresAt,
      simulatedSeconds: (firstExpired.tick - activeFrames[0].tick) * .05};
    const triggerIndex = events[0].indexOf(triggered);
    const expiryIndex = events[0].indexOf(evidence.expiry as MsgRoomEvent);
    evidence.deadlineObservation = {trigger: eventTimes[0][triggerIndex],
      expiry: eventTimes[0][expiryIndex],
      source: 'Event receipt wall time and preceding snapshot serverTime/tick; exact deadline separately checked from authoritative restraint projection.'};
    const restored = await sample('restoredFire', 0, 0, 0, true);
    assert(events[0].some(e => e.type === 'fire' && e.playerId === targetId && e.skillId === 2001));
    assert.equal(player(targetId).ammoMagazine!.remaining, beforeMagazine.remaining - 1);
    evidence.restored = {measurement: restored, magazine: player(targetId).ammoMagazine};
    await wait(() => events[0].length === events[1].length);
    assert.deepEqual(events[0], events[1]);
    evidence.commonEvents = events[0].length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId, round: 1})).isSucc);
    const common = snapshots[0].filter(frame => frame.phase === 'PLAYING'
      && snapshots[1].some(other => other.roomId === frame.roomId && other.tick === frame.tick));
    assert(common.length > 10);
    for (const frame of common) {
      const other = snapshots[1].find(other => other.roomId === frame.roomId && other.tick === frame.tick)!;
      assert.deepEqual(frame.players, other.players);
      assert.deepEqual(frame.match?.groundTraps, other.match?.groundTraps);
    }
    evidence.commonTicks = common.length;
    evidence.normalLeaves = 2;
    const persisted = new AccountStore(database);
    try {
      const inventory = persisted.inventory(accounts[0].accountId);
      assert.equal(inventory.records.find(row => row.instanceId === trapInstance)!.ownedQuantity, 1);
      assert.equal(inventory.hotkeys[0], trapInstance);
      evidence.persistedInventory = inventory;
    } finally {persisted.close();}
    evidence.status = 'PASS_PURCHASED_CORK_FIRE_SCOPE'; console.log(`PASS ${output}.json`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {await stop(); evidence.snapshots = snapshots; evidence.events = events;
    if (accounts.length === 2) {
      const backup = new DatabaseSync(database);
      try {backup.exec(`VACUUM INTO '${output}-checkpoint.sqlite'`);} finally {backup.close();}
      chmodSync(`${output}-checkpoint.sqlite`, 0o600);
      writeFileSync(`${output}-identity.private.json`, JSON.stringify({accounts}, null, 2), {mode: 0o600});
      evidence.checkpoint = {database: `${output}-checkpoint.sqlite`,
        identityFile: `${output}-identity.private.json`, source: 'Native SQLite backup after server stop; actual BUY records retained, no owned/inventory export import'};
    }
    evidence.inputs = inputs; evidence.eventTimes = eventTimes;
    evidence.snapshotTimes = snapshotTimes; evidence.simulatedTickSeconds = .05; evidence.cleaned = true;
    writeFileSync(`${output}.json`, JSON.stringify(evidence, null, 2)); writeFileSync(`${output}.log`, log);
    rmSync(directory, {recursive: true, force: true});}
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
