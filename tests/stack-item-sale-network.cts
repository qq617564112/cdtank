import {combatItems} from '../apps/server/src/battle/catalog';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqStackItemSale, ResStackItemSale} from '../apps/shared/protocols/PtlStackItemSale';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}
const fields = (record: OwnedRoleRecordData) => new Map(record.fields);
const projection = ({quotes, inventory, profile, money}: ResStackItemSale) => ({quotes, inventory, profile, money});

async function main(): Promise<void> {
  const port = Number(process.env.STACK_ITEM_SALE_PORT);
  assert.equal(port, 3616, 'Use the coordinated stack item sale window');
  const directedTail = process.env.STACK_ITEM_SALE_DIRECTED_TAIL === '1';
  const firstRaw = 'recovery/output/stack-item-sale-network-2026-10-05T20-28-18-889Z';
  const source = directedTail ? firstRaw : 'recovery/output/part-sale-network-2026-10-05T20-17-18-596Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  assert.equal(identities.length, 2);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-stack-sale-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/stack-item-sale-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, directedTail, reusedFirstRaw: directedTail ? firstRaw + '.json' : undefined,
    fixture: {source: source + '-checkpoint.sqlite', newFundsInjected: false, ownedRecordsInjected: false},
    scope: 'Normal BUY3003 necessary quantity, configured stack partial sale retains slot and projects battle count, full sale clears instance/slot, WAITING ready reset, dual players, Leave/native and same-database restart.'};
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  const calls: unknown[] = [];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), log.slice(-800));
  }
  async function start(): Promise<void> {
    const from = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(from).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve)); server.kill(); await closed;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      await must(client.callApi('Account', {token: identities[index].token}));
    }
  }
  async function sale(index: number, request: ReqStackItemSale): Promise<ResStackItemSale> {
    const result = await clients[index].callApi('StackItemSale', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(result.isSucc, JSON.stringify(result)); return result.res;
  }
  async function rejected(index: number, request: ReqStackItemSale, message: string): Promise<void> {
    const before = projection(await sale(index, {operation: 'QUERY'}));
    const result = await clients[index].callApi('StackItemSale', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(!result.isSucc, 'Expected sale rejection');
    assert(result.err.message.includes(message), JSON.stringify(result));
    assert.deepEqual(projection(await sale(index, {operation: 'QUERY'})), before);
  }
  try {
    await start(); await authenticate();
    const initial = await sale(0, {operation: 'QUERY'}); evidence.initial = initial;
    const originalInstance = initial.inventory.records.find(row => row.instanceId === 3)!;
    assert.equal(originalInstance.itemTableId, 3003); assert.equal(originalInstance.ownedQuantity, 1);
    assert.equal(initial.inventory.hotkeys[0], 3);
    let instanceId: number;
    if (directedTail) {
      const purchased = initial.inventory.records.find(row => row.instanceId === 4)!;
      assert.equal(purchased.itemTableId, 3003); assert.equal(purchased.ownedQuantity, 2);
      instanceId = purchased.instanceId; evidence.reusedPurchase = purchased;
    } else {
      const bought = await must(clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 3003, quantity: 2,
        currency: 'MONEY', requestId: 'stack_sale_first_buy3003_2'}));
      assert(bought.purchased); assert.equal(bought.purchased.ownedQuantity, 2);
      instanceId = bought.purchased.instanceId; evidence.purchase = bought;
    }
    evidence.configured = await must(clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId}));
    const owned = [];
    for (const [index, client] of clients.entries()) {
      const roles = await must(client.callApi('OwnedRoles', {})); owned.push(roles);
      await must(client.callApi('SelectRole', {kind: 'tank', instanceId: fields(roles.equipment[0]).get(0x1c)!}));
      await must(client.callApi('SelectRole', {kind: 'pet', instanceId: fields(roles.base[0]).get(0)!}));
    }
    const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '数量出售',
      name: 'Seller', tankId: fields(owned[0].equipment[0]).get(0x24)!, minPlayers: 2, maxPlayers: 2}));
    const joined = await must(clients[1].callApi('Join', {roomId: created.room.id, clientId: 'ignored',
      name: 'Peer', tankId: fields(owned[1].equipment[0]).get(0x24)!}));
    evidence.room = {created, joined};
    const before = await sale(0, {operation: 'QUERY'}), peer = await sale(1, {operation: 'QUERY'});
    const quote = before.quotes.find(row => row.instanceId === instanceId)!;
    assert.deepEqual(quote, {instanceId, itemTableId: 3003, ownedQuantity: 2, unitPrice: 5, canSell: true});
    assert(!peer.inventory.records.some(row => row.instanceId === instanceId));
    await rejected(1, {operation: 'SELL', instanceId, quantity: 1, requestId: 'stack_sale_foreign'}, '不属于');
    await rejected(0, {operation: 'SELL', instanceId, quantity: 3, requestId: 'stack_sale_excess'}, '超过拥有量');
    const ready = () => frames[0].at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true;
    await must(clients[0].callApi('Ready', {round: 1})); await wait(ready);
    const partialRequest = {operation: 'SELL', instanceId, quantity: 1, requestId: 'stack_sale_first_partial'} as const;
    const partial = await sale(0, partialRequest); await wait(() => !ready());
    assert.deepEqual(partial.sold, {instanceId, itemTableId: 3003, quantity: 1, price: 5, result: 2});
    assert.equal(partial.money, before.money! + 5);
    assert.deepEqual(partial.inventory.records, before.inventory.records.map(row => row.instanceId === instanceId
      ? {...row, ownedQuantity: 1, battleQuantity: Math.min(1, combatItems.get(3003)!.battleUseMax)} : row));
    assert.deepEqual(partial.inventory.hotkeys, before.inventory.hotkeys);
    const partialBytes = Uint8Array.from(before.profile!.bytes);
    new DataView(partialBytes.buffer).setUint32(0x70, partial.money!, true);
    assert.deepEqual(partial.profile, {bytes: [...partialBytes], strings: before.profile!.strings});
    evidence.partial = partial; evidence.partialReadyReset = true;
    await must(clients[0].callApi('Ready', {round: 1})); await wait(ready);
    const replay = await sale(0, partialRequest); assert.equal(replay.replayed, true);
    assert.deepEqual(projection(replay), projection(partial)); assert(ready()); evidence.replayPreservesReady = true;
    await rejected(0, {...partialRequest, quantity: 2}, '不同');
    const fullRequest = {operation: 'SELL', instanceId, quantity: 1, requestId: 'stack_sale_first_full'} as const;
    const full = await sale(0, fullRequest); await wait(() => !ready());
    assert.deepEqual(full.sold, {instanceId, itemTableId: 3003, quantity: 1, price: 5, result: 2});
    assert.equal(full.money, partial.money! + 5);
    assert.deepEqual(full.inventory.records, partial.inventory.records.filter(row => row.instanceId !== instanceId));
    assert.deepEqual(full.inventory.hotkeys, partial.inventory.hotkeys.map(id => id === instanceId ? 0 : id));
    const fullBytes = Uint8Array.from(partial.profile!.bytes);
    new DataView(fullBytes.buffer).setUint32(0x70, full.money!, true);
    assert.deepEqual(full.profile, {bytes: [...fullBytes], strings: partial.profile!.strings});
    evidence.full = full; evidence.fullReadyReset = true;
    const replayFull = await sale(0, fullRequest); assert.equal(replayFull.replayed, true);
    assert.deepEqual(projection(replayFull), projection(full)); evidence.replayFull = replayFull;
    await rejected(0, {...fullRequest, requestId: 'stack_sale_missing'}, '不属于');
    assert.deepEqual(await must(clients[0].callApi('Inventory', {})), full.inventory);
    assert.deepEqual((await must(clients[0].callApi('RoleProfile', {}))).profile, full.profile);
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    await rejected(0, {...fullRequest, requestId: 'stack_sale_playing'}, '准备阶段');
    const firstTick = frames[0].at(-1)!.snapshot.tick;
    await wait(() => frames.every(rows => rows.at(-1)!.snapshot.tick >= firstTick + 5));
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const peers = new Map(frames[1].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
    const common = new Map(frames[0].filter(row => row.snapshot.phase === 'PLAYING' && peers.has(key(row.snapshot)))
      .map(row => [key(row.snapshot), row.snapshot]));
    assert(common.size >= 5);
    for (const [id, snapshot] of common) assert.deepEqual(snapshot.players, peers.get(id)!.players);
    evidence.commonKeys = [...common.keys()]; assert(!events.flat().some(row => row.type === 'fire' || row.type === 'itemUsed'));
    evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
    const final = await sale(0, {operation: 'QUERY'}), finalPeer = await sale(1, {operation: 'QUERY'});
    evidence.final = final; evidence.finalPeer = finalPeer;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const receipts = native.prepare('SELECT request_id, instance_id, quantity, receipt FROM stack_item_sales WHERE account_id = ? ORDER BY request_id').all(identities[0].accountId);
      assert.equal(receipts.length, 2);
      const records = native.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(identities[0].accountId).map(row => JSON.parse(String(row.record)));
      assert.deepEqual(records, final.inventory.records);
      const saved = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(identities[0].accountId)!;
      const profile = {bytes: [...new Uint8Array(saved.payload as Uint8Array)], strings: JSON.parse(String(saved.strings))};
      assert.deepEqual(profile, final.profile);
      const nativeKeys = Array<number>(7).fill(0);
      for (const row of native.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id=?').all(identities[0].accountId)) {
        nativeKeys[Number(row.slot) - 1] = Number(row.instance_id);
      }
      assert.deepEqual(nativeKeys, final.inventory.hotkeys); evidence.native = {receipts, records, profile, hotkeys: nativeKeys};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = await sale(0, {operation: 'QUERY'}), restoredPeer = await sale(1, {operation: 'QUERY'});
    assert.deepEqual(restored, final); assert.deepEqual(restoredPeer, finalPeer);
    evidence.restored = {seller: restored, peer: restoredPeer}; evidence.actualSameDatabaseRestart = true;
    evidence.status = 'PASS_FINITE_STACK_PARTIAL_FULL_SALE_BATTLE_COUNT_HOTKEY_DUAL_STATE_LEAVE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    if (existsSync(database)) {
      const saved = new DatabaseSync(database, {readOnly: true});
      try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
      writeFileSync(output + '-identity.private.json', JSON.stringify({accounts: identities}) + '\n', {mode: 0o600});
      evidence.checkpoint = output + '-checkpoint.sqlite';
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; evidence.frames = frames; evidence.events = events; evidence.calls = calls;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
