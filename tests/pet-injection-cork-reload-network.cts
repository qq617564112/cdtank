import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/pet-injection-cork-reload-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-fire-network-2026-10-05T03-41-09-883Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-injection-jam-'));
  const database = join(directory, 'accounts.sqlite'), port = 3320;
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
    fixture: 'Native SQLite checkpoint of two ordinary BUY3/pet2 Accounts, owner has one previously purchased3005/slot1. New target formal BUY injection3x2/slot4; no ownership/live state imports.',
    checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'M2-02/FUNC10 actual ordinary last-round reload survives purchased3005 early cure; held fire remains blocked until original deadline, then first eligible refill/fire. Other trap control/FX/persistence scopes reused.'};
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
    const owned = await clients[1].callApi('OwnedRoles', {}); assert(owned.isSucc);
    const tankFields = new Map(owned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields);
    const oracle = recomputeRoleAmmo({tank: TANKS.find(row => row.id === 3)!.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds, extraSkill: {baseId: 0, rank: 0},
        itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
    evidence.source = {tankFields: [...tankFields], oracle, boundGear: 'not established'};
    const ownerStock = await clients[0].callApi('Inventory', {}); assert(ownerStock.isSucc);
    const trap = ownerStock.res.records.find(row => row.itemTableId === 3005)!;
    assert.equal(trap.ownedQuantity, 1);
    const bought = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 3,
      quantity: 2, currency: 'MONEY', requestId: 'cork_reload_injection_first'}); assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    assert.equal(bought.res.purchased!.ownedQuantity, 2);
    const assignment = await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId});
    evidence.assignment = assignment; assert(assignment.isSucc);
    evidence.purchase = bought.res;
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '装填解禁', name: 'Owner', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(frames => frames.at(-1)?.phase === 'PLAYING'
      && [ownerId, targetId].every(id => frames.at(-1)!.players.some(row => row.id === id))));
    assert.equal(player(targetId).hp, 700);
    await input(0, 0, 0, 2);
    await wait(() => events[0].some(event => event.type === 'trapPlaced'));
    const placed = events[0].find(event => event.type === 'trapPlaced')!;
    await input(0, 1); const movingTick = latest().tick;
    await wait(() => latest().tick >= movingTick + 20); await input(0);
    assert(Math.hypot(player(ownerId).x - placed.x, player(ownerId).z - placed.z) > 100);
    let aligned = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const target = player(targetId), desired = Math.atan2(placed.x - target.x, placed.z - target.z);
      const delta = Math.atan2(Math.sin(desired - target.yaw), Math.cos(desired - target.yaw));
      if (Math.abs(delta) < .02) {aligned = true; break;}
      await input(1, 0, Math.sign(delta)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aligned); await input(1);
    await input(1, 0, 0, 0, true);
    await wait(() => events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length === oracle.capacity);
    await input(1);
    await wait(() => player(targetId).ammoMagazine?.remaining === 0);
    const last = {...player(targetId)}, lastFrame = latest();
    assert.equal(last.reload!.duration, oracle.lastBulletSeconds);
    const reloadStartedAt = last.reload!.startedAt;
    const reloadDeadline = reloadStartedAt + oracle.lastBulletSeconds * 1000;
    evidence.lastShot = {player: last, tick: lastFrame.tick, serverTime: lastFrame.serverTime, wallTime: Date.now(), reloadDeadline};
    await input(1, 1);
    await wait(() => snapshots.every(frames => frames.at(-1)?.players.find(p => p.id === targetId)?.trapFireRestraint?.firePermissionCount === 0));
    await input(1);
    const restrained = {...player(targetId)}, beforeUse = latest();
    assert(restrained.trapFireRestraint); assert(beforeUse.serverTime < restrained.trapFireRestraint.expiresAt);
    evidence.restrained = {player: restrained, tick: beforeUse.tick, serverTime: beforeUse.serverTime, wallTime: Date.now()};
    await input(1, 0, 0, 5);
    await wait(() => events.every(rows => rows.some(e => e.type === 'itemUsed' && e.playerId === targetId && e.skillId === 3))
      && snapshots.every(frames => !frames.at(-1)?.players.find(p => p.id === targetId)?.trapFireRestraint));
    const cleared = {...player(targetId)}, afterUse = latest();
    const ended = events[0].find(e => e.type === 'trapRestraintEnded' && e.playerId === targetId)!;
    assert(ended); assert.equal(ended.value, 1); assert(afterUse.serverTime < restrained.trapFireRestraint.expiresAt);
    assert(afterUse.serverTime < reloadDeadline, 'Contact and cure must occur while the real last reload remains active');
    assert.equal(cleared.reload!.startedAt, reloadStartedAt);
    assert.equal(cleared.reload!.duration, oracle.lastBulletSeconds);
    assert(cleared.reload!.remaining > 0); assert.equal(cleared.ammoMagazine!.remaining, 0);
    assert.equal(cleared.hp, restrained.hp); assert.equal(cleared.maxHp, restrained.maxHp);
    evidence.cleared = {player: cleared, tick: afterUse.tick, serverTime: afterUse.serverTime, wallTime: Date.now(), ended};
    const usedStock = await clients[1].callApi('Inventory', {}); assert(usedStock.isSucc);
    assert.equal(usedStock.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 1);
    evidence.usedStock = usedStock.res;
    const usedCount = events[0].filter(e => e.type === 'itemUsed' && e.playerId === targetId).length;
    await input(1); await input(1, 0, 0, 5);
    await wait(() => events[0].some(e => e.type === 'itemRejected' && e.playerId === targetId));
    const repeatStock = await clients[1].callApi('Inventory', {}); assert(repeatStock.isSucc);
    assert.equal(repeatStock.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 1);
    assert.equal(events[0].filter(e => e.type === 'itemUsed' && e.playerId === targetId).length, usedCount);
    evidence.repeatStock = repeatStock.res;
    await input(1); const from = {...player(targetId)}, fireTick = latest().tick;
    const fromTime = latest().serverTime, fromWall = Date.now();
    const fireCount = events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length;
    await input(1, 0, 0, 0, true);
    await wait(() => events[0].filter(e => e.type === 'fire' && e.playerId === targetId).length === fireCount + 1);
    await input(1); await wait(() => player(targetId).ammoMagazine?.remaining === oracle.capacity - 1);
    const to = {...player(targetId)}, nextFrame = latest();
    assert(to.reload!.startedAt >= reloadDeadline);
    const blocked = snapshots[0].filter(frame => frame.tick >= fireTick && frame.serverTime < reloadDeadline);
    assert(blocked.length > 1);
    for (const frame of blocked) {
      const p = frame.players.find(p => p.id === targetId)!;
      assert.equal(p.reload!.startedAt, reloadStartedAt);
      assert.equal(p.ammoMagazine!.remaining, 0);
      assert.equal(p.trapFireRestraint, undefined);
    }
    const firstEligible = snapshots[0].find(frame => frame.tick >= fireTick && frame.serverTime >= reloadDeadline)!;
    assert.equal(firstEligible.players.find(p => p.id === targetId)!.reload!.startedAt, to.reload!.startedAt);
    evidence.restoredFire = {from, to, blockedTicks: blocked.map(frame => frame.tick),
      firstEligible: {tick: firstEligible.tick, serverTime: firstEligible.serverTime}, reloadDeadline,
      simulationSeconds: (nextFrame.tick - fireTick) * .05, serverSeconds: (nextFrame.serverTime - fromTime) / 1000,
      wallSeconds: (Date.now() - fromWall) / 1000,
      meaning: 'Cure removes permission restraint while preserving active ordinary last reload; refill/fire occurs at first eligible deadline tick.'};
    await wait(() => latest().serverTime >= restrained.trapFireRestraint!.expiresAt + 100);
    assert.equal(player(targetId).trapFireRestraint, undefined);
    assert.equal(events[0].filter(e => e.type === 'trapRestraintEnded' && e.playerId === targetId).length, 1);
    evidence.afterOriginalDeadline = {tick: latest().tick, serverTime: latest().serverTime,
      wallTime: Date.now(), originalExpiresAt: restrained.trapFireRestraint.expiresAt,
      player: {...player(targetId)}, restraintEndEvents: 1,
      meaning: 'No remaining restraint or second end event; exact raw uint8 single-write proved separately by clear/authority rules.'};
    const other = new Map(snapshots[1].map(frame => [frame.tick, frame]));
    const common = snapshots[0].filter(frame => other.has(frame.tick));
    for (const frame of common) assert.deepEqual(frame.players, other.get(frame.tick)!.players);
    const dualEvents = ['trapTriggered', 'trapRestraintEnded', 'itemUsed'];
    for (const type of dualEvents) {
      const event = events[0].find(e => e.type === type && (e.playerId === targetId || e.targetId === targetId))!;
      assert(event); assert(events[1].some(row => JSON.stringify(row) === JSON.stringify(event)));
    }
    evidence.sharedTicks = common.map(frame => frame.tick);
    evidence.leave = [];
    for (const client of clients) {const result = await client.callApi('Leave', {roomId, round: 1});
      (evidence.leave as unknown[]).push(result); assert(result.isSucc);}
    evidence.status = 'PASS_LIMITED_CORK_CURE_PRESERVES_LAST_RELOAD_SCOPE';
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
