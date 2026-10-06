import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatItemSkills, combatLimits, combatSkills} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {freezeSelectedBoundSource} from '../apps/server/src/battle/roles/selected-bound-source';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

async function main(): Promise<void> {
  const port = Number(process.env.SELECTED_BOUND_PORT);
  assert(Number.isInteger(port) && port > 0, 'A coordinated network port is required');
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const identities = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts as {token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-selected-bound-'));
  const database = join(directory, 'accounts.sqlite');
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const output = 'recovery/output/selected-pet-bound-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  let server: ChildProcess | undefined, log = '';
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  const sequence = [0, 0], inputs: unknown[] = [];
  const evidence: Record<string, unknown> = {status: 'RUNNING', port,
    checkpoint: checkpoint + '-checkpoint.sqlite', simulationTickSeconds: .05,
    scope: 'Normal purchased Tank52/Pet2 selected-source binding, unified movement and turn consumers, dual complete player states, normal Leave. Original +a0 producer remains unknown; source binding and A/D/Arrow mapping are explicit reconstructions.',
    fixture: 'Native copy of a lawful ordinary BUY Tank3/Pet2 checkpoint. No owned fields, ranks, HP, pose, active timers or events are injected. Guest acquires Tank52 through ordinary TankShop BUY.',
  };
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  const player = (id: string) => latest().players.find(row => row.id === id)!;
  async function wait(predicate: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), 'Condition deadline; server tail: ' + log.slice(-600));
  }
  async function input(index: number, move = 0, turn = 0, aim = 0): Promise<void> {
    const value = {sequence: ++sequence[index], move, turn, aim, fire: false, useItem: 0, clientTime: Date.now()};
    inputs.push({index, ...value});
    assert((await clients[index].sendMsg('PlayerInput', value)).isSucc);
  }
  const angle = (after: number, before: number) => Math.atan2(Math.sin(after - before), Math.cos(after - before));
  try {
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {token: identities[index].token})).isSucc);
    }
    const before = await clients[1].callApi('OwnedRoles', {}); assert(before.isSucc);
    const petRecord = before.res.base.find(row => new Map(row.fields).get(8) === 2)!;
    assert(petRecord);
    const pet = {name: petRecord.name, fields: new Map(petRecord.fields)};
    const bought = await clients[1].callApi('TankShop', {operation: 'BUY', tankId: 52,
      currency: 'MONEY', requestId: 'tank52_selected_pet_bound_first'});
    evidence.purchase = bought; assert(bought.isSucc, JSON.stringify(bought));
    const tankRecord = bought.res.purchased!;
    const equipment = {name: tankRecord.name, fields: new Map(tankRecord.fields)};
    for (const [kind, instanceId] of [['tank', equipment.fields.get(0x1c)!], ['pet', pet.fields.get(0)!]] as const) {
      const selected = await clients[1].callApi('SelectRole', {kind, instanceId});
      assert(selected.isSucc, JSON.stringify(selected));
    }
    const tank = TANKS.find(row => row.id === equipment.fields.get(0x24))!;
    const petTable = PET_BASES.find(row => row.id === pet.fields.get(8))!;
    assert.equal(tank.recomputeBase.tankType, 2);
    const combat = createRoleCombatState();
    for (const id of combatItemSkills.get(2001)!.skillIds) if (id) combat.addSkill(id);
    const bound = freezeSelectedBoundSource(pet)!; assert(bound);
    const sources = (binding: typeof bound | undefined) => readRoleSkillSources({
      currentSkillIds: [...combat.record!.arrays.get(4)!], boundGear: binding,
      equipment, roleFields: combat.attributeSourceFields()!,
    });
    const movement = (binding: typeof bound | undefined) => recomputeQualifiedRoleMovement({
      tank: tank.recomputeBase, pet: petTable, ownedField34: equipment.fields.get(0x34),
      tankType: tank.recomputeBase.tankType, sources: sources(binding),
      skills: combatSkills, items: combatItemSkills, limits: combatLimits,
      roleValue9: combat.recomputeCounter, movementScales: ROLE_INITIAL_MOVEMENT_SCALES,
    })!;
    const expected = movement(bound), unbound = movement(undefined);
    const armor = recomputeQualifiedRoleArmor({tank: tank.recomputeBase, pet: petTable,
      tankType: tank.recomputeBase.tankType, ownedField34: equipment.fields.get(0x34),
      ownedAtk: equipment.fields.get(0x3c), ownedAtkBonus: equipment.fields.get(0x40),
      ownedDef: equipment.fields.get(0x4c), ownedDefBonus: equipment.fields.get(0x50),
      sources: sources(bound), skills: combatSkills, items: combatItemSkills,
      limits: combatLimits, roleValue9: combat.recomputeCounter});
    assert(armor, 'Purchased Tank52 must qualify for the existing type2 armor formula');
    evidence.armorFormula = {tankType: 2, values: armor, scope: 'Source composition only; no damage or HP inference'};
    assert(expected && unbound && expected.speed !== unbound.speed && expected.turn !== unbound.turn);
    const selectedIds = selectRoleSkills(sources(bound), combatSkills, combatItemSkills).map(skill => skill.skillId);
    assert(selectedIds.includes(10251));
    assert(![10215, 10221, 10235, 10245, 10260].some(id => selectedIds.includes(id)));
    evidence.source = {tankId: tank.id, petId: petTable.id, equipment: [...equipment.fields],
      base: [...pet.fields], boundSource: [...bound.fields], selectedSkillIds: selectedIds,
      currentSkillIds: [...combat.record!.arrays.get(4)!], expected, unbound,
      scope: 'Formula inputs from the same actual account records; existing original formula modules reused.'};
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '中型宠物被动来源',
      name: 'Host', tankId: 3, minPlayers: 2, maxPlayers: 2});
    evidence.creation = created; assert(created.isSucc, JSON.stringify(created));
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Medium', tankId: 52});
    evidence.join = joined; assert(joined.isSucc, JSON.stringify(joined));
    const targetId = joined.res.playerId;
    evidence.targetId = targetId;
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.players.some(row => row.id === targetId)));
    evidence.waiting = {snapshot: latest(), wallTime: Date.now()};
    const expectedSources = {currentSkillIds: [...sources(bound).currentSkillIds!],
      equipmentSkills: sources(bound).equipmentSkills!, selectedSkillIds: selectedIds};
    const checkSources = () => {
      for (const rows of frames) assert.deepEqual(
        rows.at(-1)!.snapshot.players.find(row => row.id === targetId)!.roleSkillSources,
        expectedSources);
    };
    checkSources();
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    assert.equal(player(targetId).petId, 2); assert.equal(player(targetId).tankId, 52);
    checkSources();
    const hp = player(targetId).hp;
    evidence.initial = {snapshot: latest(), wallTime: Date.now()};
    const controls = [];
    for (const [name, move, turn, aim] of [['forward', 1, 0, 0], ['reverse', -1, 0, 0],
      ['body', 0, 1, 0], ['turret', 0, 0, 1]] as const) {
      await input(1, move, turn, aim);
      const start = latest().tick;
      await wait(() => latest().tick >= start + 7);
      await input(1);
      const sampled = frames[0].filter(row => row.snapshot.phase === 'PLAYING'
        && row.snapshot.tick >= start + 1 && row.snapshot.tick <= start + 6);
      assert.equal(sampled.length, 6);
      const first = sampled[0], last = sampled.at(-1)!;
      const a = first.snapshot.players.find(row => row.id === targetId)!;
      const b = last.snapshot.players.find(row => row.id === targetId)!;
      const seconds = (last.snapshot.tick - first.snapshot.tick) * .05;
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      const heading = a.bodyYaw ?? a.yaw;
      const signedForwardDistance = (b.x - a.x) * Math.sin(heading) + (b.z - a.z) * Math.cos(heading);
      const body = angle(b.bodyYaw ?? b.yaw, a.bodyYaw ?? a.yaw);
      const turret = angle(b.yaw + b.aim, a.yaw + a.aim);
      if (move) {
        assert(Math.sign(signedForwardDistance) === Math.sign(move), 'Forward/reverse direction must match ordinary input');
        assert(Math.abs(distance / seconds - expected.speed) < .05, `Expected bound speed ${expected.speed}; observed ${distance / seconds}`);
        assert(Math.abs(distance / seconds - unbound.speed) > 1, 'Unbound result must be distinguishable');
      } else assert(distance < .02);
      if (turn) assert(Math.abs(body / seconds - expected.turn) < .001);
      else assert(Math.abs(body) < .001);
      if (aim) assert(Math.abs(turret / seconds - expected.turn) < .001);
      controls.push({name, input: {move, turn, aim}, ticks: sampled.map(row => row.snapshot.tick),
        distance, signedForwardDistance, bodyRadians: body, turretRadians: turret, simulatedSeconds: seconds,
        serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
        wallSeconds: (last.wallTime - first.wallTime) / 1000});
    }
    evidence.controls = controls;
    checkSources();
    assert.equal(player(targetId).hp, hp);
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const remote = new Map(frames[1].map(row => [key(row.snapshot), row.snapshot]));
    const common = frames[0].filter(row => remote.has(key(row.snapshot)));
    for (const row of common) assert.deepEqual(row.snapshot.players, remote.get(key(row.snapshot))!.players);
    assert(common.length >= 20);
    evidence.commonKeys = [...new Set(common.map(row => key(row.snapshot)))];
    assert(!events[0].some(event => event.type === 'fire'));
    evidence.leave = [];
    for (const client of clients) {
      const left = await client.callApi('Leave', {roomId: created.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(left); assert(left.isSucc, JSON.stringify(left));
    }
    evidence.status = 'PASS_LIMITED_PURCHASED_MEDIUM_PET_PASSIVE_MOVEMENT_DUAL_NETWORK';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; evidence.frames = frames; evidence.events = events; evidence.inputs = inputs;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
