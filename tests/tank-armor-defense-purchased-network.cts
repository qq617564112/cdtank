import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';


async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-armor-defense-')), port = 3276;
  const database = join(directory, 'accounts.sqlite');
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database,
      MATCH_TIME_LIMIT_SECONDS: '45'}, stdio: ['ignore', 'pipe', 'pipe'],
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
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 3, mapId: 7,
    scope: 'Actual tank3/pet2/defense5 purchases, SelectRole, VIP ordinary item input and independent original armor consumer with natural CPU damage/dual snapshots. Only starting funds/profile imported; no owned-record imports or active state injection.',
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
      store.replaceRoleProfile(accounts[1].accountId, {bytes, strings: ['', '']});
    } finally {store.close();}
    const tankBuy = await clients[1].callApi('TankShop', {operation: 'BUY', tankId: 3,
      currency: 'MONEY', requestId: 'movement_tank3_buy'}); assert(tankBuy.isSucc);
    const petBuy = await clients[1].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'movement_pet2_buy'}); assert(petBuy.isSucc);
    const tankFields = new Map(tankBuy.res.purchased!.fields), petFields = new Map(petBuy.res.purchased!.fields);
    assert((await clients[1].callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
    assert((await clients[1].callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
    const owned = await clients[1].callApi('OwnedRoles', {}); assert(owned.isSucc);
    assert.deepEqual(owned.res, {base: [petBuy.res.purchased!], equipment: [tankBuy.res.purchased!]});
    evidence.purchases = {tank: tankBuy.res, pet: petBuy.res};
    const tank = TANKS.find(tank => tank.id === tankFields.get(0x24))!, pet = PET_BASES.find(pet => pet.id === petFields.get(8))!;
    const expected = recomputeQualifiedRoleArmor({tank: tank.recomputeBase, pet,
      ownedField34: tankFields.get(0x34), ownedAtk: tankFields.get(0x3c),
      ownedAtkBonus: tankFields.get(0x40), ownedDef: tankFields.get(0x4c), ownedDefBonus: tankFields.get(0x50), tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
    assert(expected); evidence.expected = expected;
    const paid = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 5,
      quantity: 1, currency: 'MONEY', requestId: 'armor_vip_defense_buy'}); assert(paid.isSucc);
    evidence.defensePurchase = paid.res;
    assert((await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 4,
      instanceId: paid.res.purchased!.instanceId})).isSucc);
    const host = await clients[0].callApi('CreateRoom', {mode: 3, mapId: 7, roomName: '攻防资格',
      name: '正常房主', tankId: 1, minPlayers: 4, maxPlayers: 5}); assert(host.isSucc);
    let id = '';
    for (const [index, client] of clients.entries()) {
      if (!index) continue;
      const joined = await client.callApi('Join', {roomId: host.res.room.id, clientId: 'ignored', name: '正常玩家', tankId: 1}); assert(joined.isSucc);
      if (index === 1) id = joined.res.playerId;
    }
    const cpu = await clients[0].callApi('Cpu', {operation: 'ADD', round: 1, tankId: 154}); assert(cpu.isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames[0].at(-1)?.snapshot.phase === 'PLAYING');
    assert(id);
    const player = () => latest().players.find(player => player.id === id)!;
    assert.equal(player().tankId, 3); assert.equal(player().petId, 2); assert.equal(player().isVIP, true);
    evidence.initial = latest();
    const baseDefense = expected.defensePercent + expected.defenseBonus;
    const hpBefore = player().hp;
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
    await wait(() => player().defenseBoost !== undefined);
    const boosted = recomputeQualifiedRoleArmor({tank: tank.recomputeBase, pet,
      ownedField34: tankFields.get(0x34), ownedAtk: tankFields.get(0x3c), ownedAtkBonus: tankFields.get(0x40),
      ownedDef: tankFields.get(0x4c), ownedDefBonus: tankFields.get(0x50), tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: [...combatItemSkills.get(2001)!.skillIds, 5],
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(o => tankFields.get(o)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
    const active = player().defenseBoost!;
    assert.equal(active.source, 'original-attributes');
    assert.equal(active.baseDefense, baseDefense);
    assert.equal(active.boostedDefense, Math.max(baseDefense, boosted.defensePercent + boosted.defenseBonus));
    assert(player().hp <= hpBefore, 'Defense recomputation must not heal');
    evidence.active = frames[0].at(-1); evidence.expectedBoosted = boosted;
    await wait(() => events[0].some(e => e.type === 'hit' && e.targetId === id && e.playerId === cpu.res.playerId), 25000);
    evidence.naturalHit = events[0].find(e => e.type === 'hit' && e.targetId === id && e.playerId === cpu.res.playerId);
    evidence.afterHit = frames[0].at(-1);
    const inventory = await clients[1].callApi('Inventory', {}); assert(inventory.isSucc);
    assert.equal(inventory.res.records.find(r => r.instanceId === paid.res.purchased!.instanceId)!.ownedQuantity, 0);
    evidence.inventoryAfter = inventory.res;
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING' && frames[1].some(b =>
      b.snapshot.roomId === a.snapshot.roomId && b.snapshot.phase === a.snapshot.phase
      && b.snapshot.tick === a.snapshot.tick));
    assert(common.length > 10);
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 1})).isSucc);
    evidence.status = 'PASS_PURCHASED_VIP_ARMOR_DEFENSE_CONSUMER';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-armor-defense-purchased-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-armor-defense-purchased-network-${stamp}.log`, log);
  }
  console.log('PASS: actual VIP tank3/pet2 defense item consumer uses independent armor values, natural hit and dual sync; mitigation remains rebuilt');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
