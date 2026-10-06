import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';

async function main(): Promise<void> {
  const vipOnly = false;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/tank-purchased-movement-drinks-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-movement-drinks-'));
  const database = join(directory, 'accounts.sqlite'), port = 3325;
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database},
    stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: vipOnly ? 4 : 2}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => frames[index].push({snapshot, wallTime: Date.now()}));
    client.listenMsg('RoomEvent', event => events[index].push(event));
  });
  const evidence: Record<string, unknown> = {status: 'RUNNING', checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'M2-03/I06/I07 first real purchased6/7 independent recoveredMovement consumer;prior fixture movement/effects/lifecycle reused. Legitimate BUY3/pet2 checkpoint, no live state injection or bound gear assumption.',
    vipOnly, simulationTickSeconds: .05};
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Deadline: ' + log.slice(-600));
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', index < 2 ? {token: accounts[index].token} : {});
      assert(account.isSucc);
      if (index >= 2) {
        const observerOwned = await client.callApi('OwnedRoles', {}); assert(observerOwned.isSucc);
        assert.deepEqual(observerOwned.res, {base: [], equipment: []});
      }
    }
    const owned = await clients[0].callApi('OwnedRoles', {}); assert(owned.isSucc);
    const tankFields = new Map(owned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields);
    assert([0x58, 0x5c, 0x60].every(offset => tankFields.has(offset)));
    const petFields = new Map(owned.res.base.find(row => new Map(row.fields).get(8) === 2)!.fields);
    const oracle = (extraIds: number[]) => recomputeQualifiedRoleMovement({
      tank: TANKS.find(tank => tank.id === 3)!.recomputeBase,
      pet: PET_BASES.find(pet => pet.id === 2)!,
      ownedField34: tankFields.get(0x34), tankType: TANKS.find(tank => tank.id === 3)!.recomputeBase.tankType,
      sources: {currentSkillIds: [...combatItemSkills.get(2001)!.skillIds, ...extraIds],
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    const baseline = oracle([]), boostedMove = oracle([6]), boostedBoth = oracle([6, 7]);
    assert(baseline && boostedMove && boostedBoth);
    evidence.source = {tankFields: [...tankFields], petFields: [...petFields], baseline, boostedMove, boostedBoth,
      sourceSkills: [combatSkills.get(6), combatSkills.get(7)],
      boundGear: 'not established; no selected pet substitution', extraSkill: 'original initialized zero; no installed extra/parts in checkpoint'};
    evidence.purchases = []; evidence.assignments = [];
    const instances: number[] = [];
    for (const [index, itemTableId] of [6, 7].entries()) {
      const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId,
        quantity: 1, currency: 'MONEY', requestId: `purchased_movement_drink${itemTableId}_first`});
      (evidence.purchases as unknown[]).push(bought); assert(bought.isSucc);
      instances.push(bought.res.purchased!.instanceId);
      const assignment = await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 4 + index,
        instanceId: bought.res.purchased!.instanceId});
      (evidence.assignments as unknown[]).push(assignment); assert(assignment.isSucc);
    }
    const host = await clients[0].callApi('CreateRoom', {mode: vipOnly ? 3 : 4, mapId: 7,
      roomName: '真购运动饮料', name: 'Measured', tankId: 3,
      minPlayers: vipOnly ? 4 : 2, maxPlayers: vipOnly ? 4 : 2});
    assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: 'Observer', tankId: 3}); assert(guest.isSucc);
    for (const client of clients.slice(2)) {
      const observer = await client.callApi('Join', {roomId: host.res.room.id,
        clientId: 'ignored', name: '普通队员', tankId: 1});
      assert(observer.isSucc);
    }
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const id = host.res.playerId;
    const player = () => latest().players.find(row => row.id === id)!;
    let sequence = 0;
    async function input(move = 0, turn = 0, aim = 0, useItem = 0): Promise<void> {
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move, turn,
        aim, fire: false, useItem, clientTime: Date.now()})).isSucc);
    }
    const initialHp = player().hp;
    evidence.initial = player();
    assert.equal(player().tankId, 3); assert.equal(player().petId, 2); assert.equal(player().isVIP, false);
    evidence.segments = [];
    async function measure(name: string, expected: {speed: number; turn: number}, move: number, turn: number, aim: number): Promise<void> {
      const startTick = latest().tick;
      await input(move, turn, aim); await wait(() => latest().tick >= startTick + 7);
      const samples = frames[0].filter(row => row.snapshot.tick > startTick + 1 && row.snapshot.tick <= startTick + 7)
        .map(row => ({...row, player: row.snapshot.players.find(p => p.id === id)!}));
      assert(samples.length >= 5);
      const first = samples[0], last = samples.at(-1)!;
      const seconds = (last.snapshot.tick - first.snapshot.tick) * .05;
      let distance = 0, body = 0, turret = 0;
      for (let index = 1; index < samples.length; index++) {
        const previous = samples[index - 1].player, current = samples[index].player;
        distance += Math.hypot(current.x - previous.x, current.z - previous.z);
        const delta = (a: number, b: number) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
        body += delta(current.bodyYaw ?? current.yaw, previous.bodyYaw ?? previous.yaw);
        turret += delta(current.aim, previous.aim);
      }
      const result = {name, expected, input: {move, turn, aim}, samples, distance, body, turret,
        simulationSeconds: seconds, serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime)/1000,
        wallSeconds: (last.wallTime-first.wallTime)/1000};
      (evidence.segments as unknown[]).push(result);
      if (move) {
        assert(Math.abs(distance/seconds-expected.speed)<.3, name+' speed');
        const projected = (last.player.x-first.player.x)*Math.sin(first.player.yaw)
          + (last.player.z-first.player.z)*Math.cos(first.player.yaw);
        assert.equal(Math.sign(projected), move, name+' signed direction');
      }
      if (turn) assert(Math.abs(body/seconds-turn*expected.turn)<.002, name+' body');
      if (aim) {assert(Math.abs(turret/seconds-aim*expected.turn)<.002,name+' aim'); assert(Math.abs(body)<.0002);}
      await input();
    }
    await measure('baselineForward',baseline,1,0,0);
    await measure('baselineReverse',baseline,-1,0,0);
    await input(0,0,0,5); await wait(() => !!player().speedBoost);
    evidence.speedUsed = {snapshot: latest(), wallTime: Date.now()};
    await measure('boostedForward',boostedMove,1,0,0);
    await measure('boostedReverse',boostedMove,-1,0,0);
    await input(0,0,0,6); await wait(() => !!player().turnBoost);
    evidence.turnUsed = {snapshot: latest(), wallTime: Date.now()};
    await measure('boostedBody',boostedBoth,0,1,0);
    await measure('boostedIndependentAim',boostedBoth,0,0,1);
    await wait(() => !player().speedBoost && !player().turnBoost);
    evidence.restored = {snapshot: latest(), wallTime: Date.now()};
    await measure('restoredForward',baseline,1,0,0);
    await measure('restoredBody',baseline,0,1,0);
    await measure('restoredIndependentAim',baseline,0,0,1);
    const stock = await clients[0].callApi('Inventory', {}); assert(stock.isSucc);
    for (const instance of instances) assert.equal(stock.res.records.find(row => row.instanceId === instance)!.ownedQuantity,0);
    evidence.stockAfter = stock.res;
    assert.equal(player().hp, initialHp);
    await wait(() => events[1].filter(event => event.playerId === id && ['itemUsed','skillStopped'].includes(event.type)).length === 4);
    const core = (rows: MsgRoomEvent[]) => rows.filter(event => event.playerId === id && ['itemUsed','skillStopped'].includes(event.type));
    assert.deepEqual(core(events[0]),core(events[1]));
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING'
      && frames[1].some(b => b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === 'PLAYING'));
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === 'PLAYING')!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    assert(common.length > 10); evidence.commonTicks = common.length;
    evidence.leave = [];
    for (const client of clients) {
      const leave = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(leave); assert(leave.isSucc);
    }
    evidence.status = 'PASS_LIMITED_PURCHASED_MOVEMENT_DRINKS_CONSUMER';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    evidence.frames = frames; evidence.events = events;
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2));
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS ' + output + '.json');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
