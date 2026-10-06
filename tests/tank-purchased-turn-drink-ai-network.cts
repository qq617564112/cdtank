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
  const output = `recovery/output/tank-purchased-turn-drink-ai-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-turn-drink-ai-'));
  const database = join(directory, 'accounts.sqlite'), port = 3327;
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database},
    stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => frames[index].push({snapshot, wallTime: Date.now()}));
    client.listenMsg('RoomEvent', event => events[index].push(event));
  });
  const evidence: Record<string, unknown> = {status: 'RUNNING', checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'M2-03/I07 first real purchased turn7 Autopilot independent movementReady consumer;old full-source fixture AI evidence reused, same source formula; prior purchase/hit/persistence/effects reused. Legitimate BUY3/pet2 checkpoint, no live state injection or bound gear assumption.',
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
    const oracle = (extraIds: number[]) => recomputeQualifiedRoleMovement({
      tank: TANKS.find(tank => tank.id === 3)!.recomputeBase,
      pet: PET_BASES.find(pet => pet.id === 2)!,
      ownedField34: tankFields.get(0x34), tankType: TANKS.find(tank => tank.id === 3)!.recomputeBase.tankType,
      sources: {currentSkillIds: [...combatItemSkills.get(2001)!.skillIds, ...extraIds],
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    const baseline = oracle([]), boosted = oracle([7]); assert(baseline && boosted);
    evidence.source = {tankFields: [...tankFields], baseline, boosted, skill: combatSkills.get(7),
      boundGear: 'not established; no selected pet substitution'};
    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 7,
      quantity: 1, currency: 'MONEY', requestId: 'purchased_turn_drink_ai_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const assignment = await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 4,
      instanceId: bought.res.purchased!.instanceId});
    evidence.assignment = assignment; assert(assignment.isSucc);
    const host = await clients[0].callApi('CreateRoom', {mode: 2, mapId: 2,
      roomName: '真购托管回旋', name: 'Measured', tankId: 3,
      minPlayers: 4, maxPlayers: 4});
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
    assert.equal(player().tankId, 3); assert.equal(player().petId, 2); assert.equal(player().isVIP, false);
    evidence.initial = player();
    const enabled = await clients[0].callApi('Autopilot', {round: 1, enabled: true});
    evidence.enabled = enabled; assert(enabled.isSucc);
    const used = () => events[0].filter(event => event.playerId === id && event.type === 'itemUsed' && event.skillId === 7);
    await wait(() => !!player().turnBoost && used().length === 1);
    const start = latest().tick;
    await wait(() => latest().tick >= start + 12);
    const samples = frames[0].filter(row => row.snapshot.phase === 'PLAYING'
      && row.snapshot.tick >= start && row.snapshot.tick <= start + 12);
    const steps = samples.slice(1).flatMap((row,index) => {
      const previous = samples[index];
      const before = previous.snapshot.players.find(p => p.id === id)!;
      const after = row.snapshot.players.find(p => p.id === id)!;
      if (!before.alive || !after.alive || !before.turnBoost || !after.turnBoost
          || row.snapshot.tick !== previous.snapshot.tick+1) return [];
      return [{tick:row.snapshot.tick, distance:Math.hypot(after.x-before.x,after.z-before.z),
        bodyAngle:Math.atan2(Math.sin((after.bodyYaw??after.yaw)-(before.bodyYaw??before.yaw)),
          Math.cos((after.bodyYaw??after.yaw)-(before.bodyYaw??before.yaw))),
        simulationSeconds:.05,serverSeconds:(row.snapshot.serverTime-previous.snapshot.serverTime)/1000,
        wallSeconds:(row.wallTime-previous.wallTime)/1000}];
    });
    const turning = steps.filter(step => step.distance<.01 && Math.abs(step.bodyAngle)>.005);
    evidence.autonomousTurning = {samples,steps,stationaryTurningSteps:turning.length};
    assert(turning.length>=3,'Expected actual stationary capture-goal turning during autonomous boost');
    assert(turning.every(step => Math.abs(Math.abs(step.bodyAngle)-boosted.turn*.05)<.001),'Recovered stationary turn consumer');
    const stock = await clients[0].callApi('Inventory',{}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === bought.res.purchased!.instanceId)!.ownedQuantity,0);
    evidence.stockAfter = stock.res; assert.equal(used().length,1);
    const disabled = await clients[0].callApi('Autopilot',{round:1,enabled:false});
    evidence.disabled = disabled; assert(disabled.isSucc);
    const stop = latest().tick; await wait(() => latest().tick>=stop+7);
    const stopped = frames[0].filter(row => row.snapshot.tick>=stop+2 && row.snapshot.tick<=stop+7)
      .map(row => row.snapshot.players.find(p=>p.id===id)!);
    assert(stopped.length>=5);
    assert(stopped.every(row => !row.isAutopilot && row.x===stopped[0].x && row.z===stopped[0].z
      && row.yaw===stopped[0].yaw && row.bodyYaw===stopped[0].bodyYaw && row.aim===stopped[0].aim));
    evidence.stopped = stopped; evidence.clientPlayerInputCount = 0;
    await wait(() => events[1].some(event => event.playerId===id && event.type==='itemUsed' && event.skillId===7));
    const core = (rows:MsgRoomEvent[]) => rows.filter(event => event.playerId===id && event.type==='itemUsed' && event.skillId===7);
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
    evidence.status = 'PASS_LIMITED_PURCHASED_TURN_DRINK_AI_CONSUMER';
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
