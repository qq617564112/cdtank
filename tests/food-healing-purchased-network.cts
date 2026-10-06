import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

async function main(): Promise<void> {
  const port = Number(process.env.FOOD_HEALING_PORT);
  assert.equal(port, 3619);
  assert.equal(process.env.FOOD_HEALING_RELEASE, '1', 'Requires coordinated compiled release');
  const tail = process.env.FOOD_HEALING_TAIL === '1';
  const source = tail
    ? 'recovery/output/food-healing-purchased-network-2026-10-05T20-58-15-280Z'
    : 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-food-healing-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  if (!tail) {
    const fixture = new DatabaseSync(database);
    try {
      const row = fixture.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(identities[0].accountId)!;
      const payload = Uint8Array.from(row.payload as Uint8Array);
      new DataView(payload.buffer).setUint32(0x80, 10, true);
      fixture.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(payload, identities[0].accountId);
    } finally {fixture.close();}
  }
  const output = 'recovery/output/food-healing-purchased-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port,
    fixture: {source: source + '-checkpoint.sqlite', preServicePoint: tail ? undefined : 10,
      earnedPointsProved: false, fundsInjected: false, ownedRecordsInjected: false},
    scope: 'Real BUY103/LEARN10811/BUYfood1, natural hurt, qualified 240 healing and CAS stock, full dual snapshots/events, Leave and same DB restart.'};
  const clients = [0, 1].map(() => new WsClient<ServiceType>(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, i) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[i].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[i].push(event);});
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
      await must(client.callApi('Account', {token: identities[i].token}));
    }
  }
  const latest = (i = 0) => frames[i].at(-1)!.snapshot;
  try {
    if (tail) {
      const first = JSON.parse(readFileSync(source + '.json', 'utf8'));
      const restored = first.final as {inventory: ServiceType['api']['Inventory']['res'];
        learning: ServiceType['api']['PetSkillLearning']['res']};
      const petInstance = first.learned.learned.instanceId as number;
      const foodInstance = first.purchase.food.purchased.instanceId as number;
      const native = new DatabaseSync(database, {readOnly: true});
      try {
        const storedFood = JSON.parse(String(native.prepare('SELECT record FROM inventory WHERE account_id=? AND instance_id=?')
          .get(identities[0].accountId, foodInstance)!.record));
        const {battleQuantity: storedBattleQuantity, ...storedFields} = storedFood;
        const {battleQuantity: queriedBattleQuantity, ...queriedFields} = restored.inventory.records.find(row => row.instanceId === foodInstance)!;
        assert.equal(storedFood.ownedQuantity, 1); assert.equal(storedBattleQuantity, 0);
        assert.equal(queriedBattleQuantity, 1); assert.deepEqual(storedFields, queriedFields);
        const pet = JSON.parse(String(native.prepare('SELECT record FROM role_records WHERE account_id=? AND kind=? AND instance_id=?')
          .get(identities[0].accountId, 'base', petInstance)!.record)) as {name: string; fields: [number, number][]};
        assert.deepEqual(pet, restored.learning.owned.base.find(row => new Map(row.fields).get(0) === petInstance));
        const fields = new Map(pet.fields);
        assert.deepEqual(Array.from({length: 6}, (_, i) => fields.get(0x5c + i * 4)), [1, 0, 0, 0, 0, 0]);
        const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(identities[0].accountId)!;
        const bytes = Uint8Array.from(profile.payload as Uint8Array), view = new DataView(bytes.buffer);
        assert.equal(view.getUint32(0x80, true), 0); assert.equal(view.getUint32(0xa4, true), petInstance);
        assert.equal(view.getUint32(0xa8, true), new DataView(Uint8Array.from(first.final.learning.profile.bytes).buffer).getUint32(0xa8, true));
        assert.deepEqual({bytes: [...bytes], strings: JSON.parse(String(profile.strings))}, restored.learning.profile);
        const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM pet_skill_learning WHERE account_id=? AND request_id=?')
          .get(identities[0].accountId, 'food_passive_learn10811')!.receipt));
        assert.deepEqual(receipt, first.learned.learned);
        evidence.native = {food: storedFood, pet, profile: restored.learning.profile, learned: receipt};
      } finally {native.close();}
      await start(); await authenticate();
      const actualRestored = {
        inventory: await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {})),
        learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {operation: 'QUERY'}))};
      const persistedExpected = structuredClone(restored);
      const savedRecords = new DatabaseSync(database, {readOnly: true});
      try {
        const nativeRecords = savedRecords.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id')
          .all(identities[0].accountId).map(row => JSON.parse(String(row.record)));
        for (const record of persistedExpected.inventory.records) {
          const savedRecord = nativeRecords.find(row => row.instanceId === record.instanceId)!;
          const {battleQuantity: activeQuantity, ...activeFields} = record;
          const {battleQuantity: persistedQuantity, ...persistedFields} = savedRecord;
          assert.deepEqual(persistedFields, activeFields);
          record.battleQuantity = persistedQuantity;
        }
        assert.deepEqual(actualRestored.inventory.records, nativeRecords);
      } finally {savedRecords.close();}
      assert.deepEqual(actualRestored, persistedExpected);
      evidence.firstActiveToPersistedProjection = {firstActive: restored.inventory, persisted: actualRestored.inventory};
      evidence.restored = actualRestored; evidence.firstActual = source + '.json';
      for (const client of clients) await client.disconnect();
      await stop();
      await start(); await authenticate();
      const sameDatabaseRestart = {
        inventory: await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {})),
        learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {operation: 'QUERY'}))};
      assert.deepEqual(sameDatabaseRestart, actualRestored);
      evidence.sameDatabaseRestart = sameDatabaseRestart;
      evidence.scope = 'Unreached native projection verification and same actual checkpoint restart only; no BUY/LEARN/food use/funds or Point changes.';
      evidence.status = 'PASS_FINITE_PURCHASED_FOOD240_NATIVE_PROJECTION_RESTART_TAIL_SCOPE';
      return;
    }
    await start(); await authenticate();
    const owned = await must<ServiceType['api']['OwnedRoles']['res']>(clients[0].callApi('OwnedRoles', {}));
    const boughtPet = await must<ServiceType['api']['PetShop']['res']>(clients[0].callApi('PetShop', {
      operation: 'BUY', petId: 103, currency: 'MONEY', requestId: 'food_passive_buy103'}));
    const petFields = new Map(boughtPet.purchased!.fields), instanceId = petFields.get(0)!;
    assert.equal(petFields.get(8), 103); assert.equal(petFields.get(0x5c), 0);
    const learned = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {
      operation: 'LEARN', instanceId, slot: 0, requestId: 'food_passive_learn10811'}));
    assert.deepEqual(learned.learned, {instanceId, slot: 0, skillId: 10811, rank: 1, cost: 10});
    assert.equal(learned.points, 0);
    const tankInstance = new Map(owned.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields).get(0x1c)!;
    await must(clients[0].callApi('SelectRole', {kind: 'tank', instanceId: tankInstance}));
    await must(clients[0].callApi('SelectRole', {kind: 'pet', instanceId}));
    const boughtFood = await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {
      operation: 'BUY', itemTableId: 1, quantity: 2, currency: 'MONEY', requestId: 'food_passive_buy1'}));
    const food = boughtFood.purchased!;
    assert.equal(food.ownedQuantity, 2);
    await must(clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId: food.instanceId}));
    evidence.purchase = {pet: boughtPet, food: boughtFood}; evidence.learned = learned;
    const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mode: 4, mapId: 7, roomName: '饲料被动恢复', name: 'FoodPassive', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'NaturalShooter', tankId: 3}));
    evidence.room = {created, joined};
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const target = () => latest().players.find(row => row.id === created.playerId)!;
    const shooter = () => latest().players.find(row => row.id === joined.playerId)!;
    assert.equal(target().petId, 103); assert.equal(target().maxHp, 750);
    assert(target().roleSkillSources!.selectedSkillIds.includes(10811));
    evidence.initial = latest();
    let sequence = 0;
    async function shootInput(aim = 0, fire = false): Promise<void> {
      assert((await clients[1].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
        aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);
    }
    let aimed = false;
    for (let i = 0; i < 200; i++) {
      const a = shooter(), b = target();
      const desired = Math.atan2(b.x - a.x, b.z - a.z);
      const diff = Math.atan2(Math.sin(desired - a.yaw - a.aim), Math.cos(desired - a.yaw - a.aim));
      if (Math.abs(diff) < .025) {aimed = true; break;}
      await shootInput(Math.sign(diff)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await shootInput(0, true);
    await wait(() => target().alive && target().maxHp - target().hp >= 240, 60000);
    await shootInput();
    const settled = latest().tick; await wait(() => latest().tick >= settled + 12);
    assert(target().alive && target().maxHp - target().hp >= 240);
    const before = target().hp;
    evidence.beforeHeal = latest();
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
    await wait(() => events.every(rows => rows.some(row => row.type === 'itemUsed'
      && row.playerId === created.playerId && row.skillId === 1)) && target().hp === before + 240);
    const used = events[0].find(row => row.type === 'itemUsed' && row.playerId === created.playerId && row.skillId === 1)!;
    assert.equal(used.value, 240); evidence.used = used; evidence.afterHeal = latest();
    const final = {
      inventory: await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {})),
      learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {operation: 'QUERY'}))};
    assert.equal(final.inventory.records.find(row => row.instanceId === food.instanceId)!.ownedQuantity, 1);
    evidence.final = final;
    const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
    const peer = new Map(frames[1].map(row => [key(row.snapshot), row.snapshot]));
    let common = 0;
    for (const row of frames[0]) {
      const other = peer.get(key(row.snapshot));
      if (!other || row.snapshot.phase !== 'PLAYING') continue;
      assert.deepEqual(row.snapshot, other); common++;
    }
    assert(common > 10); evidence.commonFullSnapshots = common;
    assert.deepEqual(events[0], events[1]);
    evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {
      roomId: created.room.id, round: 1})));
    for (const client of clients) await client.disconnect();
    await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const inventory = native.prepare('SELECT record FROM inventory WHERE account_id=? AND instance_id=?')
        .get(identities[0].accountId, food.instanceId)!;
      const storedFood = JSON.parse(String(inventory.record));
      assert.equal(storedFood.ownedQuantity, 1);
      const rankReceipt = native.prepare('SELECT receipt FROM pet_skill_learning WHERE account_id=? AND request_id=?')
        .get(identities[0].accountId, 'food_passive_learn10811')!;
      assert.deepEqual(JSON.parse(String(rankReceipt.receipt)), learned.learned);
      const roleRow = native.prepare('SELECT record FROM role_records WHERE account_id=? AND kind=? AND instance_id=?')
        .get(identities[0].accountId, 'base', instanceId)!;
      const pet = JSON.parse(String(roleRow.record)) as {name: string; fields: [number, number][]};
      assert.deepEqual(pet, final.learning.owned.base.find(row => new Map(row.fields).get(0) === instanceId));
      const ranks = new Map(pet.fields);
      assert.deepEqual(Array.from({length: 6}, (_, i) => ranks.get(0x5c + i * 4)), [1, 0, 0, 0, 0, 0]);
      const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(identities[0].accountId)!;
      const bytes = Uint8Array.from(profile.payload as Uint8Array), view = new DataView(bytes.buffer);
      assert.equal(view.getUint32(0x80, true), 0);
      assert.equal(view.getUint32(0xa4, true), instanceId);
      assert.equal(view.getUint32(0xa8, true), tankInstance);
      assert.deepEqual({bytes: [...bytes], strings: JSON.parse(String(profile.strings))}, final.learning.profile);
      const {battleQuantity: persistedBattleQuantity, ...persistedFood} = storedFood;
      const {battleQuantity: projectedBattleQuantity, ...queriedFood} = final.inventory.records.find(row => row.instanceId === food.instanceId)!;
      assert.equal(persistedBattleQuantity, 0);
      assert.equal(projectedBattleQuantity, 1);
      assert.deepEqual(persistedFood, queriedFood);
      evidence.native = {food: storedFood, learned: JSON.parse(String(rankReceipt.receipt)), pet,
        profile: {bytes: [...bytes], strings: JSON.parse(String(profile.strings))}};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = {
      inventory: await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {})),
      learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {operation: 'QUERY'}))};
    assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_PURCHASED_PET103_LEARNED_FOOD240_DUAL_STATE_LEAVE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect();
    await stop();
    const saved = new DatabaseSync(database, {readOnly: true});
    try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
    writeFileSync(output + '-identity.private.json', JSON.stringify({accounts: identities}), {mode: 0o600});
    evidence.checkpoint = output + '-checkpoint.sqlite'; evidence.frames = frames; evidence.events = events;
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2));
    writeFileSync(output + '-server.log', log);
    console.log(String(evidence.status) + ' ' + output + '.json');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
