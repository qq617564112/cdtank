import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
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
  const port = Number(process.env.SHOT_HURT_RESISTANCE_PORT);
  assert.equal(port, 3635);
  assert.equal(process.env.SHOT_HURT_RESISTANCE_RELEASE, '1', 'Requires coordinated compiled release');
  const acceptedSource = 'recovery/output/shot-critical-network-2026-10-05T23-00-28-616Z';
  const source = acceptedSource;
  const identitySource = source;
  const accounts = JSON.parse(readFileSync(identitySource + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-shot-hurt-resistance-'));
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
  const output = 'recovery/output/shot-hurt-resistance-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: true, preServicePoint: 200, earnedPointsProved: false,
      ownedRecordsInjected: false, newBUY: true, sourceIdentity: identitySource + '-identity.private.json'},
    simulationTickSeconds: .05,
    scope: 'Ordinary BUY105/Select, rank0 shot baseline, WAITING Ready LEARN11011/reset, rank1 same peer shot action resistance, two rooms/four Leave/native/sameDBrestart'};
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
      const purchase = JSON.parse(String(native.prepare('SELECT receipt FROM pet_purchases WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'hurt-resistance-buy105')!.receipt));
      assert.deepEqual(purchase, (evidence.purchase as ServiceType['api']['PetShop']['res']).purchased);
      const learning = JSON.parse(String(native.prepare('SELECT receipt FROM pet_skill_learning WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'hurt-resistance-learn11011')!.receipt));
      assert.deepEqual(learning, (evidence.learned as ServiceType['api']['PetSkillLearning']['res']).learned);
      evidence.nativeReceipts = {purchase, learning};
    } finally {native.close();}
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].equipment.slotCount, 2);
    assert.equal(before[0].equipment.slots[1], 0);
    assert.equal(before[0].learning.points, 200);
    evidence.sourceRetained = before;
    const purchase = await must<ServiceType['api']['PetShop']['res']>(clients[0].callApi('PetShop', {
      operation: 'BUY', petId: 105, currency: 'MONEY', requestId: 'hurt-resistance-buy105'}));
    evidence.purchase = purchase;
    assert(purchase.purchased);
    const purchasedFields = new Map(purchase.purchased.fields), instanceId = purchasedFields.get(0)!;
    assert.equal(purchasedFields.get(8), 105); assert.equal(purchasedFields.get(0x44), 11011);
    for (let slot = 0; slot < 6; slot++) assert.equal(purchasedFields.get(0x5c + slot * 4), 0);
    assert.equal(purchase.money, new DataView(Uint8Array.from(before[0].equipment.profile.bytes).buffer).getUint32(0x70, true) - 5000);
    evidence.selected = await must(clients[0].callApi('SelectRole', {kind: 'pet', instanceId}));
    const afterPurchase = [await query(0), await query(1)]; evidence.afterPurchase = afterPurchase;
    const sequences = [0, 0];
    for (const learnedPhase of [false, true]) {
      const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: '抗受击', name: 'HurtHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
      const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'HurtPeer', tankId: 3}));
      const roomId = created.room.id;
      const latest = (i = 0) => frames[i].at(-1)?.snapshot;
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
        && latest(i)?.players.length === 2));
      await wait(() => [0, 1].every(i => {
        const source = latest(i)?.players.find(p => p.id === created.playerId)?.roleSkillSources;
        return source !== undefined && !source.selectedSkillIds.includes(13161)
          && !source.selectedSkillIds.includes(11011);
      }));
      if (learnedPhase) {
        await must(clients[0].callApi('Ready', {round: 1}));
        await wait(() => [0, 1].every(i => latest(i)?.match?.readyPlayerIds.includes(created.playerId) === true));
        evidence.beforeLearning = {state: await query(0), snapshots: [latest(0), latest(1)]};
        const learned = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {
          operation: 'LEARN', instanceId, slot: 0, requestId: 'hurt-resistance-learn11011'}));
        evidence.learned = learned;
        assert.deepEqual(learned.learned, {instanceId, slot: 0, skillId: 11011, rank: 1, cost: 200});
        assert.equal(learned.points, 0);
        await wait(() => [0, 1].every(i => latest(i)?.phase === 'WAITING'
          && latest(i)?.match?.readyPlayerIds.includes(created.playerId) === false
          && latest(i)?.players.find(p => p.id === created.playerId)?.roleSkillSources?.selectedSkillIds.includes(11011) === true));
        evidence.afterLearning = {state: await query(0), snapshots: [latest(0), latest(1)]};
      }
      evidence.waiting = [latest(0), latest(1)];
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
      const player = (id: string) => latest()!.players.find(p => p.id === id)!;
      assert.equal(created.room.mode, 4); assert.notEqual(created.playerId, joined.playerId);
      assert.equal(created.room.mode <= 3 && player(created.playerId).team === player(joined.playerId).team, false);
      assert.equal(player(created.playerId).petId, 105);
      assert.equal(player(joined.playerId).ammoItemId, 2001);
      const sourceStates = [await query(0), await query(1)]; evidence.sourceStates = sourceStates;
      const targetFields = originalFields(sourceStates[0], player(created.playerId));
      const shooterFields = originalFields(sourceStates[1], player(joined.playerId));
      assert(!targetFields.selectedSkillIds.includes(13161));
      const targetQualification = (evidence.sourceQualification as {playerId: string; completed: boolean;
        roleFloats: [number, number][]}[]).filter(row => row.playerId === created.playerId).at(-1)!;
      assert.equal(targetQualification.completed, true);
      const sourceRate = new Map(targetQualification.roleFloats).get(0x90);
      assert.equal(sourceRate, learnedPhase ? 1 : 0);
      const sourceSkill = combatSkills.get(11011)!;
      assert.equal(sourceSkill.triggerType, 0); assert.equal(sourceSkill.attributes.StunRate, 100);
      assert(sourceSkill.functions.some(fn => fn.type === 1 && fn.t === 65535));
      const selected = new Map(sourceStates[0].owned.base.find(row => new Map(row.fields).get(0) === instanceId)!.fields);
      assert.equal(selected.get(0x44), 11011); assert.equal(selected.get(0x5c), learnedPhase ? 1 : 0);
      const originalRate = Math.fround(Math.min(100, learnedPhase ? 100 : 0) * Math.fround(.01));
      assert.equal(sourceRate, originalRate); assert.equal(targetFields.selectedSkillIds.includes(11011), learnedPhase);
      evidence.armorSource = {targetFields, shooterFields};
      const raw = Math.round(Math.max(0, shooterFields.attackBase * shooterFields.attackPercent + shooterFields.attackBonus));
      assert.equal(raw, 151);
      async function input(i: number, turn = 0, aim = 0, fire = false): Promise<void> {
        assert((await clients[i].sendMsg('PlayerInput', {sequence: ++sequences[i], move: 0, turn,
          aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);
      }
      const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
      const shooterQualification = (evidence.sourceQualification as {playerId: string; completed: boolean;
        roleFloats: [number, number][]}[]).find(row => row.playerId === joined.playerId)!;
      assert.equal(shooterQualification.completed, true);
      const criticalRate = new Map(shooterQualification.roleFloats).get(0x68)!;
      assert.equal(criticalRate, .19999998807907104);
      evidence.criticalSource = {criticalRate, multiplier: 2, ordinaryRaw: raw, criticalRaw: raw * 2,
        qualification: shooterQualification, sourceStates};
      const initialSources = [created.playerId, joined.playerId].map(id => structuredClone(player(id).roleSkillSources));
      for (let sample = 0; sample < 1; sample++) {
        await wait(() => latest()?.phase === 'PLAYING' && player(created.playerId).alive
          && typeof player(created.playerId).bodyYaw === 'number'
          && player(joined.playerId).alive && player(joined.playerId).reload?.remaining === 0, 30000);
        let aimed = false;
        for (let n = 0; n < 300; n++) {
          const attacker = player(joined.playerId), target = player(created.playerId);
          const desired = Math.atan2(target.x - attacker.x, target.z - attacker.z);
          const difference = wrapped(desired - attacker.yaw - attacker.aim);
          if (Math.abs(difference) < .025) {aimed = true; break;}
          await input(1, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert(aimed); await input(1);
        let oriented = false;
        for (let n = 0; n < 300; n++) {
          const target = player(created.playerId), attacker = player(joined.playerId);
          assert(typeof target.bodyYaw === 'number', 'Formal bodyYaw required');
          const difference = wrapped(Math.atan2(attacker.x - target.x, attacker.z - target.z) - target.bodyYaw);
          if (Math.abs(difference) < .045) {oriented = true; break;}
          await input(0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert(oriented); await input(0);
        const settledTick = latest()!.tick; await wait(() => latest()!.tick >= settledTick + 3);
        const beforeShot = structuredClone(latest()!), target = player(created.playerId), attacker = player(joined.playerId);
        assert(typeof target.bodyYaw === 'number');
        assert.deepEqual(target.roleSkillSources, initialSources[0]);
        assert.deepEqual(attacker.roleSkillSources, initialSources[1]);
        assert.equal(target.petId, 105); assert.equal(attacker.petId, 2);
        assert.equal(attacker.ammoItemId, 2001);
        const bearing = {x: attacker.x - target.x, z: attacker.z - target.z};
        const angle = Math.abs(wrapped(Math.atan2(bearing.x, bearing.z) - target.bodyYaw));
        assert(angle <= Math.PI / 4, 'Actual target body must face actual incoming attacker');
        const hpBefore = target.hp, magazineBefore = attacker.ammoMagazine!.remaining;
        const indices = events.map(rows => rows.length);
        const hits = (i: number) => events[i].slice(indices[i]).filter(row => row.event.roomId === roomId
          && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId);
        await input(1, 0, 0, true); await wait(() => hits(0).length > 0 && hits(1).length > 0); await input(1);
        assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
        assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
        const result = hits(0)[0].event.shotPlayerResult;
        assert.equal(result?.itemId, 2001);
        assert(typeof result?.critical === 'boolean', 'Same damage authority must publish its critical classification');
        const critical = result.critical;
        const expectedDamage = expectedArmorDamage(raw * (critical ? 2 : 1), targetFields, 1);
        const expectedHP = Math.max(0, (hpBefore - expectedDamage) | 0);
        assert(Math.abs(hits(0)[0].event.value - expectedDamage) < 1e-8);
        await wait(() => player(created.playerId).hp === expectedHP);
        assert.equal(player(joined.playerId).ammoMagazine!.remaining, magazineBefore - 1);
        for (const i of [0, 1]) assert.equal(events[i].slice(indices[i]).filter(row => row.event.type === 'playerHealed').length, 0);
        const afterTick = latest()!.tick; await wait(() => latest()!.tick >= afterTick + 3);
        assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
        if (learnedPhase) assert.equal(hits(0)[0].event.hurtSelector, undefined);
        else assert([1, 2, 3, 4].includes(hits(0)[0].event.hurtSelector!));
        assert(player(joined.playerId).score > beforeShot.players.find(p => p.id === joined.playerId)!.score);
        (evidence.phases as unknown[]).push({learnedPhase, sourceRate, targetQualification, sourceStates, sample, critical, criticalRate, raw, expectedDamage, hpBefore, expectedHP,
          bodyYaw: target.bodyYaw, bearing, angle, beforeShot, afterShot: latest(), hit: hits(0)[0]});
      }
      const peer = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
      const common = new Set<string>();
      for (const row of frames[0]) {
        if (row.snapshot.roomId !== roomId || row.snapshot.phase !== 'PLAYING') continue;
        const other = peer.get(key(row.snapshot)); if (other) {assert.deepEqual(row.snapshot, other); common.add(key(row.snapshot));}
      }
      assert(common.size > 4);
      const roomEvidence = (evidence.rooms ??= []) as unknown[];
      roomEvidence.push({roomId, learnedPhase, commonUniqueFullSnapshots: common.size,
        sourceStates, targetFields, shooterFields, targetQualification});
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    }
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[1], before[1]);
    assert.deepEqual(final[0].inventory, before[0].inventory);
    assert.deepEqual(final[0].owned.equipment, before[0].owned.equipment);
    for (const record of before[0].owned.base) assert.deepEqual(final[0].owned.base.find(row =>
      new Map(row.fields).get(0) === new Map(record.fields).get(0)), record);
    const savedPet = final[0].owned.base.find(row => new Map(row.fields).get(0) === instanceId)!;
    const expectedPetFields = new Map(purchase.purchased.fields); expectedPetFields.set(0x5c, 1);
    assert.deepEqual(savedPet, {...purchase.purchased, fields: [...expectedPetFields]});
    assert.equal(final[0].learning.points, 0);
    const expectedProfile = Uint8Array.from(before[0].equipment.profile.bytes), profileView = new DataView(expectedProfile.buffer);
    profileView.setUint32(0xa4, instanceId, true);
    profileView.setUint32(0x70, profileView.getUint32(0x70, true) - 5000, true);
    profileView.setUint32(0x80, 0, true);
    assert.deepEqual(final[0].equipment.profile, {bytes: [...expectedProfile], strings: before[0].equipment.profile.strings});
    for (const client of clients) await client.disconnect(); await stop();
    assertNative(final);
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_PURCHASED_PET105_LEARN11011_HURT_SELECTOR_RESISTANCE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE';
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
