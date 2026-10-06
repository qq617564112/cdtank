import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {readRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-purchased-part-move-')), port = 3284;
  const database = join(directory, 'accounts.sqlite');
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database,
      MATCH_TIME_LIMIT_SECONDS: '60'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 3, mapId: 7, configurations: [],
    scope: 'Actual empty-account BUY tank3/pet2/engine16001, Equipment PART0, ordinary forward movement with and without purchased engine, dual synchronization and persisted inventory/slot state. Funds/profile-only fixture; purchase initialization and ownership boundary reconstructed. No active state injection; prior tank/pet acquisition and movement evidence reused.',
    startingProfileFixture: {bytes: 368, moneyOffset: 0x70, money: 100000,
      otherBytes: 0, strings: ['', ''], originalAccountInitialValuesConfirmed: false}};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    const accounts = [];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc);
      accounts.push(account.res);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
    }
    // Test funds establish purchase eligibility; all role ownership is produced by BUY.
    const store = new AccountStore(database);
    try {
      const bytes = new Uint8Array(0x170);
      new DataView(bytes.buffer).setUint32(0x70, 100000, true);
      store.replaceRoleProfile(accounts[2].accountId, {bytes, strings: ['', '']});
    } finally {store.close();}
    const tankBuy = await clients[2].callApi('TankShop', {operation: 'BUY', tankId: 3,
      currency: 'MONEY', requestId: 'part_movement_tank3_buy'});
    evidence.tankBuyResponse = tankBuy; assert(tankBuy.isSucc, JSON.stringify(tankBuy));
    const petBuy = await clients[2].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'part_movement_pet2_buy'}); assert(petBuy.isSucc);
    const tankFields = new Map(tankBuy.res.purchased!.fields), petFields = new Map(petBuy.res.purchased!.fields);
    assert.equal(tankFields.get(0x6c), 2, 'Explicit reconstructed source TankPartSlot purchase capacity');
    assert((await clients[2].callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
    assert((await clients[2].callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
    const owned = await clients[2].callApi('OwnedRoles', {}); assert(owned.isSucc);
    assert.deepEqual(owned.res, {base: [petBuy.res.purchased!], equipment: [tankBuy.res.purchased!]});
    evidence.purchases = {tank: tankBuy.res, pet: petBuy.res};
    const tank = TANKS.find(tank => tank.id === tankFields.get(0x24))!, pet = PET_BASES.find(pet => pet.id === petFields.get(8))!;
    const expected = recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
      ownedField34: tankFields.get(0x34), tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    assert(expected); evidence.expected = expected;
    const beforeInventory = await clients[2].callApi('Inventory', {}); assert(beforeInventory.isSucc);
    assert.deepEqual(beforeInventory.res.records, []);
    const beforeShop = await clients[2].callApi('Shop', {operation: 'QUERY'}); assert(beforeShop.isSucc);
    const partBuy = await clients[2].callApi('Shop', {operation: 'BUY', itemTableId: 16001,
      quantity: 1, currency: 'MONEY', requestId: 'part_movement_engine_buy'}); assert(partBuy.isSucc);
    assert.equal(beforeShop.res.money! - partBuy.res.money!, 500);
    assert.equal(partBuy.res.purchased!.itemTableId, 16001);
    assert.equal(partBuy.res.purchased!.ownedQuantity, 1);
    const instanceId = partBuy.res.purchased!.instanceId;
    evidence.partPurchase = partBuy.res;
    assert.equal(combatSkills.get(13061)!.attributes.ItemMove, 2);
    const boosted = recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
      ownedField34: tankFields.get(0x34), tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60]
          .map(offset => tankFields.get(offset)!).concat([16001, 0, 0, 0, 0, 0, 0])},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    assert(boosted); assert.equal(boosted.speed - expected.speed, 20);
    evidence.expected = {withoutPart: expected, withPart: boosted};
    let sequence = 0;
    const segments = [];
    for (const equipped of [true, false]) {
      const configured = await clients[2].callApi('Equipment', {operation: equipped ? 'EQUIP' : 'UNEQUIP',
        target: 'PART', slot: 0, ...(equipped ? {instanceId} : {})});
      (evidence.configurations as unknown[]).push({equipped, response: configured});
      assert(configured.isSucc, JSON.stringify(configured));
      assert.equal(configured.res.slots[0], equipped ? instanceId : 0);
      const inventory = await clients[2].callApi('Inventory', {}); assert(inventory.isSucc);
      const record = inventory.res.records.find(row => row.instanceId === instanceId)!;
      assert.equal(record.state, equipped ? 2 : 0); assert.equal(record.ownedQuantity, 1);
      const host = await clients[0].callApi('CreateRoom', {mode: 3, mapId: 7,
        roomName: equipped ? '引擎装配' : '引擎卸下', name: '普通观察', tankId: 1,
        minPlayers: 4, maxPlayers: 4}); assert(host.isSucc);
      let id = '';
      for (const [index, client] of clients.entries()) {
        if (!index) continue;
        const joined = await client.callApi('Join', {roomId: host.res.room.id,
          clientId: 'ignored', name: '普通购买', tankId: 1}); assert(joined.isSucc);
        if (index === 2) id = joined.res.playerId;
      }
      for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
      await wait(() => frames[0].at(-1)?.snapshot.roomId === host.res.room.id
        && latest().phase === 'PLAYING' && latest().players.some(player => player.id === id));
      const player = latest().players.find(player => player.id === id)!;
      assert.equal(player.tankId, 3); assert.equal(player.petId, 2); assert.equal(player.isVIP, false);
      const startTick = latest().tick;
      assert((await clients[2].sendMsg('PlayerInput', {sequence: ++sequence,
        move: 1, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      await wait(() => latest().tick >= startTick + 10);
      assert((await clients[2].sendMsg('PlayerInput', {sequence: ++sequence,
        move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      const samples = frames[0].filter(frame => frame.snapshot.roomId === host.res.room.id
        && frame.snapshot.phase === 'PLAYING' && frame.snapshot.tick > startTick + 1
        && frame.snapshot.tick <= startTick + 10);
      assert(samples.length >= 8);
      const values = samples.map(frame => ({...frame,
        player: frame.snapshot.players.find(player => player.id === id)!}));
      const first = values[0], last = values.at(-1)!;
      const seconds = (last.snapshot.tick - first.snapshot.tick) * .05;
      const distance = values.slice(1).reduce((sum, value, index) => sum
        + Math.hypot(value.player.x - values[index].player.x, value.player.z - values[index].player.z), 0);
      const predicted = equipped ? boosted : expected;
      assert(Math.abs(distance / seconds - predicted.speed) < .3, 'Purchased part actual movement consumer');
      assert.equal(last.player.aim, first.player.aim);
      const common = samples.filter(a => frames[2].some(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick));
      assert(common.length >= 8);
      for (const a of common) {
        const b = frames[2].find(b => b.snapshot.roomId === a.snapshot.roomId
          && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick)!;
        assert.deepEqual(a.snapshot.players, b.snapshot.players);
      }
      segments.push({equipped, configuration: configured.res, inventory: inventory.res,
        roomId: host.res.room.id, playerId: id, predicted, samples, commonTicks: common.length,
        distance, measuredSpeed: distance / seconds, simulationSeconds: seconds,
        serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
        wallSeconds: (last.wallTime - first.wallTime) / 1000});
      for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 1})).isSucc);
    }
    evidence.segments = segments;
    const persistedStore = new AccountStore(database);
    try {
      evidence.persistedSlots = readRoleProfileEquipment(persistedStore.roleProfile(accounts[2].accountId)!);
      assert.deepEqual(evidence.persistedSlots, [0, 0, 0, 0, 0]);
      evidence.persistedInventory = persistedStore.inventory(accounts[2].accountId);
      const saved = persistedStore.inventory(accounts[2].accountId).records.find(row => row.instanceId === instanceId)!;
      assert.equal(saved.ownedQuantity, 1); assert.equal(saved.state, 0);
    } finally {persistedStore.close();}
    const configuration = await clients[2].callApi('Equipment', {operation: 'QUERY'}); assert(configuration.isSucc);
    assert.equal(configuration.res.slots[0], 0); evidence.finalEquipment = configuration.res;
    evidence.status = 'PASS_PURCHASED_PART_MOVEMENT';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-purchased-part-movement-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-purchased-part-movement-network-${stamp}.log`, log);
  }
  console.log('PASS: purchased engine16001 EQUIP→speed+20→UNEQUIP→base speed; actual ownership/dual snapshots/save');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
