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
  const output = `recovery/output/pet-injection-trap-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-injection-trap-'));
  const database = join(directory, 'accounts.sqlite'), port = 3299;
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
    fixture: 'Native SQLite checkpoint of two ordinary BUY3/pet2 Accounts, owner has one previously purchased3003/slot1. New target formal BUY injection3x2/slot4; no ownership/live state imports.',
    checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'FUNC10 rebuilt injection cure of active purchased3003 restraint before its deadline; ordinary inputs, one durable consumption, repeated no-state rejection, dual states/events, movement restoration and normal Leave only.'};
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Condition deadline; server tail: ' + log.slice(-500));
  }
  const sequence = [0, 0];
  const inputs: unknown[] = [];
  async function input(index: number, move = 0, turn = 0, useItem = 0): Promise<void> {
    const value = {sequence: ++sequence[index], move, turn, aim: 0, fire: false, useItem, clientTime: Date.now()};
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
    const trap = ownerStock.res.records.find(row => row.itemTableId === 3003)!;
    assert.equal(trap.ownedQuantity, 1);
    const bought = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 3,
      quantity: 2, currency: 'MONEY', requestId: 'trap_injection_first'}); assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    assert.equal(bought.res.purchased!.ownedQuantity, 2);
    const assignment = await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId});
    evidence.assignment = assignment; assert(assignment.isSucc);
    evidence.purchase = bought.res;
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '注射解夹', name: 'Owner', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(frames => frames.at(-1)?.phase === 'PLAYING'));
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
    assert(aligned); await input(1, 1);
    await wait(() => snapshots.every(frames => frames.at(-1)?.players.find(p => p.id === targetId)?.trapRestraint?.movePermissionCount === 0));
    await input(1);
    const restrained = {...player(targetId)}, beforeUse = latest();
    assert(restrained.trapRestraint); assert(beforeUse.serverTime < restrained.trapRestraint.expiresAt);
    evidence.restrained = {player: restrained, tick: beforeUse.tick, serverTime: beforeUse.serverTime, wallTime: Date.now()};
    await input(1, 0, 0, 5);
    await wait(() => events.every(rows => rows.some(e => e.type === 'itemUsed' && e.playerId === targetId && e.skillId === 3))
      && snapshots.every(frames => !frames.at(-1)?.players.find(p => p.id === targetId)?.trapRestraint));
    const cleared = {...player(targetId)}, afterUse = latest();
    const ended = events[0].find(e => e.type === 'trapRestraintEnded' && e.playerId === targetId)!;
    assert(ended); assert.equal(ended.value, 1); assert(afterUse.serverTime < restrained.trapRestraint.expiresAt);
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
    await input(1); const from = {...player(targetId)}, movementTick = latest().tick;
    const fromTime = latest().serverTime; await input(1, 1);
    await wait(() => latest().tick >= movementTick + 5); await input(1);
    const to = {...player(targetId)};
    assert(Math.hypot(to.x - from.x, to.z - from.z) > 10);
    evidence.restoredMovement = {from, to, fromTick: movementTick, toTick: latest().tick,
      fromServerTime: fromTime, toServerTime: latest().serverTime,
      meaning: 'Ordinary movement is released; speed/turn formula already accepted, not a fresh full movement calibration.'};
    await wait(() => latest().serverTime >= restrained.trapRestraint!.expiresAt + 100);
    assert.equal(player(targetId).trapRestraint, undefined);
    assert.equal(events[0].filter(e => e.type === 'trapRestraintEnded' && e.playerId === targetId).length, 1);
    evidence.afterOriginalDeadline = {tick: latest().tick, serverTime: latest().serverTime,
      wallTime: Date.now(), originalExpiresAt: restrained.trapRestraint.expiresAt,
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
    evidence.status = 'PASS_LIMITED_PURCHASED_TRAP_INJECTION_SCOPE';
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
