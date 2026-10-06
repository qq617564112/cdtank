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

function expectedArmorDamage(rawAttack: number, fields: ArmorFields): number {
  return rawAttack * 100 / (100 + Math.max(0, fields.defensePercent * 100 + fields.defenseBonus));
}

async function main(): Promise<void> {
  const port = Number(process.env.SHOT_LIFE_DRAIN_PORT);
  assert.equal(port, 3627);
  assert.equal(process.env.SHOT_LIFE_DRAIN_RELEASE, '1', 'Requires coordinated compiled release');
  const tail = process.env.SHOT_LIFE_DRAIN_TAIL === '1';
  const source = tail
    ? 'recovery/output/shot-life-drain-network-2026-10-05T22-13-08-632Z'
    : 'recovery/output/permanent-armor-network-2026-10-05T21-56-36-580Z';
  const first = tail ? JSON.parse(readFileSync(source + '.json', 'utf8')) as {
    purchase: ServiceType['api']['PetShop']['res']; learned: ServiceType['api']['PetSkillLearning']['res'];
    beforeLearning: unknown; afterLearning: unknown;
  } : undefined;
  const accounts = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-shot-life-drain-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  if (!tail) {
  const fixture = new DatabaseSync(database);
  try {
    const saved = fixture.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(accounts[0].accountId)!;
    const bytes = Uint8Array.from(saved.payload as Uint8Array);
    new DataView(bytes.buffer).setUint32(0x80, 40, true);
    fixture.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, accounts[0].accountId);
  } finally {fixture.close();}
  }
  const output = 'recovery/output/shot-life-drain-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: !tail, pointRaw: tail ? undefined : 40, earnedPointsProved: false,
      ownedRecordsInjected: false, newBUY: !tail, originalFirst: tail ? source + '.json' : undefined}, simulationTickSeconds: .05,
    scope: 'BUY104/LEARN10911 with declared Point40 fixture; natural hostile shots, actual integer loss drain, dual complete snapshots/events, Leave/native/restart'};
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
  let server: ChildProcess | undefined, log = '', sequence = 0;
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
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].equipment.slots[2], tail ? 0 : 7);
    assert.equal(before[0].learning.points, tail ? 0 : 40);
    const sourceSkill = combatSkills.get(10911)!;
    assert.equal(sourceSkill.attributes.HPDrain, 10);
    assert.equal(sourceSkill.triggerType, 0);
    assert.equal(sourceSkill.functions[0].type, 1);
    assert.equal(sourceSkill.functions[0].t, 0xffff);
    if (!tail) await must(clients[0].callApi('Equipment', {operation: 'UNEQUIP', target: 'PART', slot: 2}));
    const purchase = first?.purchase ?? await must<ServiceType['api']['PetShop']['res']>(clients[0].callApi('PetShop', {
      operation: 'BUY', petId: 104, currency: 'MONEY', requestId: 'drain-buy-pet104'}));
    evidence.purchase = purchase;
    assert(purchase.purchased);
    const purchasedFields = new Map(purchase.purchased.fields), petInstanceId = purchasedFields.get(0)!;
    assert.equal(purchasedFields.get(8), 104);
    assert.equal(purchasedFields.get(0x44), 10911);
    if (!tail) assert.equal(purchase.money, new DataView(Uint8Array.from(before[0].equipment.profile.bytes).buffer).getUint32(0x70, true) - 4500);
    for (let slot = 0; slot < 6; slot++) assert.equal(purchasedFields.get(0x5c + slot * 4), 0);
    if (!tail) await must(clients[0].callApi('SelectRole', {kind: 'pet', instanceId: petInstanceId}));
    else {
      assert.equal(new DataView(Uint8Array.from(before[0].equipment.profile.bytes).buffer).getUint32(0xa4, true), petInstanceId);
      const learnedFields = new Map(before[0].owned.base.find(row => new Map(row.fields).get(0) === petInstanceId)!.fields);
      assert.equal(learnedFields.get(0x5c), 1);
    }
    const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mode: 4, mapId: 7, roomName: '生命吸收', name: 'DrainHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'DrainPeer', tankId: 3}));
    const roomId = created.room.id;
    const latest = (i = 0) => frames[i].at(-1)?.snapshot;
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
      && latest(i)?.players.length === 2));
    let learned = first?.learned;
    if (!tail) {
      await must(clients[0].callApi('Ready', {round: 1}));
      await wait(() => [0, 1].every(i => latest(i)?.match?.readyPlayerIds.includes(created.playerId) === true));
      evidence.beforeLearning = [await query(0), latest(0), latest(1)];
      learned = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {
        operation: 'LEARN', instanceId: petInstanceId, slot: 0, requestId: 'drain-learn-slot0'}));
      evidence.learned = learned;
      assert.deepEqual(learned.learned, {instanceId: petInstanceId, slot: 0, skillId: 10911, rank: 1, cost: 40});
      assert.equal(learned.points, 0);
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
        && !latest(i)?.match?.readyPlayerIds.includes(created.playerId)
        && latest(i)?.players.find(p => p.id === created.playerId)?.roleSkillSources?.selectedSkillIds.includes(10911)));
      evidence.afterLearning = [latest(0), latest(1)];
    } else {
      evidence.beforeLearning = first!.beforeLearning; evidence.afterLearning = first!.afterLearning;
      evidence.learned = learned;
    }
    assert(learned?.learned);
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
    const player = (id: string) => latest()!.players.find(p => p.id === id)!;
    assert.equal(created.room.mode, 4);
    assert.notEqual(created.playerId, joined.playerId);
    const friendly = created.room.mode <= 3 && player(created.playerId).team === player(joined.playerId).team;
    assert.equal(friendly, false, 'Free-for-all mode4 players are hostile even with neutral team0');
    assert.equal(player(created.playerId).ammoItemId, 2001);
    assert.equal(player(joined.playerId).ammoItemId, 2001);
    const states = [await query(0), await query(1)]; evidence.sourceStates = states;
    const armorFields = [originalFields(states[0], player(created.playerId)), originalFields(states[1], player(joined.playerId))];
    const selected = player(created.playerId).roleSkillSources!;
    assert.deepEqual(selected.equipmentSkills, Array.from({length: 6}, (_, slot) => ({
      baseId: purchasedFields.get(0x44 + slot * 4)!, rank: slot === 0 ? 1 : 0})));
    // Independent original +94 accumulation, DataScale4 and float32 conversion.
    let drainField = 0;
    for (const id of selected.selectedSkillIds) {
      const skill = combatSkills.get(id)!;
      const difference = (0 - skill.functions[0].z) | 0;
      const multiplier = skill.triggerType === 14 && difference > 0 ? difference : 1;
      drainField = Math.fround(drainField + Math.imul(skill.attributes.HPDrain, multiplier));
    }
    const limit = combatLimits.get(4)!;
    const rate = Math.fround(Math.max(limit.lower, Math.min(limit.upper, drainField)) * Math.fround(.01));
    assert.equal(drainField, 10); assert.equal(rate, Math.fround(10 * Math.fround(.01)));
    const qualification = (evidence.sourceQualification as {playerId: string; completed: boolean; roleFloats: [number, number][]}[])
      .find(row => row.playerId === created.playerId)!;
    assert.equal(qualification.completed, true); assert.equal(new Map(qualification.roleFloats).get(0x94), rate);
    evidence.drainSource = {selected, drainField, limit, rate, rank: 1, petInstanceId};
    async function input(i: number, aim = 0, fire = false): Promise<void> {
      assert((await clients[i].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
        aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);
    }
    async function singleHit(i: number, shooterId: string, targetId: string, drainRate?: number): Promise<void> {
      let aimed = false;
      for (let n = 0; n < 240; n++) {
        const a = player(shooterId), b = player(targetId), desired = Math.atan2(b.x - a.x, b.z - a.z);
        const difference = Math.atan2(Math.sin(desired - a.yaw - a.aim), Math.cos(desired - a.yaw - a.aim));
        if (Math.abs(difference) < .025) {aimed = true; break;}
        await input(i, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert(aimed); await input(i);
      const beforeShot = structuredClone(latest()!), shooterHP = player(shooterId).hp, targetHP = player(targetId).hp;
      const raw = Math.round(Math.max(0, armorFields[i].attackBase * armorFields[i].attackPercent + armorFields[i].attackBonus));
      const damage = expectedArmorDamage(raw, armorFields[1 - i]);
      const targetAfter = Math.max(0, (targetHP - damage) | 0), loss = targetHP - targetAfter;
      assert(targetAfter > 0);
      const requested = drainRate === undefined ? 0 : Math.round(Math.max(0, loss * drainRate));
      const expectedShooter = Math.min(player(shooterId).maxHp, shooterHP + requested);
      if (drainRate !== undefined) assert(expectedShooter > shooterHP);
      const indices = events.map(rows => rows.length);
      const hits = (j: number) => events[j].slice(indices[j]).filter(row => row.event.roomId === roomId
        && row.event.type === 'hit' && row.event.playerId === shooterId && row.event.targetId === targetId);
      const heals = (j: number) => events[j].slice(indices[j]).filter(row => row.event.roomId === roomId
        && row.event.type === 'playerHealed' && row.event.playerId === shooterId);
      await input(i, 0, true);
      await wait(() => hits(0).length > 0 && hits(1).length > 0); await input(i);
      await wait(() => player(targetId).hp === targetAfter && player(shooterId).hp === expectedShooter);
      const tick = latest()!.tick; await wait(() => latest()!.tick >= tick + 8);
      assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
      assert(Math.abs(hits(0)[0].event.value - damage) < 1e-8);
      assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
      assert.equal(heals(0).length, drainRate === undefined ? 0 : 1);
      assert.deepEqual(heals(0).map(row => row.event), heals(1).map(row => row.event));
      if (drainRate !== undefined) {
        assert.equal(heals(0)[0].event.value, expectedShooter - shooterHP);
        assert.equal(heals(0)[0].event.skillId, undefined);
      }
      (evidence.phases as unknown[]).push({shooterId, targetId, raw, damage, loss, drainRate, requested,
        targetAfter, expectedShooter, beforeShot, afterShot: latest(), hit: hits(0)[0], heals: heals(0)});
    }
    await singleHit(1, joined.playerId, created.playerId);
    await singleHit(0, created.playerId, joined.playerId, rate);
    const peer = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
    let common = 0;
    for (const row of frames[0]) {
      if (row.snapshot.roomId !== roomId || row.snapshot.phase !== 'PLAYING') continue;
      const other = peer.get(key(row.snapshot)); if (other) {assert.deepEqual(row.snapshot, other); common++;}
    }
    assert(common > 4); evidence.commonFullSnapshots = common;
    for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[1], before[1]);
    assert.equal(final[0].learning.points, 0);
    const finalPet = final[0].owned.base.find(row => new Map(row.fields).get(0) === petInstanceId)!;
    const expectedPet = new Map(purchasedFields); expectedPet.set(0x5c, 1);
    assert.deepEqual(finalPet, {name: purchase.purchased.name, fields: [...expectedPet]});
    assert.equal(new DataView(Uint8Array.from(final[0].equipment.profile.bytes).buffer).getUint32(0xa4, true), petInstanceId);
    for (const client of clients) await client.disconnect(); await stop();
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
        .get(accounts[0].accountId, 'drain-learn-slot0')!.receipt));
      assert.deepEqual(receipt, learned.learned); evidence.nativeLearningReceipt = receipt;
      const purchaseReceipt = JSON.parse(String(native.prepare('SELECT receipt FROM pet_purchases WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'drain-buy-pet104')!.receipt));
      assert.deepEqual(purchaseReceipt, purchase.purchased); evidence.nativePurchaseReceipt = purchaseReceipt;
    } finally {native.close();}
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_PURCHASED_PET104_LEARN10911_HOSTILE_SHOT_DRAIN_DUAL_STATE_NATIVE_RESTART_SCOPE';
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
