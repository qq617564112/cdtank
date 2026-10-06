import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES, MAPS} from '../apps/server/src/config';
import {combatCatalog, combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAttributes} from '../apps/server/src/battle/roles/recompute';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

type ArmorFields = NonNullable<ReturnType<typeof recomputeQualifiedRoleArmor>>;

function expectedArmorDamage(rawAttack: number, fields: ArmorFields, correction: number): number {
  return rawAttack * 100 / (100 + Math.max(0, fields.defensePercent * 100 + fields.defenseBonus) * correction);
}

async function main(): Promise<void> {
  const skill = combatSkills.get(10441)!;
  assert.equal(skill.triggerType, 6); assert.equal(skill.target, 1);
  assert.deepEqual(skill.functions[0], {type: 11, t: 3, x: 0, y: 0, z: 0});
  const pet4 = combatCatalog.petTypes!.find(row => row.petId === 4)!;
  assert.equal(pet4.petMoney, 4500); assert.equal(pet4.baseIds![3], 10441); assert.equal(pet4.rankCaps![3], 1);
  assert.deepEqual(combatCatalog.petSkillPrices!.find(row => row.skillId === 10441),
    {skillId: 10441, groupId: 10441, level: 1, cost: 200});
  if (process.argv.includes('--prepare')) {console.log('PREPARED_ORDINARY_PET4_LEARN10441_LAST_STAND_SCOPE'); return;}
  const port = Number(process.env.PET_LAST_STAND_PORT);
  assert.equal(port, 3660); assert.equal(process.env.PET_LAST_STAND_RELEASE, '1');
  const source = 'recovery/output/pet-back-critical-network-2026-10-06T00-14-02-485Z';
  const accounts = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-last-stand-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const fixtureDatabase = new DatabaseSync(database);
  try {
    const row = fixtureDatabase.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(accounts[0].accountId)!;
    const bytes = Uint8Array.from(row.payload as Uint8Array);
    new DataView(bytes.buffer).setUint32(0x80, 200, true);
    fixtureDatabase.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, accounts[0].accountId);
  } finally {fixtureDatabase.close();}
  const output = 'recovery/output/pet-last-stand-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', sourceIdentity: source + '-identity.private.json',
      fundsInjected: false, ownedRecordsInjected: false, pointsInjected: true, pointAccountOrdinal: 0,
      preServicePoint: 200, earnedPointsProved: false}, simulationTickSeconds: .05,
    scope: 'Normal BUY4/Select/rank0 death then WAITING LEARN3/Readyreset, fixed3s HP0alive natural repeat hit and ordinary move/aim/fire, unique death/respawn/freshfire, dual complete/native/sameDBrestart',
    policy: {durationMs: 3000, repeatHitExtendsDeadline: false, healingAccepted: false,
      killScoreAt: 'final death', respawnStartsAt: 'final death', newWire: false, newFX: false}};
  const clients = [0, 1].map(() => new WsClient<ServiceType>(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: {event: MsgRoomEvent; wallTime: number; receivedAfterTick?: number}[][] = [[], []];
  clients.forEach((client, i) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[i].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {
      events[i].push({event, wallTime: Date.now(), receivedAfterTick: frames[i].at(-1)?.snapshot.tick});
    });
  });
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean, timeout = 20000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), 'Deadline: ' + log.slice(-1000));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve));
      server.kill(); await closed;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [i, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      await must(client.callApi('Account', {token: accounts[i].token}));
    }
  }
  async function query(i: number) {
    return {
      inventory: await must<ServiceType['api']['Inventory']['res']>(clients[i].callApi('Inventory', {})),
      equipment: await must<ServiceType['api']['Equipment']['res']>(clients[i].callApi('Equipment', {operation: 'QUERY'})),
      owned: await must<ServiceType['api']['OwnedRoles']['res']>(clients[i].callApi('OwnedRoles', {})),
      learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[i].callApi('PetSkillLearning', {operation: 'QUERY'}))};
  }
  type AccountState = Awaited<ReturnType<typeof query>>;
  function originalFields(account: AccountState, player: MsgRoomSnapshot['players'][number]): ArmorFields {
    const view = new DataView(Uint8Array.from(account.equipment.profile.bytes).buffer);
    const equipment = new Map(account.owned.equipment.find(row => new Map(row.fields).get(0x1c) === view.getUint32(0xa8, true))!.fields);
    const gear = new Map(account.owned.base.find(row => new Map(row.fields).get(0) === view.getUint32(0xa4, true))!.fields);
    const tank = TANKS.find(row => row.id === equipment.get(0x24))!, pet = PET_BASES.find(row => row.id === gear.get(8))!;
    assert.equal(player.tankId, tank.id); assert.equal(player.petId, pet.id);
    assert.equal(account.equipment.decorationInstanceId, 0); assert.equal(account.equipment.markInstanceId, 0);
    for (const offset of [0x2c, 0x34, 0x3c]) assert(gear.has(offset), 'Complete selected base missing ' + offset);
    for (const offset of [0x34, 0x3c, 0x40, 0x4c, 0x50, 0x58, 0x5c, 0x60]) {
      assert(equipment.has(offset), 'Complete selected equipment missing ' + offset);
    }
    const input = {ownedField34: equipment.get(0x34),
      ownedAtk: equipment.get(0x3c), ownedAtkBonus: equipment.get(0x40),
      ownedDef: equipment.get(0x4c), ownedDefBonus: equipment.get(0x50), tank: tank.recomputeBase,
      tankType: tank.recomputeBase.tankType, pet, sources: {
        currentSkillIds: player.roleSkillSources!.currentSkillIds,
        equipmentSkills: Array.from({length: 6}, (_, slot) => ({baseId: gear.get(0x44 + slot * 4)!, rank: gear.get(0x5c + slot * 4)!})),
        extraSkill: {baseId: 0, rank: 0},
        itemIds: [0x58, 0x5c, 0x60].map(offset => equipment.get(offset)!).concat(account.equipment.slots
          .map(id => id ? account.inventory.records.find(row => row.instanceId === id)!.itemTableId : 0), [0, 0])},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0};
    const full = recomputeRoleAttributes({...input, base: {name: '', fields: gear},
      equipment: {name: '', fields: equipment}, movementScales: ROLE_INITIAL_MOVEMENT_SCALES, vip: 0, vipMultiplier: 0},
      {setMovement() {}, notify() {}, clearDirty() {}});
    assert.equal(full.completed, true, 'Complete source must reach original attribute completion');
    assert.equal(full.state.recordFields.get(0x58), player.maxHp);
    const sourceQualification = {playerId: player.id, completed: full.completed,
      recordFields: [...full.state.recordFields], roleIntegers: [...full.state.roleIntegers], roleFloats: [...full.state.roleFloats]};
    (evidence.sourceQualification as unknown[]).push(sourceQualification);
    const fields = recomputeQualifiedRoleArmor(input);
    assert(fields); assert.deepEqual(fields.selectedSkillIds, player.roleSkillSources!.selectedSkillIds);
    return fields;
  }
  function assertNative(final: AccountState[]): void {
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      evidence.native = accounts.map((account, ordinal) => {
        const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(account.accountId)!;
        const data = {bytes: [...profile.payload as Uint8Array], strings: JSON.parse(String(profile.strings))};
        assert.deepEqual(data, final[ordinal].equipment.profile);
        const inventory = native.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId)
          .map(row => JSON.parse(String(row.record)));
        assert.deepEqual(inventory, final[ordinal].inventory.records);
        const owned: {base: unknown[]; equipment: unknown[]} = {base: [], equipment: []};
        for (const row of native.prepare('SELECT kind, record FROM role_records WHERE account_id=? ORDER BY instance_id').all(account.accountId)) {
          owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)));
        }
        assert.deepEqual(owned, final[ordinal].owned);
        return {profile: data, inventory, owned};
      });
      const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM pet_skill_learning WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'last-stand-learn10441')!.receipt));
      assert.deepEqual(receipt, (evidence.learned as ServiceType['api']['PetSkillLearning']['res']).learned);
      evidence.nativeReceipt = receipt;
      {
        const purchase = JSON.parse(String(native.prepare('SELECT receipt FROM pet_purchases WHERE account_id=? AND request_id=?')
          .get(accounts[0].accountId, 'last-stand-buy4')!.receipt));
        assert.deepEqual(purchase, (evidence.petPurchase as ServiceType['api']['PetShop']['res']).purchased);
        evidence.nativePetPurchaseReceipt = purchase;
      }
    } finally {native.close();}
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  const latest = (i = 0) => frames[i].at(-1)?.snapshot;
  const sequences = [0, 0];
  async function input(i: number, move = 0, turn = 0, aim = 0, fire = false): Promise<void> {
    const message = {sequence: ++sequences[i], move, turn, aim, fire, useItem: 0, clientTime: Date.now()};
    assert((await clients[i].sendMsg('PlayerInput', message)).isSucc);
    ((evidence.inputs ??= []) as unknown[]).push({ordinal: i, observedTick: latest()?.tick, message});
  }
  async function dual(snapshot: MsgRoomSnapshot) {
    await wait(() => frames[1].some(row => key(row.snapshot) === key(snapshot)));
    const pair = frames.map(rows => rows.find(row => key(row.snapshot) === key(snapshot))!);
    assert.deepEqual(pair[0].snapshot, pair[1].snapshot); return structuredClone(pair);
  }
  const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const map = MAPS.find(row => row.mode === 4 && row.mapId === 7)!;
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].learning.points, 200); assert.equal(before[1].learning.points, 0);
    assert.equal(before[0].equipment.slots[1], 0, 'Accepted source already ordinarily UNEQUIP17061');
    const beforeView = new DataView(Uint8Array.from(before[0].equipment.profile.bytes).buffer);
    assert(before[0].owned.base.length < 10); assert(beforeView.getUint32(0x70, true) >= 4500);
    const purchase = await must<ServiceType['api']['PetShop']['res']>(clients[0].callApi('PetShop', {
      operation: 'BUY', petId: 4, currency: 'MONEY', requestId: 'last-stand-buy4'}));
    assert(purchase.purchased); evidence.petPurchase = purchase;
    assert.equal(purchase.money, beforeView.getUint32(0x70, true) - 4500);
    const newPet = purchase.purchased, fields = new Map(newPet.fields), instanceId = fields.get(0)!;
    assert.equal(fields.get(8), 4); assert.equal(fields.get(0x50), 10441);
    for (let slot = 0; slot < 6; slot++) assert.equal(fields.get(0x5c + slot * 4), 0);
    evidence.selected = await must(clients[0].callApi('SelectRole', {kind: 'pet', instanceId}));
    const afterSelection = [await query(0), await query(1)]; evidence.afterSelection = afterSelection;
    assert.deepEqual(afterSelection[1], before[1]);
    for (const old of before[0].owned.base) assert.deepEqual(afterSelection[0].owned.base.find(row =>
      new Map(row.fields).get(0) === new Map(old.fields).get(0)), old);
    for (const learned of [false, true]) {
      const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: '最后一搏', name: 'StandHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
      const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'StandPeer', tankId: 3}));
      const roomId = created.room.id;
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
        && latest(i)?.players.length === 2));
      if (learned) {
        await must(clients[0].callApi('Ready', {round: 1}));
        await wait(() => [0, 1].every(i => latest(i)?.match?.readyPlayerIds.includes(created.playerId) === true));
        evidence.beforeLearning = {state: await query(0), snapshots: [latest(0), latest(1)]};
        const result = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {
          operation: 'LEARN', instanceId, slot: 3, requestId: 'last-stand-learn10441'}));
        assert.deepEqual(result.learned, {instanceId, slot: 3, skillId: 10441, rank: 1, cost: 200});
        assert.equal(result.points, 0); evidence.learned = result;
        await wait(() => [0, 1].every(i => latest(i)?.phase === 'WAITING'
          && latest(i)?.match?.readyPlayerIds.length === 0
          && latest(i)?.players.find(p => p.id === created.playerId)?.roleSkillSources?.equipmentSkills[3].rank === 1));
        evidence.afterLearning = {state: await query(0), snapshots: [latest(0), latest(1)]};
      }
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
      const player = (id: string) => latest()!.players.find(p => p.id === id)!;
      const target = () => player(created.playerId), attacker = () => player(joined.playerId);
      assert.equal(target().petId, 4); assert.equal(attacker().petId, 2);
      assert.equal(created.room.mode <= 3 && target().team === attacker().team, false);
      assert.deepEqual(target().roleSkillSources!.equipmentSkills[3], {baseId: 10441, rank: learned ? 1 : 0});
      assert(!target().roleSkillSources!.currentSkillIds.includes(10441));
      assert(!target().roleSkillSources!.selectedSkillIds.includes(10441));
      const sourceStates = [await query(0), await query(1)];
      const targetFields = originalFields(sourceStates[0], target()), attackerFields = originalFields(sourceStates[1], attacker());
      const raw = Math.round(Math.max(0, attackerFields.attackBase * attackerFields.attackPercent + attackerFields.attackBonus));
      const damage = expectedArmorDamage(raw, targetFields, 1); assert(damage > 0);
      const phase: Record<string, unknown> = {roomId, learned, sourceStates, targetFields, attackerFields, raw, normalFrontDamage: damage, shots: []};
      (evidence.phases as unknown[]).push(phase);
      async function aimAt(i: number, angle: () => number) {
        for (let n = 0; n < 300; n++) {
          const p = i === 0 ? target() : attacker();
          const difference = wrapped(angle() - p.yaw - p.aim);
          if (Math.abs(difference) < .025) {await input(i); return;}
          await input(i, 0, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.fail('Ordinary aim did not settle');
      }
      await aimAt(1, () => Math.atan2(target().x - attacker().x, target().z - attacker().z));
      let front = false;
      for (let n = 0; n < 300; n++) {
        assert(typeof target().bodyYaw === 'number');
        const difference = wrapped(Math.atan2(attacker().x - target().x, attacker().z - target().z) - target().bodyYaw!);
        if (Math.abs(difference) < .045) {front = true; break;}
        await input(0, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert(front); await input(0);
      await aimAt(0, () => Math.atan2(target().x - attacker().x, target().z - attacker().z));
      const targetBefore = structuredClone(target()), attackerBefore = structuredClone(attacker());
      const eventStarts = events.map(rows => rows.length);
      const lifeEvents = (i: number) => events[i].slice(eventStarts[i]).filter(row => row.event.roomId === roomId
        && ['hit', 'fire', 'destroy', 'respawn', 'playerHealed', 'itemUsed'].includes(row.event.type));
      async function hit() {
        await wait(() => attacker().reload?.remaining === 0);
        const hp = target().hp, starts = events.map(rows => rows.length);
        const hits = (i: number) => events[i].slice(starts[i]).filter(row => row.event.roomId === roomId
          && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId);
        const beforeHit = structuredClone(latest()!);
        await input(1, 0, 0, 0, true); await wait(() => hits(0).length > 0 && hits(1).length > 0); await input(1);
        assert.equal(hits(0).length, 1); assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
        const critical = hits(0)[0].event.shotPlayerResult?.critical; assert(typeof critical === 'boolean');
        const expectedDamage = damage * (critical ? 2 : 1), expectedHP = Math.max(0, (hp - expectedDamage) | 0);
        const angle = Math.abs(wrapped(Math.atan2(attacker().x - target().x, attacker().z - target().z) - target().bodyYaw!));
        assert(angle <= Math.PI / 4, 'Front prevents peer10221 BACK bonus');
        assert(Math.abs(hits(0)[0].event.value - expectedDamage) < 1e-8);
        await wait(() => target().hp === expectedHP);
        const after = structuredClone(latest()!);
        const pair = await dual(after);
        const result = {hpBefore: hp, expectedDamage, critical, expectedHP, angle, beforeHit, after, pair, hit: hits(0)[0]};
        (phase.shots as unknown[]).push(result); return result;
      }
      let lethal: Awaited<ReturnType<typeof hit>> | undefined;
      for (let shot = 0; shot < 20; shot++) {
        // Keep a non-final peer cartridge for the repeat hit inside the3s stage.
        if (learned && attacker().ammoMagazine!.remaining === 1) {
          await aimAt(1, () => Math.atan2(attacker().x - target().x, attacker().z - target().z));
          await wait(() => attacker().reload!.remaining === 0);
          const wasteStart = events[0].length;
          await input(1, 0, 0, 0, true); await wait(() => attacker().ammoMagazine!.remaining === 0); await input(1);
          await wait(() => attacker().reload!.remaining === 0 && attacker().ammoMagazine!.remaining === attacker().ammoMagazine!.capacity);
          assert.equal(events[0].slice(wasteStart).filter(row => row.event.type === 'hit' && row.event.targetId === created.playerId).length, 0);
          await aimAt(1, () => Math.atan2(target().x - attacker().x, target().z - attacker().z));
        }
        lethal = await hit(); if (lethal.expectedHP === 0) break;
      }
      assert(lethal && lethal.expectedHP === 0, 'Bounded natural hits must reach lethal HP');
      if (learned) {
        assert(target().alive); assert.equal(target().hp, 0); assert.equal(target().respawnAt, 0);
        assert.equal(target().deaths, targetBefore.deaths); assert.equal(attacker().kills, attackerBefore.kills);
        assert.equal(lifeEvents(0).filter(row => row.event.type === 'destroy').length, 0);
        const onset = lethal.after, onsetWall = lethal.pair[0].wallTime;
        const scoreAtOnset = attacker().score;
        assert(attacker().reload!.duration < 3);
        const repeat = await hit(); assert.equal(repeat.expectedHP, 0); assert(target().alive);
        assert.equal(target().deaths, targetBefore.deaths); assert.equal(attacker().kills, attackerBefore.kills);
        assert.equal(attacker().score, scoreAtOnset + map.hitScore);
        assert(latest()!.serverTime < onset.serverTime + 3000);
        const beforeMotion = structuredClone(target()), actionTick = latest()!.tick;
        const fireStarts = events.map(rows => rows.length);
        const fires = (i: number) => events[i].slice(fireStarts[i]).filter(row => row.event.roomId === roomId
          && row.event.type === 'fire' && row.event.playerId === created.playerId);
        await input(0, 1, .5, .5, true);
        await wait(() => fires(0).length > 0 && fires(1).length > 0 && latest()!.tick >= actionTick + 4);
        await input(0);
        assert.equal(fires(0).length, 1); assert.deepEqual(fires(0)[0].event, fires(1)[0].event);
        assert.equal(fires(0)[0].event.skillId, 2001);
        assert(target().alive && target().hp === 0);
        assert(Math.hypot(target().x - beforeMotion.x, target().z - beforeMotion.z) > 0);
        assert.notEqual(target().bodyYaw, beforeMotion.bodyYaw); assert.notEqual(target().aim, beforeMotion.aim);
        phase.pendingAction = {before: beforeMotion, after: structuredClone(target()), fire: fires(0)[0], dual: await dual(latest()!)};
        const preDeathScore = attacker().score;
        await wait(() => target().alive === false, 6000);
        const death = structuredClone(latest()!), deathFrame = frames[0].find(row => row.snapshot.roomId === roomId
          && row.snapshot.tick >= onset.tick && row.snapshot.players.find(p => p.id === created.playerId)?.alive === false)!;
        const timing = {simulationSeconds: (death.tick - onset.tick) * .05,
          serverMilliseconds: death.serverTime - onset.serverTime, wallMilliseconds: deathFrame.wallTime - onsetWall};
        assert(timing.serverMilliseconds >= 2900 && timing.serverMilliseconds <= 3200);
        assert(timing.simulationSeconds >= 2.9 && timing.simulationSeconds <= 3.2);
        assert(timing.wallMilliseconds >= 2800 && timing.wallMilliseconds <= 3500);
        for (const row of frames[0].filter(row => row.snapshot.roomId === roomId && row.snapshot.tick >= onset.tick
          && row.snapshot.serverTime < onset.serverTime + 2900)) {
          const p = row.snapshot.players.find(p => p.id === created.playerId)!; assert(p.alive && p.hp === 0);
          assert.equal(p.deaths, targetBefore.deaths);
        }
        assert.equal(target().deaths, targetBefore.deaths + 1); assert.equal(attacker().kills, attackerBefore.kills + 1);
        assert.equal(attacker().score, preDeathScore + map.destroyScore);
        assert.equal(target().respawnAt, death.serverTime + map.respawnTime * 1000);
        phase.pending = {onset, repeat, timing, death, deathDual: await dual(death), preDeathScore};
      } else {
        await wait(() => !target().alive); assert.equal(target().deaths, targetBefore.deaths + 1);
        assert.equal(attacker().kills, attackerBefore.kills + 1);
        const immediate = structuredClone(latest()!);
        assert(immediate.serverTime - lethal.after.serverTime <= 100); phase.immediateDeath = await dual(immediate);
      }
      const dead = structuredClone(latest()!);
      await wait(() => target().alive === true, 10000);
      const restored = structuredClone(latest()!);
      assert.equal(target().hp, target().maxHp); assert.equal(target().respawnAt, 0);
      assert.equal(target().reload!.remaining, 0); assert.equal(target().reload!.startedAt, 0);
      assert.equal(target().ammoMagazine!.remaining, target().ammoMagazine!.capacity);
      assert.deepEqual(target().roleSkillSources, targetBefore.roleSkillSources);
      assert(restored.serverTime >= dead.players.find(p => p.id === created.playerId)!.respawnAt);
      phase.restored = restored; phase.restoredDual = await dual(restored);
      phase.respawnTimeBases = {simulationSeconds: (restored.tick - dead.tick) * .05,
        serverMilliseconds: restored.serverTime - dead.serverTime,
        wallMilliseconds: frames[0].find(row => key(row.snapshot) === key(restored))!.wallTime
          - frames[0].find(row => key(row.snapshot) === key(dead))!.wallTime};
      assert(restored.serverTime - dead.serverTime >= 2900 && restored.serverTime - dead.serverTime <= 3200);
      assert((restored.tick - dead.tick) * .05 >= 2.9 && (restored.tick - dead.tick) * .05 <= 3.2);
      const freshStarts = events.map(rows => rows.length), magazine = target().ammoMagazine!.remaining;
      const freshFires = (i: number) => events[i].slice(freshStarts[i]).filter(row => row.event.roomId === roomId
        && row.event.type === 'fire' && row.event.playerId === created.playerId);
      await input(0, 0, 0, 0, true); await wait(() => freshFires(0).length > 0 && freshFires(1).length > 0
        && target().ammoMagazine!.remaining === magazine - 1); await input(0);
      assert.deepEqual(freshFires(0)[0].event, freshFires(1)[0].event); assert.equal(target().ammoMagazine!.remaining, magazine - 1);
      phase.freshFire = freshFires(0)[0]; phase.freshFireDual = await dual(latest()!);
      await wait(() => lifeEvents(0).length === lifeEvents(1).length);
      assert.deepEqual(lifeEvents(0).map(row => row.event), lifeEvents(1).map(row => row.event));
      assert.equal(lifeEvents(0).filter(row => row.event.type === 'destroy' && row.event.targetId === created.playerId).length, 1);
      assert.equal(lifeEvents(0).filter(row => row.event.type === 'respawn' && row.event.playerId === created.playerId).length, 1);
      assert.equal(lifeEvents(0).filter(row => row.event.type === 'playerHealed' || row.event.type === 'itemUsed').length, 0);
      phase.lifeEvents = lifeEvents(0);
      const remote = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
      const common = new Set<string>();
      for (const row of frames[0].filter(row => row.snapshot.roomId === roomId)) {
        const peer = remote.get(key(row.snapshot)); if (peer) {assert.deepEqual(row.snapshot, peer); common.add(key(row.snapshot));}
      }
      assert(common.size > 50); phase.commonUniqueFullSnapshots = common.size;
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    }
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[1], before[1]); assert.deepEqual(final[0].inventory, before[0].inventory);
    const expectedFields = new Map(newPet.fields); expectedFields.set(0x68, 1);
    const expectedOwned = {...afterSelection[0].owned,
      base: afterSelection[0].owned.base.map(row => new Map(row.fields).get(0) === instanceId ? {...row, fields: [...expectedFields]} : row)};
    assert.deepEqual(final[0].owned, expectedOwned);
    const bytes = Uint8Array.from(before[0].equipment.profile.bytes), view = new DataView(bytes.buffer);
    view.setUint32(0x70, beforeView.getUint32(0x70, true) - 4500, true); view.setUint32(0xa4, instanceId, true); view.setUint32(0x80, 0, true);
    const profile = {bytes: [...bytes], strings: before[0].equipment.profile.strings};
    assert.deepEqual(final[0].equipment, {...before[0].equipment, profile});
    assert.deepEqual(final[0].learning.profile, profile); assert.deepEqual(final[0].learning.owned, expectedOwned);
    assert.equal(final[0].learning.points, 0);
    assert.deepEqual(final[0].learning, (evidence.afterLearning as {state: AccountState}).state.learning);
    for (const client of clients) await client.disconnect(); await stop(); assertNative(final);
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_ORDINARY_BUY_PET4_LEARN10441_ZERO_HP_THREE_SECOND_INPUT_FINAL_DEATH_RESPAWN_DUAL_STATE_NATIVE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    const saved = new DatabaseSync(database, {readOnly: true});
    try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
    writeFileSync(output + '-identity.private.json', JSON.stringify({accounts}), {mode: 0o600});
    evidence.frames = frames; evidence.events = events; evidence.checkpoint = output + '-checkpoint.sqlite';
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2)); writeFileSync(output + '-server.log', log);
    console.log(String(evidence.status) + ' ' + output + '.json');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
