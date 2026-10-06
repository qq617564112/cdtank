import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqPartMaintenance, ResPartMaintenance} from '../apps/shared/protocols/PtlPartMaintenance';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}
const fields = (record: OwnedRoleRecordData) => new Map(record.fields);
const projection = ({parts, inventory, profile, money, tokens}: ResPartMaintenance) => ({parts, inventory, profile, money, tokens});

async function main(): Promise<void> {
  const port = Number(process.env.PART_MAINTENANCE_PORT);
  assert.equal(port, 3611, 'Use the coordinated part maintenance window');
  const directedTail = process.env.PART_MAINTENANCE_DIRECTED_TAIL === '1';
  const firstRaw = 'recovery/output/part-maintenance-network-2026-10-05T20-02-50-293Z';
  const source = directedTail ? firstRaw : 'recovery/output/owned-role-sale-network-2026-10-05T19-48-41-515Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  assert.equal(identities.length, 2);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-part-maintenance-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/part-maintenance-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, directedTail, reusedFirstRaw: directedTail ? firstRaw + '.json' : undefined,
    fixture: {source: source + '-checkpoint.sqlite', newFundsInjected: false, ownedRecordsInjected: false,
      balancesOrigin: 'Reused legal checkpoint with declared historical pre-service funds; not earned.',
      purchaseInitialMinutes: 'Rebuilt BUY14003 raw1 minute; not original server initial duration.'},
    scope: 'BUY14003, six quotes, one-day money and coin maintenance, WAITING ready reset, replay preserves ready, rejections, dual players, Leave and same-database restart.'};
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
  async function maintain(index: number, request: ReqPartMaintenance): Promise<ResPartMaintenance> {
    const result = await clients[index].callApi('PartMaintenance', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(result.isSucc, JSON.stringify(result)); return result.res;
  }
  async function rejected(index: number, request: ReqPartMaintenance, message: string): Promise<void> {
    const before = projection(await maintain(index, {operation: 'QUERY'}));
    const result = await clients[index].callApi('PartMaintenance', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(!result.isSucc, 'Expected maintenance rejection');
    assert(result.err.message.includes(message), JSON.stringify(result));
    assert.deepEqual(projection(await maintain(index, {operation: 'QUERY'})), before);
  }
  try {
    await start(); await authenticate();
    const before = await maintain(0, {operation: 'QUERY'}); evidence.before = before;
    let instanceId: number;
    if (directedTail) {
      const first = JSON.parse(readFileSync(firstRaw + '.json', 'utf8'));
      assert.deepEqual(projection(before), projection(first.moneyMaintenance));
      instanceId = first.acquisition.bought.purchased.instanceId;
      evidence.reusedMoneyMaintenance = first.moneyMaintenance.maintained;
    } else {
    const bought = await must(clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 14003,
      quantity: 1, currency: 'MONEY', requestId: 'part_maintenance_first_buy14003'}));
    assert(bought.purchased); instanceId = bought.purchased.instanceId;
    assert.equal(bought.purchased.ownedQuantity, 1);
    const acquired = await maintain(0, {operation: 'QUERY'});
    const part = acquired.parts.find(row => row.instanceId === instanceId)!;
    assert(part?.canMaintain); assert.equal(part.remainingMinutes, 1);
    assert.deepEqual(part.quotes, [
      {currency: 0, days: 1, cost: 40, displayCost: '4'},
      {currency: 0, days: 7, cost: 200, displayCost: '20'},
      {currency: 0, days: 30, cost: 400, displayCost: '40'},
      {currency: 1, days: 1, cost: 20000, displayCost: '20000'},
      {currency: 1, days: 7, cost: 100000, displayCost: '100000'},
      {currency: 1, days: 30, cost: 200000, displayCost: '200000'}]);
    evidence.acquisition = {bought, acquired};
    }
    const owned = [];
    for (const [index, client] of clients.entries()) {
      const roles = await must(client.callApi('OwnedRoles', {})); owned.push(roles);
      await must(client.callApi('SelectRole', {kind: 'pet', instanceId: fields(roles.base[0]).get(0)!}));
      await must(client.callApi('SelectRole', {kind: 'tank', instanceId: fields(roles.equipment[0]).get(0x1c)!}));
    }
    const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '部件分钟维修',
      name: 'Maintainer', tankId: fields(owned[0].equipment[0]).get(0x24)!, minPlayers: 2, maxPlayers: 2}));
    const joined = await must(clients[1].callApi('Join', {roomId: created.room.id, clientId: 'ignored',
      name: 'Peer', tankId: fields(owned[1].equipment[0]).get(0x24)!}));
    evidence.room = {created, joined};
    const ready = () => frames[0].at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true;
    const moneyReq = {operation: 'MAINTAIN', instanceId, days: 1, currency: 1,
      requestId: 'part_maintenance_first_money1'} as const;
    if (!directedTail) {
    await must(clients[0].callApi('Ready', {round: 1})); await wait(ready);
    const money = await maintain(0, moneyReq); await wait(() => !ready());
    assert.equal(money.maintained?.remainingMinutes, 1441);
    assert.equal(money.money, (evidence.acquisition as {acquired: ResPartMaintenance}).acquired.money! - 20000); assert.equal(money.tokens, (evidence.acquisition as {acquired: ResPartMaintenance}).acquired.tokens);
    assert.deepEqual(money.inventory.records, (evidence.acquisition as {acquired: ResPartMaintenance}).acquired.inventory.records.map(row => row.instanceId === instanceId
      ? {...row, ownedQuantity: 1441} : row));
    const changedMoney = (evidence.acquisition as {acquired: ResPartMaintenance}).acquired.profile!.bytes.slice();
    const moneyBytes = Uint8Array.from(changedMoney); new DataView(moneyBytes.buffer).setUint32(0x70, money.money!, true);
    assert.deepEqual(money.profile!.bytes, [...moneyBytes]); evidence.moneyMaintenance = money;
    await must(clients[0].callApi('Ready', {round: 1})); await wait(ready);
    const replay = await maintain(0, moneyReq); assert.equal(replay.replayed, true);
    assert.deepEqual(projection(replay), projection(money)); assert(ready());
    evidence.replayPreservesReady = true;
    await rejected(0, {...moneyReq, days: 7}, '不同维修');
    await rejected(0, {...moneyReq, instanceId: 0xffffffff, requestId: 'part_maintenance_missing'}, '不属于');
    await rejected(1, {...moneyReq, requestId: 'part_maintenance_foreign'}, '不属于');
    await rejected(0, {...moneyReq, days: 30, requestId: 'part_maintenance_insufficient'}, '余额不足');
    const coinReq = {...moneyReq, currency: 0, requestId: 'part_maintenance_first_coin1'} as const;
    const coin = await maintain(0, coinReq); await wait(() => !ready());
    assert.equal(coin.maintained?.remainingMinutes, 2881);
    assert.equal(coin.money, money.money); assert.equal(coin.tokens, money.tokens! - 40);
    assert.deepEqual(coin.inventory.records, money.inventory.records.map(row => row.instanceId === instanceId
      ? {...row, ownedQuantity: 2881} : row));
    const coinBytes = Uint8Array.from(money.profile!.bytes); new DataView(coinBytes.buffer).setUint32(0x74, coin.tokens!, true);
    assert.deepEqual(coin.profile!.bytes, [...coinBytes]); evidence.coinMaintenance = coin;
    assert.deepEqual(await must(clients[0].callApi('Inventory', {})), coin.inventory);
    assert.deepEqual((await must(clients[0].callApi('RoleProfile', {}))).profile, coin.profile);
    }
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    await rejected(0, {...moneyReq, requestId: 'part_maintenance_playing'}, '准备阶段');
    const firstTick = frames[0].at(-1)!.snapshot.tick;
    await wait(() => frames.every(rows => rows.at(-1)!.snapshot.tick >= firstTick + 5));
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const peers = new Map(frames[1].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
    const common = new Map(frames[0].filter(row => row.snapshot.phase === 'PLAYING' && peers.has(key(row.snapshot)))
      .map(row => [key(row.snapshot), row.snapshot]));
    assert(common.size >= 5);
    for (const [id, snapshot] of common) assert.deepEqual(snapshot.players, peers.get(id)!.players);
    evidence.commonKeys = [...common.keys()]; assert(!events.flat().some(row => row.type === 'fire'));
    evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
    const final = await maintain(0, {operation: 'QUERY'}), finalPeer = await maintain(1, {operation: 'QUERY'});
    evidence.final = final; evidence.finalPeer = finalPeer;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const receipts = native.prepare('SELECT request_id, instance_id, days, currency, receipt FROM part_maintenance WHERE account_id = ? ORDER BY request_id').all(identities[0].accountId);
      assert.equal(receipts.length, directedTail ? 1 : 2);
      const records = native.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(identities[0].accountId).map(row => JSON.parse(String(row.record)));
      assert.deepEqual(records, final.inventory.records);
      const saved = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(identities[0].accountId)!;
      const profile = {bytes: [...new Uint8Array(saved.payload as Uint8Array)], strings: JSON.parse(String(saved.strings))};
      assert.deepEqual(profile, final.profile); evidence.native = {receipts, records, profile};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = await maintain(0, {operation: 'QUERY'}), restoredPeer = await maintain(1, {operation: 'QUERY'});
    assert.deepEqual(restored, final); assert.deepEqual(restoredPeer, finalPeer);
    evidence.restored = {maintainer: restored, peer: restoredPeer}; evidence.actualSameDatabaseRestart = true;
    evidence.status = directedTail ? 'PASS_FINITE_PART_MAINTENANCE_FIRST_CHECKPOINT_DUAL_STATE_LEAVE_NATIVE_RESTART_TAIL_SCOPE'
      : 'PASS_FINITE_PART_MAINTENANCE_PURCHASE_MINUTES_READY_REPLAY_DUAL_STATE_LEAVE_RESTART_SCOPE';
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
