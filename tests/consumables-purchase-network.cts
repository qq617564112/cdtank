import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {ReqShop, ResShop, ShopItem} from '../apps/shared/protocols/PtlShop';

const ids = [1, 2, 4, 6, 7, 8];
async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-consumables-purchase-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const accounts = [seed.open(), seed.open()];
  const evidence: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
  const pair = readOwnedRolePairMessage(new Uint8Array(evidence.rows[0].raw), evidence.rows[0].alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  const base = {name: 'Consumables acceptance pet', fields: new Map(pair.base.fields)};
  base.fields.set(0, 71001); base.fields.set(8, 1);
  for (let index = 0; index < 6; index++) {base.fields.set(0x44 + index * 4, 0); base.fields.set(0x5c + index * 4, 0);}
  const equipment = {name: 'Consumables acceptance tank', fields: new Map(pair.equipment.fields)};
  for (const [offset, value] of [[0x1c, 71002], [0x24, 1], [0x28, 0], [0x2c, 0], [0x30, 0],
    [0x58, 0], [0x5c, 0], [0x60, 0], [0x6c, 3]]) equipment.fields.set(offset, value);
  for (const [index, account] of accounts.entries()) {
    assert.deepEqual(seed.inventory(account.accountId).records, []);
    seed.replaceRoleRecords(account.accountId, {base: [base], equipment: [equipment]});
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setUint32(0xa4, 71001, true); view.setUint32(0xa8, 71002, true);
    view.setUint32(0x70, index === 0 ? 1000 : 9, true); view.setUint32(0x74, index === 0 ? 1000 : 9, true);
    seed.replaceRoleProfile(account.accountId, {bytes, strings: [account.accountId, 'Consumables acceptance pet']});
  }
  seed.close();
  const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
  const expectedItems: ShopItem[] = [1, 2, 3, 4, 5, 6, 7, 8, 2007, 2011].map(id => {
    const item = catalog.items.find(row => row.itemTableId === id)!;
    assert(item && item.iconId !== undefined && item.moneyPrice !== undefined && item.tokenPrice !== undefined);
    return {itemTableId: id, name: item.name, info: item.info, iconId: item.iconId,
      moneyPrice: item.moneyPrice, tokenPrice: item.tokenPrice};
  });
  assert.deepEqual(expectedItems.filter(item => ids.includes(item.itemTableId)).map(item => [item.itemTableId, item.moneyPrice, item.tokenPrice]),
    [[1, 10, 10], [2, 20, 20], [4, 20, 20], [6, 20, 20], [7, 20, 20], [8, 40, 20]]);
  let server: ChildProcess | undefined, log = '';
  const clients = accounts.map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3163', logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = accounts.map(() => undefined);
  const events: MsgRoomEvent[][] = accounts.map(() => []);
  const ticks = accounts.map(() => new Map<number, MsgRoomSnapshot>());
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index] = snapshot; ticks[index].set(snapshot.tick, snapshot);
      if (ticks[index].size > 200) ticks[index].delete(ticks[index].keys().next().value!);});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  async function wait(check: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; server log: ${log.slice(-1500)}`);
  }
  async function start(): Promise<void> {
    log = ''; snapshots.fill(undefined); ticks.forEach(stream => stream.clear());
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3163', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);}); server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started') || server!.exitCode !== null);
    assert(log.includes('Server started'), log);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve())); server.kill(); await ended;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [index, account] of accounts.entries()) assert((await clients[index].callApi('Account', {token: account.token})).isSucc);
  }
  async function state(index = 0) {
    const inventory = await clients[index].callApi('Inventory', {}), profile = await clients[index].callApi('RoleProfile', {});
    assert(inventory.isSucc && profile.isSucc); return {inventory: inventory.res, profile: profile.res};
  }
  async function reject(index: number, request: ReqShop): Promise<void> {
    const before = await state(index); assert(!(await clients[index].callApi('Shop', request)).isSucc);
    assert.deepEqual(await state(index), before, 'Rejected purchase preserves full profile, inventory and hotkeys');
  }
  const receipts: {request: ReqShop; response: ResShop}[] = [];
  try {
    await start();
    assert(!(await clients[0].callApi('Shop', {operation: 'QUERY'})).isSucc);
    await authenticate();
    const initial = await state(), observerBefore = await state(1);
    const query = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(query.isSucc);
    assert.deepEqual(query.res.items, expectedItems); assert.equal(query.res.money, 1000); assert.equal(query.res.tokens, 1000);
    const request: ReqShop = {operation: 'BUY', itemTableId: 2, quantity: 1, currency: 'MONEY', requestId: 'consumables-money-2'};
    for (const itemTableId of [9, 999999]) await reject(0, {...request, itemTableId});
    for (const currency of ['MONEY', 'TOKENS'] as const) {
      for (const itemTableId of ids) await reject(1, {...request, currency, itemTableId});
    }
    let money = 1000, tokens = 1000;
    const expectedProfile = structuredClone(initial.profile);
    assert(expectedProfile.profile);
    const profileBytes = Uint8Array.from(expectedProfile.profile.bytes);
    for (const currency of ['MONEY', 'TOKENS'] as const) {
      for (const item of expectedItems.filter(item => ids.includes(item.itemTableId))) {
        const purchaseRequest: ReqShop = {...request, itemTableId: item.itemTableId, currency,
          requestId: `consumables-${currency.toLowerCase()}-${item.itemTableId}`};
        const bought = await clients[0].callApi('Shop', purchaseRequest); assert(bought.isSucc && bought.res.purchased);
        if (currency === 'MONEY') money -= item.moneyPrice; else tokens -= item.tokenPrice;
        assert.deepEqual(bought.res.items, expectedItems); assert.equal(bought.res.money, money); assert.equal(bought.res.tokens, tokens);
        const record = bought.res.purchased;
        assert.deepEqual(record, {instanceId: receipts.length + 1, itemTableId: item.itemTableId, ownedQuantity: 1,
          battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0});
        receipts.push({request: purchaseRequest, response: bought.res});
        new DataView(profileBytes.buffer).setUint32(0x70, money, true); new DataView(profileBytes.buffer).setUint32(0x74, tokens, true);
        expectedProfile.profile.bytes = [...profileBytes];
        const acquired = await state(); assert.deepEqual(acquired.profile, expectedProfile);
        assert.deepEqual(acquired.inventory.records, receipts.map(receipt => receipt.response.purchased));
        const replay = await clients[0].callApi('Shop', purchaseRequest); assert(replay.isSucc && replay.res.replayed);
        assert.deepEqual(replay.res.purchased, record); assert.deepEqual(await state(), acquired);
        await reject(0, {...purchaseRequest, itemTableId: item.itemTableId === 1 ? 2 : 1});
        assert.deepEqual(await state(1), observerBefore);
      }
    }
    assert.equal(money, 870); assert.equal(tokens, 890);
    const room = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Purchased consumables', name: 'Owner', tankId: 1}); assert(room.isSucc);
    assert((await clients[1].callApi('Join', {roomId: room.res.room.id, clientId: 'consumables-observer', name: 'Observer', tankId: 1})).isSucc);
    await wait(() => snapshots.every(snapshot => snapshot?.phase === 'WAITING'));
    const slotEvidence: object[] = [];
    for (const receipt of receipts) {
      const record = receipt.response.purchased!;
      const assigned = await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId: record.instanceId, slot: 4}); assert(assigned.isSucc);
      const projected = await state();
      assert.deepEqual(projected.inventory.records, receipts.map(value => value.response.purchased));
      assert.deepEqual(projected.inventory.hotkeys, [0, 0, 0, record.instanceId, 0, 0, 0]);
      assert.deepEqual(assigned.res.hotkeys, projected.inventory.hotkeys);
      assert.deepEqual(projected.profile, expectedProfile); assert.deepEqual(await state(1), observerBefore);
      assert(snapshots.every(snapshot => snapshot?.phase === 'WAITING'));
      slotEvidence.push({itemTableId: record.itemTableId, currency: receipt.request.currency, inventory: projected.inventory});
    }
    const large = receipts.find(receipt => receipt.request.itemTableId === 2 && receipt.request.currency === 'MONEY')!;
    const instanceId = large.response.purchased!.instanceId;
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 4})).isSucc);
    for (let index = 0; index < 3; index++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(snapshot => snapshot?.phase === 'PLAYING'));
    const player = () => snapshots[0]?.players.find(value => value.id === room.res.playerId);
    console.log('Purchased large feed: waiting for natural CPU injury');
    await wait(() => player()?.alive === true && player()!.hp < player()!.maxHp, 120000);
    const injured = structuredClone(player()!);
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 100, move: 0, turn: 0, aim: 0, fire: false,
      useItem: 5, clientTime: Date.now()})).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemUsed' && event.playerId === room.res.playerId)));
    const received = events.map(stream => stream.find(event => event.type === 'itemUsed' && event.playerId === room.res.playerId)!);
    assert.deepEqual(received[0], received[1]);
    assert.equal(received[0].skillId, 2); assert.equal(received[0].playSkillEffect?.skillId, 2);
    assert.equal(received[0].playSkillEffect?.effectIndex, 0); assert.equal(received[0].playSkillEffect?.duration, 0);
    assert(Math.abs(received[0].value - Math.min(400, injured.maxHp - injured.hp)) < 1e-6);
    const castTick = snapshots[0]!.tick;
    await wait(() => [...ticks[0].keys()].some(tick => tick > castTick && ticks[1].has(tick)));
    const pairedTick = [...ticks[0].keys()].reverse().find(tick => tick > castTick && ticks[1].has(tick))!;
    assert.deepEqual(ticks[0].get(pairedTick)!.players, ticks[1].get(pairedTick)!.players);
    const consumed = await state();
    const consumedRecord = consumed.inventory.records.find(record => record.instanceId === instanceId)!;
    assert.equal(consumedRecord.ownedQuantity, 0); assert.equal(consumedRecord.battleQuantity, 0);
    for (const sequence of [100, 101]) {
      assert((await clients[0].sendMsg('PlayerInput', {sequence, move: 0, turn: 0, aim: 0, fire: false,
        useItem: 5, clientTime: Date.now()})).isSucc);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed' && event.playerId === room.res.playerId).length === 1));
    assert.deepEqual((await state()).inventory, consumed.inventory);
    const persisted = await state(), observerPersisted = await state(1);
    for (const record of persisted.inventory.records) record.battleQuantity = 0;
    await stop(); await start(); await authenticate();
    assert.deepEqual(await state(), persisted); assert.deepEqual(await state(1), observerPersisted);
    for (const receipt of receipts) {
      const replay = await clients[0].callApi('Shop', receipt.request); assert(replay.isSucc && replay.res.replayed);
      assert.deepEqual(replay.res.purchased, receipt.response.purchased);
      assert.equal(replay.res.money, 870); assert.equal(replay.res.tokens, 890);
      assert.deepEqual(await state(), persisted);
      await reject(0, {...receipt.request, itemTableId: receipt.request.itemTableId === 1 ? 2 : 1});
    }
    const restarted = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(restarted.isSucc);
    assert.deepEqual(restarted.res, {items: expectedItems, money: 870, tokens: 890});
    writeFileSync('recovery/output/consumables-purchase-network.json', JSON.stringify({status: 'PASS', port: 3163,
      scope: 'Actual isolated TSRPC/SQLite, two existing owned-role/profile accounts and empty inventories; source six-item query, both currencies, exact profile and stock, WAITING Kitbag World projection, natural CPU injury with purchased large feed, paired events/snapshots, finite stock, actual restart and twelve durable receipts.',
      initial, observerBefore, query: query.res, receipts, slotEvidence, injured, received, pairedTick,
      consumed: consumed.inventory, persisted, observerPersisted, unsupportedRejected: [9, 999999],
      shortageBothCurrencies: true, conflictingItemReplayRejected: true, restartAllReceiptsReplayed: true,
      exhaustedAndRepeatedInputNoConsumption: true, accountIsolation: true}, null, 2));
    console.log('PASS: six source consumables, twelve MONEY/TOKENS purchases, WAITING projections, natural400 healing, finite stock and restart ledger');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
