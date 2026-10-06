import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatItemSkills, combatLimits, combatSkills} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {freezeSelectedBoundSource} from '../apps/server/src/battle/roles/selected-bound-source';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise; assert(result.isSucc, JSON.stringify(result)); return result.res;
}
async function main(): Promise<void> {
  const port = Number(process.env.PET_LEARNING_PORT);
  assert.equal(port, 3605, 'Use the coordinated Pet learning window');
  const source = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-learning-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const fixtureDb = new DatabaseSync(database);
  const saved = fixtureDb.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identities[1].accountId)!;
  const pointFixture = new Uint8Array(saved.payload as Uint8Array);
  new DataView(pointFixture.buffer).setUint32(0x80, 200, true);
  fixtureDb.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(pointFixture, identities[1].accountId);
  fixtureDb.close();
  const output = 'recovery/output/pet-learning-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port,
    fixture: {source: source + '-checkpoint.sqlite', preServiceSkillPoints: 200, earnedPointsProved: false,
      ownedRecordsInjected: false, fundsInjected: false},
    scope: 'Normal new BUY52/Pet2, rank-zero purchase reconstruction, WAITING learning/ready reset/source refresh, atomic replay/reject, ordinary movement, dual players, Leave/native persistence/same-database restart.'};
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, i) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[i].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[i].push(event);});
  });
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), log.slice(-700));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);}); server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve)); server.kill(); await closed;
    }
  }
  const latest = (i = 0) => frames[i].at(-1)!.snapshot;
  try {
    await start();
    for (const [i, client] of clients.entries()) {
      assert((await client.connect()).isSucc); await must(client.callApi('Account', {token: identities[i].token}));
    }
    const oldOwned = await must(clients[1].callApi('OwnedRoles', {})); evidence.oldOwned = oldOwned;
    const boughtTank = await must(clients[1].callApi('TankShop', {operation: 'BUY', tankId: 52,
      currency: 'MONEY', requestId: 'learning_medium52_first'}));
    const boughtPet = await must(clients[1].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'learning_new_pet2_first'}));
    const petRecord = boughtPet.purchased!, tankRecord = boughtTank.purchased!;
    evidence.purchase = {tank: boughtTank, pet: boughtPet};
    const base = {name: petRecord.name, fields: new Map(petRecord.fields)};
    const equipment = {name: tankRecord.name, fields: new Map(tankRecord.fields)};
    assert.deepEqual(Array.from({length: 6}, (_, i) => base.fields.get(0x5c + i * 4)), [0, 0, 0, 0, 0, 0]);
    const instanceId = base.fields.get(0)!;
    await must(clients[1].callApi('SelectRole', {kind: 'tank', instanceId: equipment.fields.get(0x1c)!}));
    await must(clients[1].callApi('SelectRole', {kind: 'pet', instanceId}));
    const initial = await must(clients[1].callApi('PetSkillLearning', {operation: 'QUERY'})); evidence.initial = initial;
    assert.equal(initial.points, 200);
    for (const record of oldOwned.base) assert.deepEqual(initial.owned.base.find(row => new Map(row.fields).get(0) === new Map(record.fields).get(0)), record);
    assert.equal(initial.quotes.find(row => row.instanceId === instanceId && row.slot === 4)?.kind, 'eligible');
    const combat = createRoleCombatState();
    for (const id of combatItemSkills.get(2001)!.skillIds) if (id) combat.addSkill(id);
    const tank = TANKS.find(row => row.id === 52)!, pet = PET_BASES.find(row => row.id === 2)!;
    const sourceSkills = () => readRoleSkillSources({currentSkillIds: [...combat.record!.arrays.get(4)!],
      boundGear: freezeSelectedBoundSource(base), equipment, roleFields: combat.attributeSourceFields()!});
    const selected = () => selectRoleSkills(sourceSkills(), combatSkills, combatItemSkills).map(skill => skill.skillId);
    const movement = () => recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
      ownedField34: equipment.fields.get(0x34), tankType: tank.recomputeBase.tankType, sources: sourceSkills(),
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: combat.recomputeCounter,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    const beforeMovement = movement(), beforeIds = selected(); assert(!beforeIds.includes(10251));
    const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '技能学习', name: 'Host', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must(clients[1].callApi('Join', {roomId: created.room.id, clientId: 'unused', name: 'Learner', tankId: 52}));
    evidence.room = {created, joined};
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.players.some(row => row.id === joined.playerId)));
    assert.deepEqual(latest().players.find(row => row.id === joined.playerId)!.roleSkillSources!.selectedSkillIds, beforeIds);
    await must(clients[1].callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.match?.readyPlayerIds.includes(joined.playerId)));
    evidence.readyBeforeLearning = latest();
    const request = {operation: 'LEARN' as const, instanceId, slot: 4, requestId: 'learning_passive10251_first'};
    const learned = await must(clients[1].callApi('PetSkillLearning', request)); evidence.learned = learned;
    assert.deepEqual(learned.learned, {instanceId, slot: 4, skillId: 10251, rank: 1, cost: 200}); assert.equal(learned.points, 0);
    base.fields.set(0x6c, 1);
    const expectedOwned = structuredClone(initial.owned);
    expectedOwned.base.find(row => new Map(row.fields).get(0) === instanceId)!.fields = [...base.fields];
    assert.deepEqual(learned.owned, expectedOwned);
    const expectedProfile = Uint8Array.from(initial.profile!.bytes); new DataView(expectedProfile.buffer).setUint32(0x80, 0, true);
    assert.deepEqual(learned.profile, {bytes: [...expectedProfile], strings: initial.profile!.strings});
    const afterMovement = movement(), afterIds = selected(); assert(afterIds.includes(10251));
    await wait(() => frames.every(rows => {
      const frame = rows.at(-1)?.snapshot;
      return frame?.phase === 'WAITING' && !frame.match?.readyPlayerIds.includes(joined.playerId)
        && frame.players.find(row => row.id === joined.playerId)?.roleSkillSources?.selectedSkillIds.includes(10251);
    }));
    evidence.waitingAfterLearning = latest();
    const expectedSources = {currentSkillIds: [...sourceSkills().currentSkillIds!],
      equipmentSkills: sourceSkills().equipmentSkills!, selectedSkillIds: afterIds};
    for (const i of [0, 1]) assert.deepEqual(latest(i).players.find(row => row.id === joined.playerId)!.roleSkillSources, expectedSources);
    const replay = await must(clients[1].callApi('PetSkillLearning', request));
    assert.equal(replay.replayed, true); assert.equal(replay.points, 0); assert.deepEqual(replay.owned, learned.owned); evidence.replay = replay;
    const capReject = await clients[1].callApi('PetSkillLearning', {...request, requestId: 'learning_passive_cap_reject'});
    assert(!capReject.isSucc); evidence.capReject = capReject;
    const ownerReject = await clients[0].callApi('PetSkillLearning', {...request, requestId: 'learning_other_owner_reject'});
    assert(!ownerReject.isSucc); evidence.ownerReject = ownerReject;
    const insufficient = await clients[1].callApi('PetSkillLearning', {operation: 'LEARN', instanceId, slot: 0,
      requestId: 'learning_insufficient_reject'}); assert(!insufficient.isSucc); evidence.insufficientReject = insufficient;
    const conflict = await clients[1].callApi('PetSkillLearning', {...request, slot: 0});
    assert(!conflict.isSucc); evidence.requestConflict = conflict;
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const playingReject = await clients[1].callApi('PetSkillLearning', {operation: 'LEARN', instanceId, slot: 0,
      requestId: 'learning_playing_reject'}); assert(!playingReject.isSucc); evidence.playingReject = playingReject;
    const unchanged = await must(clients[1].callApi('PetSkillLearning', {operation: 'QUERY'}));
    assert.deepEqual(unchanged.owned, learned.owned); assert.deepEqual(unchanged.profile, learned.profile);
    const hp = latest().players.find(row => row.id === joined.playerId)!.hp;
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 1, move: 1, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    const startTick = latest().tick; await wait(() => latest().tick >= startTick + 7);
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 2, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    const sampled = frames[0].filter(row => row.snapshot.phase === 'PLAYING' && row.snapshot.tick >= startTick + 1 && row.snapshot.tick <= startTick + 6);
    assert.equal(sampled.length, 6); const first = sampled[0], last = sampled.at(-1)!;
    const a = first.snapshot.players.find(row => row.id === joined.playerId)!, b = last.snapshot.players.find(row => row.id === joined.playerId)!;
    const simSeconds = (last.snapshot.tick - first.snapshot.tick) * .05;
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    assert(Math.abs(distance / simSeconds - afterMovement.speed) < .05);
    assert(Math.abs(distance / simSeconds - beforeMovement.speed) > 1);
    assert.equal(b.hp, hp);
    evidence.movement = {beforeFormula: beforeMovement, learnedFormula: afterMovement, distance,
      simSeconds, serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
      wallSeconds: (last.wallTime - first.wallTime) / 1000, ticks: sampled.map(row => row.snapshot.tick)};
    const key = (frame: MsgRoomSnapshot) => `${frame.match?.round}/${frame.phase}/${frame.tick}`;
    const remote = new Map(frames[1].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
    const common = [...new Map(frames[0].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot])).values()].filter(frame => remote.has(key(frame)));
    assert(common.length >= 6);
    for (const frame of common) {assert.deepEqual(frame.players, remote.get(key(frame))!.players);
      assert.deepEqual(frame.players.find(row => row.id === joined.playerId)!.roleSkillSources, expectedSources);}
    evidence.commonKeys = common.map(key); evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
    const final = await must(clients[1].callApi('PetSkillLearning', {operation: 'QUERY'}));
    assert.deepEqual(final.owned, learned.owned); assert.deepEqual(final.profile, learned.profile); evidence.final = final;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const profile = native.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identities[1].accountId)!;
      const bytes = profile.payload as Uint8Array;
      const points = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0x80, true);
      const record = JSON.parse(String(native.prepare("SELECT record FROM role_records WHERE account_id = ? AND kind = 'base' AND instance_id = ?").get(identities[1].accountId, instanceId)!.record));
      assert.equal(points, 0); assert.equal(new Map<number, number>(record.fields).get(0x6c), 1);
      evidence.native = {points, owned: record};
      await backup(native, output + '-checkpoint.sqlite');
      writeFileSync(output + '-identity.private.json', JSON.stringify({accounts: identities}) + '\n', {mode: 0o600});
      evidence.checkpoint = output + '-checkpoint.sqlite';
    } finally {native.close();}
    await start(); assert((await clients[1].connect()).isSucc);
    await must(clients[1].callApi('Account', {token: identities[1].token}));
    const restored = await must(clients[1].callApi('PetSkillLearning', {operation: 'QUERY'}));
    assert.deepEqual(restored, final); evidence.restored = restored; evidence.actualSameDatabaseRestart = true;
    evidence.status = 'PASS_FINITE_NORMAL_PURCHASE_PET_LEARNING_WAITING_SOURCE_MOVEMENT_DUAL_STATE_PERSISTENCE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    evidence.frames = frames; evidence.events = events;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
