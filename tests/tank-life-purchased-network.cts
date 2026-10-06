import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {recomputeQualifiedRoleLife} from '../apps/server/src/battle/roles/recompute-life';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-life-purchased-')), port = 3275;
  let log = '';
  const database = join(directory, 'accounts.sqlite');
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database,
      MATCH_TIME_LIMIT_SECONDS: '60'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
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
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 4, mapId: 7,
    scope: 'Fresh actual Account BUY tank3/pet2/2007, funds-only profile fixture, normal CPU natural damage/death/respawn, real ammo selection re-evaluation without healing and dual snapshots. No owned/inventory imports or live state injection.'};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    const accounts = [];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
    }
    const store = new AccountStore(database);
    try {
      const bytes = new Uint8Array(0x170); new DataView(bytes.buffer).setUint32(0x70, 100000, true);
      store.replaceRoleProfile(accounts[1].accountId, {bytes, strings: ['', '']});
    } finally {store.close();}
    evidence.fundsFixture = {money: 100000, offset: 0x70, otherBytes: 0, originalInitialValuesConfirmed: false};
    const tankBuy = await clients[1].callApi('TankShop', {operation: 'BUY', tankId: 3,
      currency: 'MONEY', requestId: 'life_tank3_buy'}); assert(tankBuy.isSucc);
    const petBuy = await clients[1].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'life_pet2_buy'}); assert(petBuy.isSucc);
    const ammoBuy = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 2007,
      quantity: 1, currency: 'MONEY', requestId: 'life_recompute_ammo_buy'}); assert(ammoBuy.isSucc);
    const tankFields = new Map(tankBuy.res.purchased!.fields), petFields = new Map(petBuy.res.purchased!.fields);
    assert((await clients[1].callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
    assert((await clients[1].callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
    assert((await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 1,
      instanceId: ammoBuy.res.purchased!.instanceId})).isSucc);
    evidence.purchases = {tank: tankBuy.res, pet: petBuy.res, ammo: ammoBuy.res};
    const expected = recomputeQualifiedRoleLife({ownedHp: petFields.get(0x2c),
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(o => tankFields.get(o)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      vip: 0, vipMultiplier: undefined})!; assert(expected); evidence.expected = expected;
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '生命资格',
      name: '普通玩家', tankId: 1, minPlayers: 2, maxPlayers: 4}); assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id, clientId: 'ignored',
      name: '自然受击', tankId: 1}); assert(guest.isSucc);
    const cpu = await clients[0].callApi('Cpu', {operation: 'ADD', round: 1, tankId: 154}); assert(cpu.isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames[0].some(row => row.snapshot.phase === 'PLAYING'));
    const initial = frames[0].find(row => row.snapshot.phase === 'PLAYING')!;
    evidence.initial = initial;
    const id = guest.res.playerId;
    const player = () => latest().players.find(player => player.id === id)!;
    const initialPlayer = initial.snapshot.players.find(player => player.id === id)!;
    assert.equal(initialPlayer.isVIP, false); assert.equal(initialPlayer.tankId, 3); assert.equal(initialPlayer.petId, 2);
    assert.equal(initialPlayer.maxHp, expected.maxHp); assert.equal(initialPlayer.hp, expected.maxHp);
    await wait(() => player().alive && player().hp > 0 && player().hp < expected.maxHp, 30000);
    evidence.injured = frames[0].at(-1); const injuredHp = player().hp;
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 2, clientTime: Date.now()})).isSucc);
    await wait(() => player().ammoItemId === 2007);
    assert(player().alive); assert(player().hp <= injuredHp); assert.equal(player().maxHp, expected.maxHp);
    evidence.afterSpecialRecompute = frames[0].at(-1); const beforeReturnHp = player().hp;
    assert((await clients[1].sendMsg('PlayerInput', {sequence: 2, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 1, clientTime: Date.now()})).isSucc);
    await wait(() => player().ammoItemId === 2001);
    assert(player().alive); assert(player().hp <= beforeReturnHp); assert.equal(player().maxHp, expected.maxHp);
    evidence.afterNormalRecompute = frames[0].at(-1);
    await wait(() => events[0].some(event => event.type === 'respawn' && event.playerId === id), 45000);
    const dead = frames[0].find(row => row.snapshot.players.some(player => player.id === id && !player.alive))!;
    assert(dead, 'Natural CPU damage must cause death');
    const restored = frames[0].find(row => row.snapshot.tick > dead.snapshot.tick &&
      row.snapshot.players.some(player => player.id === id && player.alive))!; assert(restored);
    const revived = restored.snapshot.players.find(player => player.id === id)!;
    assert.equal(revived.maxHp, expected.maxHp); assert.equal(revived.hp, expected.maxHp);
    evidence.respawn = {dead, restored, serverSeconds: (restored.snapshot.serverTime - dead.snapshot.serverTime) / 1000,
      simulationSeconds: (restored.snapshot.tick - dead.snapshot.tick) * .05,
      wallSeconds: (restored.wallTime - dead.wallTime) / 1000};
    const inventory = await clients[1].callApi('Inventory', {}); assert(inventory.isSucc);
    assert.equal(inventory.res.records.find(item => item.instanceId === ammoBuy.res.purchased!.instanceId)!.ownedQuantity, 1);
    evidence.unchangedAmmoInventory = inventory.res;
    const common = frames[0].filter(a => frames[1].some(b => b.snapshot.roomId === a.snapshot.roomId
      && b.snapshot.match?.round === a.snapshot.match?.round && b.snapshot.tick === a.snapshot.tick
      && b.snapshot.phase === a.snapshot.phase));
    assert(common.length > 100);
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.match?.round === a.snapshot.match?.round && b.snapshot.tick === a.snapshot.tick
        && b.snapshot.phase === a.snapshot.phase)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 1})).isSucc);
    evidence.status = 'PASS';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-life-purchased-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-life-purchased-network-${stamp}.log`, log);
  }
  console.log('PASS: actual purchased pet life, injured ammo recompute without healing, natural CPU death/respawn and dual synchronization');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
