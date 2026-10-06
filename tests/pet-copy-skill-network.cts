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
  const copySkill = combatSkills.get(10711)!, foodSkill = combatSkills.get(10811)!;
  assert.equal(copySkill.triggerType, 4); assert.equal(copySkill.functions[0].type, 17);
  assert.equal(foodSkill.triggerType, 0); assert.equal(foodSkill.functions[0].type, 1);
  assert.equal(foodSkill.functions[0].t, 65535); assert.equal(foodSkill.attributes.HPRegainRate, 20);
  for (const [petId, price, skillId, cost] of [[102, 3500, 10711, 200], [103, 4000, 10811, 10]]) {
    const pet = combatCatalog.petTypes!.find(row => row.petId === petId)!;
    assert.equal(pet.petMoney, price); assert.equal(pet.baseIds![0], skillId);
    assert.equal(combatCatalog.petSkillPrices!.find(row => row.skillId === skillId)!.cost, cost);
  }
  if (process.argv.includes('--prepare')) {console.log('PREPARED_ORDINARY_PET102_COPY10811_FOOD200_240_CLEAR200_SCOPE'); return;}
  const port = Number(process.env.PET_COPY_SKILL_PORT);
  assert.equal(port, 3664); assert.equal(process.env.PET_COPY_SKILL_RELEASE, '1');
  const source = 'recovery/output/browser-old-bomb-2026-10-06T01-12-58-627Z';
  const accounts = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-copy-skill-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const retainedDatabase = new DatabaseSync(database, {readOnly: true});
  const retainedReceipts = ['pet_purchases', 'shop_purchases', 'pet_skill_learning'].map(table => ({table,
    rows: retainedDatabase.prepare(`SELECT * FROM ${table} ORDER BY account_id,request_id`).all()}));
  retainedDatabase.close();
  const fixtureDatabase = new DatabaseSync(database);
  try {
    for (const [i, points] of [200, 10].entries()) {
      const row = fixtureDatabase.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(accounts[i].accountId)!;
      const bytes = Uint8Array.from(row.payload as Uint8Array);
      new DataView(bytes.buffer).setUint32(0x80, points, true);
      fixtureDatabase.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, accounts[i].accountId);
    }
  } finally {fixtureDatabase.close();}
  const output = 'recovery/output/pet-copy-skill-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, retainedReceipts, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', sourceIdentity: source + '-checkpoint-fixture.json',
      fundsInjected: false, ownedRecordsInjected: false, pointsInjected: true,
      preServicePoints: [200, 10], earnedPointsProved: false}, simulationTickSeconds: .05,
    policy: {candidate: 10811, perLife: true, authorityRandom: true, activeConditionCopied: false},
    scope: 'Ordinary BUY102/103 and learning, food baseline200/copy240/after-death200, full dual/native sameDB restart'};
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
  function originalFields(account: AccountState, player: MsgRoomSnapshot['players'][number], copied = false): ArmorFields & {foodRate: number} {
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
        extraSkill: copied ? {baseId: 10811, rank: 1} : {baseId: 0, rank: 0},
        itemIds: [0x58, 0x5c, 0x60].map(offset => equipment.get(offset)!).concat(account.equipment.slots
          .map(id => id ? account.inventory.records.find(row => row.instanceId === id)!.itemTableId : 0), [0, 0])},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0};
    const full = recomputeRoleAttributes({...input, base: {name: '', fields: gear},
      equipment: {name: '', fields: equipment}, movementScales: ROLE_INITIAL_MOVEMENT_SCALES, vip: 0, vipMultiplier: 0},
      {setMovement() {}, notify() {}, clearDirty() {}});
    assert.equal(full.completed, true, 'Complete source must reach original attribute completion');
    assert.equal(full.state.recordFields.get(0x58), player.maxHp);
    assert.equal(full.state.roleFloats.get(0x8c), copied || player.petId === 103 ? Math.fround(Math.fround(20) * Math.fround(.01)) : 0);
    const sourceQualification = {playerId: player.id, completed: full.completed,
      recordFields: [...full.state.recordFields], roleIntegers: [...full.state.roleIntegers], roleFloats: [...full.state.roleFloats]};
    (evidence.sourceQualification as unknown[]).push(sourceQualification);
    const fields = recomputeQualifiedRoleArmor(input);
    assert(fields); assert.deepEqual(fields.selectedSkillIds, player.roleSkillSources!.selectedSkillIds);
    return {...fields, foodRate: full.state.roleFloats.get(0x8c)!};
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
        const hotkeys = Array(7).fill(0) as number[];
        for (const row of native.prepare('SELECT slot,instance_id FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId)) {
          hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
        }
        assert.deepEqual(hotkeys, final[ordinal].inventory.hotkeys);
        return {profile: data, inventory, owned, hotkeys};
      });
      const receipts = [
        {ordinal: 0, table: 'pet_purchases', requestId: 'copy-buy102', expected: (evidence.petPurchases as ServiceType['api']['PetShop']['res'][])[0].purchased},
        {ordinal: 1, table: 'pet_purchases', requestId: 'copy-buy103', expected: (evidence.petPurchases as ServiceType['api']['PetShop']['res'][])[1].purchased},
        {ordinal: 0, table: 'pet_skill_learning', requestId: 'copy-learn10711', expected: (evidence.hostLearned as ServiceType['api']['PetSkillLearning']['res']).learned},
        {ordinal: 1, table: 'pet_skill_learning', requestId: 'copy-learn10811', expected: (evidence.peerLearned as ServiceType['api']['PetSkillLearning']['res']).learned},
        {ordinal: 0, table: 'shop_purchases', requestId: 'copy-buyfood2', expected: (evidence.foodPurchase as ServiceType['api']['Shop']['res']).purchased}];
      evidence.nativeReceipts = receipts.map(row => {
        const value = JSON.parse(String(native.prepare(`SELECT receipt FROM ${row.table} WHERE account_id=? AND request_id=?`)
          .get(accounts[row.ordinal].accountId, row.requestId)!.receipt));
        assert.deepEqual(value, row.expected); return {requestId: row.requestId, receipt: value};
      });
      for (const retained of retainedReceipts) for (const row of retained.rows) {
        assert.deepEqual(native.prepare(`SELECT * FROM ${retained.table} WHERE account_id=? AND request_id=?`)
          .get(row.account_id, row.request_id), row);
      }
    } finally {native.close();}
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  const latest = (i = 0) => frames[i].at(-1)?.snapshot;
  const sequences = [0, 0];
  async function input(i: number, move = 0, turn = 0, aim = 0, fire = false, useItem = 0): Promise<void> {
    const message = {sequence: ++sequences[i], move, turn, aim, fire, useItem, clientTime: Date.now()};
    assert((await clients[i].sendMsg('PlayerInput', message)).isSucc);
    ((evidence.inputs ??= []) as unknown[]).push({ordinal: i, observedTick: latest()?.tick, message});
  }
  async function dual(snapshot: MsgRoomSnapshot) {
    await wait(() => frames[1].some(row => key(row.snapshot) === key(snapshot)));
    const pair = frames.map(rows => rows.find(row => key(row.snapshot) === key(snapshot))!);
    assert.deepEqual(pair[0].snapshot, pair[1].snapshot); return structuredClone(pair);
  }
  const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].learning.points, 200); assert.equal(before[1].learning.points, 10);
    assert.equal(before[0].equipment.slots[1], 0);
    const oldFood = before[0].inventory.records.find(row => row.instanceId === 5)!;
    assert.equal(oldFood.itemTableId, 1); assert.equal(oldFood.ownedQuantity, 1);
    assert.equal(before[0].inventory.hotkeys[3], 5);
    const petPurchases: ServiceType['api']['PetShop']['res'][] = [];
    evidence.petPurchases = petPurchases;
    const petInstances: number[] = [];
    for (const [i, petId] of [102, 103].entries()) {
      const purchase = await must<ServiceType['api']['PetShop']['res']>(clients[i].callApi('PetShop', {
        operation: 'BUY', petId, currency: 'MONEY', requestId: i === 0 ? 'copy-buy102' : 'copy-buy103'}));
      assert(purchase.purchased); petPurchases.push(purchase);
      const fields = new Map(purchase.purchased.fields), instanceId = fields.get(0)!;
      petInstances.push(instanceId); assert.equal(fields.get(8), petId);
      for (let slot = 0; slot < 6; slot++) assert.equal(fields.get(0x5c + slot * 4), 0);
      const money = new DataView(Uint8Array.from(before[i].equipment.profile.bytes).buffer).getUint32(0x70, true);
      assert.equal(purchase.money, money - (i === 0 ? 3500 : 4000));
      await must(clients[i].callApi('SelectRole', {kind: 'pet', instanceId}));
    }
    const foodPurchase = await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {
      operation: 'BUY', itemTableId: 1, quantity: 2, currency: 'MONEY', requestId: 'copy-buyfood2'}));
    assert(foodPurchase.purchased); assert.equal(foodPurchase.purchased.ownedQuantity, 2);
    assert.notEqual(foodPurchase.purchased.instanceId, oldFood.instanceId);
    assert(petPurchases[0].money !== undefined);
    assert.equal(foodPurchase.money, petPurchases[0].money - 20); evidence.foodPurchase = foodPurchase;
    const newFoodId = foodPurchase.purchased.instanceId;
    const afterPurchases = [await query(0), await query(1)]; evidence.afterPurchases = afterPurchases;
    for (let i = 0; i < 2; i++) {
      for (const record of before[i].owned.base) assert.deepEqual(afterPurchases[i].owned.base.find(row =>
        new Map(row.fields).get(0) === new Map(record.fields).get(0)), record);
      assert.deepEqual(afterPurchases[i].owned.equipment, before[i].owned.equipment);
    }
    const readyStates: AccountState[][] = [];
    for (const learned of [false, true]) {
      if (learned) {
        const assignment = await must<ServiceType['api']['Kitbag']['res']>(clients[0].callApi('Kitbag', {
          operation: 'ASSIGN', slot: 4, instanceId: newFoodId}));
        const expected = [...before[0].inventory.hotkeys]; expected[3] = newFoodId;
        assert.deepEqual(assignment.hotkeys, expected); evidence.foodAssignment = assignment;
      }
      const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: '被动模仿', name: 'CopyHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
      const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'CopyPeer', tankId: 3}));
      const roomId = created.room.id;
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
        && latest(i)?.players.length === 2));
      const ordinal = learned ? 0 : 1, skillId = learned ? 10711 : 10811;
      await must(clients[ordinal].callApi('Ready', {round: 1}));
      const readyId = ordinal === 0 ? created.playerId : joined.playerId;
      await wait(() => [0, 1].every(i => latest(i)?.match?.readyPlayerIds.includes(readyId) === true));
      const result = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[ordinal].callApi('PetSkillLearning', {
        operation: 'LEARN', instanceId: petInstances[ordinal], slot: 0,
        requestId: learned ? 'copy-learn10711' : 'copy-learn10811'}));
      assert.deepEqual(result.learned, {instanceId: petInstances[ordinal], slot: 0, skillId, rank: 1, cost: learned ? 200 : 10});
      assert.equal(result.points, 0); evidence[learned ? 'hostLearned' : 'peerLearned'] = result;
      await wait(() => [0, 1].every(i => latest(i)?.phase === 'WAITING' && latest(i)?.match?.readyPlayerIds.length === 0
        && latest(i)?.players.find(p => p.id === readyId)?.roleSkillSources?.equipmentSkills[0].rank === 1));
      const states = [await query(0), await query(1)]; readyStates.push(states);
      evidence[learned ? 'afterHostLearning' : 'afterPeerLearning'] = states;
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
      const ids = [created.playerId, joined.playerId];
      const player = (i: number) => latest()!.players.find(p => p.id === ids[i])!;
      assert.equal(player(0).petId, 102); assert.equal(player(1).petId, 103);
      assert.equal(created.room.mode <= 3 && player(0).team === player(1).team, false);
      assert.deepEqual(player(0).roleSkillSources!.equipmentSkills[0], {baseId: 10711, rank: learned ? 1 : 0});
      assert.deepEqual(player(1).roleSkillSources!.equipmentSkills[0], {baseId: 10811, rank: 1});
      for (let slot = 1; slot < 6; slot++) assert.equal(player(1).roleSkillSources!.equipmentSkills[slot].rank, 0);
      assert(!player(0).roleSkillSources!.selectedSkillIds.includes(10811));
      assert(player(1).roleSkillSources!.selectedSkillIds.includes(10811));
      const armor = [originalFields(states[0], player(0)), originalFields(states[1], player(1))];
      const raw = armor.map(fields => Math.round(Math.max(0, fields.attackBase * fields.attackPercent + fields.attackBonus)));
      const starts = events.map(rows => rows.length);
      const core = (i: number) => events[i].slice(starts[i]).filter(row => row.event.roomId === roomId);
      const phase: Record<string, unknown> = {roomId, learned, states, armor, raw, hits: [], foods: []};
      (evidence.phases as unknown[]).push(phase);
      async function orient(i: number, turnBody: boolean): Promise<void> {
        for (let n = 0; n < 300; n++) {
          const p = player(i), other = player(1 - i);
          const bearing = Math.atan2(other.x - p.x, other.z - p.z);
          const difference = wrapped(bearing - (turnBody ? p.bodyYaw! : p.yaw + p.aim));
          if (Math.abs(difference) < .025) {await input(i); return;}
          await input(i, 0, turnBody ? Math.sign(difference) : 0, turnBody ? 0 : Math.sign(difference));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.fail('Ordinary facing did not settle');
      }
      async function shot(i: number): Promise<void> {
        const targetOrdinal = 1 - i;
        assert(player(i).alive && player(targetOrdinal).alive);
        await orient(targetOrdinal, true); await orient(i, false);
        await wait(() => player(i).reload?.remaining === 0);
        const beforeShot = structuredClone(latest()!), hp = player(targetOrdinal).hp;
        const eventStarts = events.map(rows => rows.length);
        const hits = (j: number) => events[j].slice(eventStarts[j]).filter(row => row.event.roomId === roomId
          && row.event.type === 'hit' && row.event.playerId === ids[i] && row.event.targetId === ids[targetOrdinal]);
        await input(i, 0, 0, 0, true);
        try {await wait(() => hits(0).length > 0 && hits(1).length > 0);} finally {await input(i);}
        assert.equal(hits(0).length, 1); assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
        const critical = hits(0)[0].event.shotPlayerResult?.critical; assert(typeof critical === 'boolean');
        const victim = player(targetOrdinal), shooter = player(i);
        const angle = Math.abs(wrapped(Math.atan2(shooter.x - victim.x, shooter.z - victim.z) - victim.bodyYaw!));
        assert(angle <= Math.PI / 4);
        const damage = expectedArmorDamage(raw[i] * (critical ? 2 : 1), armor[targetOrdinal], 1);
        assert(Math.abs(hits(0)[0].event.value - damage) < 1e-8);
        const expectedHp = Math.max(0, (hp - damage) | 0);
        await wait(() => player(targetOrdinal).hp === expectedHp);
        const after = structuredClone(latest()!);
        (phase.hits as unknown[]).push({ordinal: i, critical, angle, damage, hpBefore: hp, expectedHp,
          before: beforeShot, after, dual: await dual(after), event: hits(0)[0]});
      }
      async function deficit(amount: number): Promise<void> {
        for (let n = 0; n < 12 && player(0).maxHp - player(0).hp < amount; n++) {
          await shot(1); assert(player(0).alive, 'Natural deficit preparation must preserve living host');
        }
        assert(player(0).maxHp - player(0).hp >= amount);
      }
      async function food(expected: number, instanceId: number, remainingBefore: number): Promise<void> {
        const beforeFood = structuredClone(latest()!), hp = player(0).hp;
        const snapshotQty = (await query(0)).inventory.records.find(row => row.instanceId === instanceId)!.ownedQuantity;
        assert.equal(snapshotQty, remainingBefore); assert.equal(player(0).maxHp - hp >= expected, true);
        const start = events.map(rows => rows.length);
        const used = (i: number) => events[i].slice(start[i]).filter(row => row.event.roomId === roomId
          && row.event.type === 'itemUsed' && row.event.playerId === ids[0] && row.event.skillId === 1);
        await input(0, 0, 0, 0, false, 5);
        try {await wait(() => used(0).length > 0 && used(1).length > 0);} finally {await input(0);}
        assert.equal(used(0).length, 1); assert.deepEqual(used(0)[0].event, used(1)[0].event);
        assert.equal(used(0)[0].event.value, expected); await wait(() => player(0).hp === hp + expected);
        const inventory = (await query(0)).inventory;
        assert.equal(inventory.records.find(row => row.instanceId === instanceId)!.ownedQuantity, remainingBefore - 1);
        const after = structuredClone(latest()!);
        (phase.foods as unknown[]).push({expected, instanceId, before: beforeFood, after, dual: await dual(after),
          event: used(0)[0], inventory});
      }
      await deficit(learned ? 240 : 200);
      if (!learned) {
        await food(Math.round(200 * (1 + armor[0].foodRate)), oldFood.instanceId, 1);
      } else {
        const hpBeforeCopy = player(0).hp;
        let killed = false;
        for (let n = 0; n < 20; n++) {await shot(0); if (!player(1).alive) {killed = true; break;}}
        assert(killed, 'Bounded ordinary hostile shots must kill victim');
        await wait(() => player(0).roleSkillSources?.selectedSkillIds.includes(10811) === true);
        assert.equal(player(0).hp, hpBeforeCopy, 'Copy must not refill current health');
        const copiedFields = originalFields(states[0], player(0), true);
        const copied = structuredClone(latest()!);
        const lethal = (phase.hits as {before: MsgRoomSnapshot; after: MsgRoomSnapshot}[]).at(-1)!;
        const magazineBefore = lethal.before.players.find(p => p.id === ids[0])!.ammoMagazine!;
        assert.equal(player(0).ammoMagazine!.remaining, magazineBefore.remaining - 1);
        assert.equal(player(0).ammoMagazine!.capacity, magazineBefore.capacity);
        phase.copied = {snapshot: copied, dual: await dual(copied), copiedFields};
        const destroy = core(0).filter(row => row.event.type === 'destroy' && row.event.targetId === ids[1]);
        assert.equal(destroy.length, 1); assert.equal(player(0).kills, 1);
        assert.equal(Math.round(200 * (1 + copiedFields.foodRate)), 240);
        await food(Math.round(200 * (1 + copiedFields.foodRate)), newFoodId, 2);
        const peerDead = copied.players.find(p => p.id === ids[1])!;
        await wait(() => player(1).alive, 10000);
        assert(latest()!.serverTime >= peerDead.respawnAt);
        const peerRespawn = structuredClone(latest()!); phase.peerRespawn = await dual(peerRespawn);
        let hostKilled = false;
        for (let n = 0; n < 20; n++) {await shot(1); if (!player(0).alive) {hostKilled = true; break;}}
        assert(hostKilled); await wait(() => !player(0).roleSkillSources?.selectedSkillIds.includes(10811));
        const dead = structuredClone(latest()!); phase.hostDeath = await dual(dead);
        const deadWall = frames[0].find(row => key(row.snapshot) === key(dead))!.wallTime;
        await wait(() => player(0).alive, 10000);
        const restored = structuredClone(latest()!);
        assert.equal(player(0).hp, player(0).maxHp); assert.equal(player(0).reload!.remaining, 0);
        assert.equal(player(0).ammoMagazine!.remaining, player(0).ammoMagazine!.capacity);
        assert(!player(0).roleSkillSources!.selectedSkillIds.includes(10811));
        const clearedFields = originalFields(states[0], player(0));
        const timing = {simulationSeconds: (restored.tick - dead.tick) * .05,
          serverMilliseconds: restored.serverTime - dead.serverTime,
          wallMilliseconds: frames[0].find(row => key(row.snapshot) === key(restored))!.wallTime - deadWall};
        assert(timing.serverMilliseconds >= 2900 && timing.serverMilliseconds <= 3250);
        assert(timing.simulationSeconds >= 2.9 && timing.simulationSeconds <= 3.25);
        phase.hostRespawn = {snapshot: restored, dual: await dual(restored), timing};
        await deficit(200); assert.equal(Math.round(200 * (1 + clearedFields.foodRate)), 200);
        await food(Math.round(200 * (1 + clearedFields.foodRate)), newFoodId, 1);
        assert.equal(core(0).filter(row => row.event.type === 'destroy' && row.event.targetId === ids[0]).length, 1);
      }
      await wait(() => core(0).length === core(1).length);
      assert.deepEqual(core(0).map(row => row.event), core(1).map(row => row.event));
      phase.sharedEventsBeforeLeave = structuredClone(core(0));
      const remote = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
      const common = new Set<string>();
      for (const row of frames[0].filter(row => row.snapshot.roomId === roomId)) {
        const peer = remote.get(key(row.snapshot)); if (peer) {assert.deepEqual(row.snapshot, peer); common.add(key(row.snapshot));}
      }
      assert(common.size > 50); phase.commonUniqueFullSnapshots = common.size;
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    }
    const final = [await query(0), await query(1)]; evidence.final = final;
    const hostLearnedStates = readyStates[1], peerLearnedStates = readyStates[0];
    for (let i = 0; i < 2; i++) {
      const expected = structuredClone(before[i].equipment.profile);
      const bytes = Uint8Array.from(expected.bytes), view = new DataView(bytes.buffer);
      view.setUint32(0x70, new DataView(Uint8Array.from(before[i].equipment.profile.bytes).buffer).getUint32(0x70, true)
        - (i === 0 ? 3520 : 4000), true);
      view.setUint32(0x80, 0, true); view.setUint32(0xa4, petInstances[i], true); expected.bytes = [...bytes];
      assert.deepEqual(final[i].equipment, {...before[i].equipment, profile: expected});
      const newPet = petPurchases[i].purchased!;
      const fields = new Map(newPet.fields); fields.set(0x5c, 1);
      const expectedOwned = {...before[i].owned, base: [...before[i].owned.base, {...newPet, fields: [...fields]}]};
      assert.deepEqual(final[i].owned, expectedOwned);
      assert.equal(final[i].learning.points, 0); assert.deepEqual(final[i].learning.profile, expected);
      assert.deepEqual(final[i].learning.owned, expectedOwned);
      assert.deepEqual(final[i].learning, (i === 0 ? hostLearnedStates[0] : peerLearnedStates[1]).learning);
    }
    const hotkeys = [...before[0].inventory.hotkeys]; hotkeys[3] = newFoodId;
    const expectedInventory = {hotkeys, records: before[0].inventory.records.map(row => row.instanceId === 5
      ? {...row, ownedQuantity: 0} : row).concat({...foodPurchase.purchased!, ownedQuantity: 0, battleQuantity: 0})};
    assert.deepEqual(final[0].inventory, expectedInventory); assert.deepEqual(final[1].inventory, before[1].inventory);
    for (const client of clients) await client.disconnect(); await stop(); assertNative(final);
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_ORDINARY_PET102_LEARN10711_HOSTILE_COPY10811_FOOD200_240_PER_LIFE_CLEAR200_DUAL_STATE_NATIVE_RESTART_SCOPE';
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
