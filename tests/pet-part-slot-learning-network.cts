import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backup, DatabaseSync} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {roleEquipmentSlotCount} from '../apps/server/src/accounts/equipment/slot-count';
import {combatSkills} from '../apps/server/src/battle/catalog';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise; assert(result.isSucc, JSON.stringify(result)); return result.res;
}

async function main(): Promise<void> {
  const port = Number(process.env.PET_PART_SLOT_PORT);
  assert.equal(port, 3621, 'Use the coordinated slot-learning service window');
  assert.equal(process.env.PET_PART_SLOT_RELEASE, '1', 'Requires compiled release');
  const tail = process.env.PET_PART_SLOT_TAIL === '1';
  const source = tail ? 'recovery/output/pet-part-slot-learning-network-2026-10-05T21-14-00-858Z'
    : 'recovery/output/food-healing-purchased-network-2026-10-05T21-01-14-629Z';
  const first = tail ? JSON.parse(readFileSync(source + '.json', 'utf8')) as {
    purchase: {pet: ServiceType['api']['PetShop']['res']; part: ServiceType['api']['Shop']['res']};
    before: ServiceType['api']['Equipment']['res']; inventoryBeforeReject: ServiceType['api']['Inventory']['res'];
    slotReject: unknown;
  } : undefined;
  const accounts = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-part-slot-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  if (!tail) {
    const fixture = new DatabaseSync(database);
    try {
      const profile = fixture.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(accounts[0].accountId)!;
      const bytes = Uint8Array.from(profile.payload as Uint8Array);
      new DataView(bytes.buffer).setUint32(0x80, 200, true);
      fixture.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, accounts[0].accountId);
    } finally {fixture.close();}
  }
  const output = 'recovery/output/pet-part-slot-learning-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port,
    fixture: {source: source + '-checkpoint.sqlite', pointRaw: tail ? undefined : 200, earnedPointsProved: false,
      fundsInjected: false, ownedRecordsInjected: false},
    scope: 'Real BUYpet3/part14003, slot-limit rejection, LEARN10311, extra slot equip, WAITING ready/source refresh, dual snapshots/Leave, persistence restart.'};
  const clients = [0, 1].map(() => new WsClient<ServiceType>(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, i) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[i].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[i].push(event);});
  });
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), log.slice(-1000));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve)); server.kill(); await closed;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [i, client] of clients.entries()) {
      assert((await client.connect()).isSucc); await must(client.callApi('Account', {token: accounts[i].token}));
    }
  }
  const latest = (i = 0) => frames[i].at(-1)!.snapshot;
  try {
    await start(); await authenticate();
    const owned = await must<ServiceType['api']['OwnedRoles']['res']>(clients[0].callApi('OwnedRoles', {}));
    const tank = owned.equipment.find(row => new Map(row.fields).get(0x24) === 3)!;
    const tankFields = new Map(tank.fields);
    assert.equal(tankFields.get(0x6c), 2);
    assert.deepEqual([0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)), [0, 0, 0]);
    if (!tail) await must(clients[0].callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!}));
    const boughtPet = first?.purchase.pet ?? await must<ServiceType['api']['PetShop']['res']>(clients[0].callApi('PetShop', {
      operation: 'BUY', petId: 3, currency: 'MONEY', requestId: 'part_slot_pet3_first'}));
    const pet = boughtPet.purchased!, petFields = new Map(pet.fields), instanceId = petFields.get(0)!;
    assert.equal(petFields.get(8), 3);
    assert.equal(petFields.get(0x44), 10311);
    assert.equal(combatSkills.get(10311)!.attributes.PartSlot, 1);
    assert.deepEqual(Array.from({length: 6}, (_, i) => petFields.get(0x5c + i * 4)), [0, 0, 0, 0, 0, 0]);
    if (tail) assert.deepEqual(owned.base.find(row => new Map(row.fields).get(0) === instanceId), pet);
    else await must(clients[0].callApi('SelectRole', {kind: 'pet', instanceId}));
    const boughtPart = first?.purchase.part ?? await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {
      operation: 'BUY', itemTableId: 14003, quantity: 1, currency: 'MONEY', requestId: 'part_slot_14003_first'}));
    const part = boughtPart.purchased!;
    evidence.purchase = {pet: boughtPet, part: boughtPart};
    const before = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {operation: 'QUERY'}));
    evidence.before = before;
    const beforeRejectInventory = first?.inventoryBeforeReject ?? await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {}));
    const expectedCount = (rank: number) => roleEquipmentSlotCount({capacity: tankFields.get(0x6c)!,
      parts: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)}, {
      skillIds: Array.from({length: 6}, (_, i) => petFields.get(0x44 + i * 4)!),
      ranks: [rank, 0, 0, 0, 0, 0]}, id => {
      const skill = combatSkills.get(id); return skill ? {partSlots: skill.attributes.PartSlot} : undefined;
    });
    assert.equal(before.slotCount, expectedCount(0));
    assert.equal(before.slotCount, 2);
    const slot = before.slotCount;
    assert.equal(slot, 2);
    assert(slot >= 0 && slot < 5); assert.equal(expectedCount(1), slot + 1);
    if (first) {
      assert.deepEqual(before, first.before);
      evidence.firstActual = source + '.json'; evidence.slotRejectReused = first.slotReject;
      evidence.scope = 'Unreached LEARN10311/extra-slot EQUIP/dual source/Leave/native/restart tail; first real acquisition and rejection reused, no BUY or Point/fund edits.';
    } else {
      const rejected = await clients[0].callApi('Equipment', {operation: 'EQUIP', slot, instanceId: part.instanceId});
      assert(!rejected.isSucc);
      assert.deepEqual(await must(clients[0].callApi('Equipment', {operation: 'QUERY'})), before);
      assert.deepEqual(await must(clients[0].callApi('Inventory', {})), beforeRejectInventory);
      evidence.slotReject = rejected; evidence.inventoryBeforeReject = beforeRejectInventory;
    }
    const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mapId: 7, mode: 4, roomName: '技能扩槽', name: 'SlotLearner', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'Peer', tankId: 3}));
    evidence.room = {created, joined};
    await wait(() => frames.every(rows => {
      const snapshot = rows.at(-1)?.snapshot;
      return snapshot?.roomId === created.room.id && snapshot.phase === 'WAITING'
        && snapshot.players.some(row => row.id === created.playerId)
        && snapshot.players.some(row => row.id === joined.playerId);
    }));
    await must(clients[0].callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true));
    const learned = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {
      operation: 'LEARN', instanceId, slot: 0, requestId: 'part_slot_learn10311_first'}));
    assert.deepEqual(learned.learned, {instanceId, slot: 0, skillId: 10311, rank: 1, cost: 200});
    assert.equal(learned.points, 0);
    await wait(() => frames.every(rows => {
      const s = rows.at(-1)?.snapshot;
      return s?.phase === 'WAITING' && !s.match?.readyPlayerIds.includes(created.playerId)
        && s.players.find(row => row.id === created.playerId)?.roleSkillSources?.selectedSkillIds.includes(10311);
    }));
    const afterLearning = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {operation: 'QUERY'}));
    assert.equal(afterLearning.slotCount, slot + 1); assert.deepEqual(afterLearning.slots, before.slots);
    assert.equal(afterLearning.slotCount, 3);
    await must(clients[0].callApi('Ready', {round: 1}));
    await wait(() => latest().match?.readyPlayerIds.includes(created.playerId) === true);
    const equipped = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {
      operation: 'EQUIP', slot, instanceId: part.instanceId}));
    assert.equal(equipped.slotCount, slot + 1); assert.equal(equipped.slots[slot], part.instanceId);
    await wait(() => frames.every(rows => {
      const s = rows.at(-1)?.snapshot;
      const ids = s?.players.find(row => row.id === created.playerId)?.roleSkillSources?.selectedSkillIds;
      return s?.phase === 'WAITING' && !s.match?.readyPlayerIds.includes(created.playerId)
        && ids?.includes(10311) && ids.includes(13033);
    }));
    evidence.learned = learned; evidence.afterLearning = afterLearning; evidence.equipped = equipped;
    evidence.waitingAfterEquip = latest();
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const initialTick = latest().tick; await wait(() => latest().tick >= initialTick + 8);
    const byKey = new Map(frames[1].map(row => [[row.snapshot.roomId, row.snapshot.match?.round,
      row.snapshot.phase, row.snapshot.tick, row.snapshot.serverTime].join(':'), row.snapshot]));
    let common = 0;
    for (const row of frames[0]) {
      const s = row.snapshot, other = byKey.get([s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':'));
      if (!other || s.phase !== 'PLAYING') continue;
      assert.deepEqual(s, other); common++;
    }
    assert(common >= 6); evidence.commonFullSnapshots = common;
    assert.deepEqual(events[0], events[1]);
    evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {
      roomId: created.room.id, round: 1})));
    const final = {
      equipment: await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {operation: 'QUERY'})),
      learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {operation: 'QUERY'})),
      inventory: await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {}))};
    evidence.final = final;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM pet_skill_learning WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'part_slot_learn10311_first')!.receipt));
      assert.deepEqual(receipt, learned.learned);
      const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(accounts[0].accountId)!;
      const bytes = [...profile.payload as Uint8Array];
      assert.deepEqual({bytes, strings: JSON.parse(String(profile.strings))}, final.equipment.profile);
      const storedPet = JSON.parse(String(native.prepare('SELECT record FROM role_records WHERE account_id=? AND kind=? AND instance_id=?')
        .get(accounts[0].accountId, 'base', instanceId)!.record)) as {name: string; fields: [number, number][]};
      assert.deepEqual(storedPet, final.learning.owned.base.find(row => new Map(row.fields).get(0) === instanceId));
      assert.deepEqual(Array.from({length: 6}, (_, i) => new Map(storedPet.fields).get(0x5c + i * 4)), [1, 0, 0, 0, 0, 0]);
      const storedPart = JSON.parse(String(native.prepare('SELECT record FROM inventory WHERE account_id=? AND instance_id=?')
        .get(accounts[0].accountId, part.instanceId)!.record));
      assert.deepEqual(storedPart, final.inventory.records.find(row => row.instanceId === part.instanceId));
      evidence.native = {receipt, profile: final.equipment.profile, pet: storedPet, part: storedPart};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = {
      equipment: await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {operation: 'QUERY'})),
      learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[0].callApi('PetSkillLearning', {operation: 'QUERY'})),
      inventory: await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {}))};
    assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_LEARNED_PET_PART_SLOT_EQUIPMENT_GATE_SOURCE_DUAL_STATE_RESTART_SCOPE';
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
