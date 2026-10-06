import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {AccountStore} from '../apps/server/src/account-store';
import {readRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-part-armor-')), port = 3287;
  const database = join(directory, 'accounts.sqlite');
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '60'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: 2}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)?.snapshot;
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1400));
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 4, mapId: 7, phases: [], leaves: [],
    simulationTickSeconds: .05,
    scope: 'Actual BUY3/pet2/14001 and two defense drinks from empty ownership/inventory; passive Def10 installed/withdrawn across two short rooms and normal item input. Public defenseBoost base/boosted outputs compared by unified armor formula and dual snapshots; final mitigation remains reconstructed. No active state injection; prior drink/natural-hit/life evidence reused.',
    startingProfileFixture: {money: 100000, offset: 0x70, otherBytes: 0, strings: ['', ''], originalInitialValuesConfirmed: false}};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    const accounts = [];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
      const stock = await client.callApi('Inventory', {}); assert(stock.isSucc); assert.deepEqual(stock.res.records, []);
    }
    const store = new AccountStore(database);
    try {
      const bytes = new Uint8Array(0x170); new DataView(bytes.buffer).setUint32(0x70, 100000, true);
      store.replaceRoleProfile(accounts[0].accountId, {bytes, strings: ['', '']});
    } finally {store.close();}
    const tankBuy = await clients[0].callApi('TankShop', {operation: 'BUY', tankId: 3,
      currency: 'MONEY', requestId: 'part_armor_tank3_buy'}); evidence.tankPurchase = tankBuy;
    assert(tankBuy.isSucc, JSON.stringify(tankBuy));
    const fields = new Map(tankBuy.res.purchased!.fields); assert.equal(fields.get(0x6c), 2);
    assert((await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: fields.get(0x1c)!})).isSucc);
    const petBuy = await clients[0].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'part_armor_pet2_buy'}); assert(petBuy.isSucc);
    evidence.petPurchase = petBuy.res;
    const petFields = new Map(petBuy.res.purchased!.fields);
    assert((await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
    const pet = PET_BASES.find(pet => pet.id === petFields.get(8))!;
    const buy = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 14001,
      quantity: 1, currency: 'MONEY', requestId: 'part_armor_14001_buy'}); evidence.partPurchase = buy;
    assert(buy.isSucc, JSON.stringify(buy)); assert.equal(buy.res.money, 93500);
    const instanceId = buy.res.purchased!.instanceId;
    const drinks = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 5,
      quantity: 2, currency: 'MONEY', requestId: 'part_armor_drinks_buy'}); assert(drinks.isSucc);
    evidence.drinkPurchase = drinks.res;
    const drinkId = drinks.res.purchased!.instanceId;
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId: drinkId})).isSucc);
    let sequence = 0;
    for (const equipped of [true, false]) {
      const configured = await clients[0].callApi('Equipment', {operation: equipped ? 'EQUIP' : 'UNEQUIP',
        target: 'PART', slot: 0, ...(equipped ? {instanceId} : {})});
      assert(configured.isSucc, JSON.stringify(configured));
      assert.equal(configured.res.slots[0], equipped ? instanceId : 0);
      const inventory = await clients[0].callApi('Inventory', {}); assert(inventory.isSucc);
      const record = inventory.res.records.find(row => row.instanceId === instanceId)!;
      assert.equal(record.state, equipped ? 2 : 0); assert.equal(record.ownedQuantity, 1);
      const expectedArmor = (drink: boolean) => recomputeQualifiedRoleArmor({
        tank: TANKS.find(tank => tank.id === 3)!.recomputeBase, pet,
        ownedField34: fields.get(0x34), ownedAtk: fields.get(0x3c), ownedAtkBonus: fields.get(0x40),
        ownedDef: fields.get(0x4c), ownedDefBonus: fields.get(0x50),
        tankType: TANKS.find(tank => tank.id === 3)!.recomputeBase.tankType,
        sources: {currentSkillIds: [...combatItemSkills.get(2001)!.skillIds, ...(drink ? [5] : [])],
          extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => fields.get(offset)!)
            .concat([equipped ? 14001 : 0, 0, 0, 0, 0, 0, 0])},
        skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
      const base = expectedArmor(false), boosted = expectedArmor(true);
      assert(base && boosted); assert.equal(base.selectedSkillIds.includes(13031), equipped);
      const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
        roomName: equipped ? '装甲装配' : '装甲卸下', name: '普通购买', tankId: 1}); assert(host.isSucc);
      assert((await clients[1].callApi('Join', {roomId: host.res.room.id,
        clientId: 'ignored', name: '普通观察', tankId: 1})).isSucc);
      for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
      await wait(() => latest()?.roomId === host.res.room.id && latest()?.phase === 'PLAYING');
      const id = host.res.playerId;
      const player = () => latest()!.players.find(player => player.id === id)!;
      assert.equal(player().tankId, 3); assert.equal(player().petId, 2);
      const start = frames[0].at(-1)!;
      const hpBefore = player().hp;
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
        move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
      await wait(() => player().defenseBoost !== undefined);
      const shot = frames[0].at(-1)!;
      const active = player().defenseBoost!;
      assert.equal(active.source, 'original-attributes');
      assert.equal(active.baseDefense, base.defensePercent + base.defenseBonus);
      assert.equal(active.boostedDefense, Math.max(active.baseDefense, boosted.defensePercent + boosted.defenseBonus));
      assert(player().hp <= hpBefore, 'Attribute recomputation must not heal');
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
        move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      await wait(() => latest()!.tick >= shot.snapshot.tick + 4);
      const first = frames[0].filter(frame => frame.snapshot.roomId === host.res.room.id
        && frame.snapshot.phase === 'PLAYING');
      const common = first.filter(a => frames[1].some(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick));
      assert(common.length >= 4);
      for (const a of common) {
        const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
          && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick)!;
        assert.deepEqual(a.snapshot.players, b.snapshot.players);
      }
      const after = await clients[0].callApi('Inventory', {}); assert(after.isSucc);
      assert.equal(after.res.records.find(row => row.instanceId === drinkId)!.ownedQuantity, equipped ? 1 : 0);
      assert.equal(after.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 1);
      (evidence.phases as unknown[]).push({equipped, configuration: configured.res, inventory: inventory.res,
        expected: {base, boosted}, active, inventoryAfter: after.res, hpBefore, hpAfter: player().hp,
        start, shot, commonTicks: common.length,
        simulationSeconds: (shot.snapshot.tick - start.snapshot.tick) * .05,
        serverSeconds: (shot.snapshot.serverTime - start.snapshot.serverTime) / 1000,
        wallSeconds: (shot.wallTime - start.wallTime) / 1000});
      for (const [index, client] of clients.entries()) {
        const left = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
        (evidence.leaves as unknown[]).push({roomId: host.res.room.id, index, response: left}); assert(left.isSucc);
      }
    }
    const saved = new AccountStore(database);
    try {
      evidence.persistedSlots = readRoleProfileEquipment(saved.roleProfile(accounts[0].accountId)!);
      assert.deepEqual(evidence.persistedSlots, [0, 0, 0, 0, 0]);
      const stock = saved.inventory(accounts[0].accountId).records.find(row => row.instanceId === instanceId)!;
      assert.equal(stock.state, 0); assert.equal(stock.ownedQuantity, 1); evidence.persistedStock = stock;
      const drink = saved.inventory(accounts[0].accountId).records.find(row => row.instanceId === drinkId)!;
      assert.equal(drink.ownedQuantity, 0); evidence.persistedDrink = drink;
    } finally {saved.close();}
    const query = await clients[0].callApi('Equipment', {operation: 'QUERY'}); assert(query.isSucc);
    assert.deepEqual(query.res.slots, [0, 0, 0, 0, 0]); evidence.finalEquipment = query.res;
    evidence.status = 'PASS_PURCHASED_PART_ARMOR_CONSUMER';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-purchased-part-armor-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-purchased-part-armor-network-${stamp}.log`, log);
  }
  console.log('PASS: real 14001 installed/withdrawn Def10 through public original defense consumer, dual inputs and persisted stock/slots');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
