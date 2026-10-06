import {combatItemSkills} from '../apps/server/src/battle/catalog';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqPartSale, ResPartSale} from '../apps/shared/protocols/PtlPartSale';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}
const fields = (record: OwnedRoleRecordData) => new Map(record.fields);
const projection = ({quotes, inventory, profile, money}: ResPartSale) => ({quotes, inventory, profile, money});

async function main(): Promise<void> {
  const port = Number(process.env.PART_SALE_PORT);
  assert.equal(port, 3614, 'Use the coordinated part sale window');
  const directedTail = process.env.PART_SALE_DIRECTED_TAIL === '1';
  const firstRaw = 'recovery/output/part-sale-network-2026-10-05T20-15-58-663Z';
  const source = directedTail ? firstRaw : 'recovery/output/part-maintenance-network-2026-10-05T20-04-00-182Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  assert.equal(identities.length, 2);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-part-sale-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/part-sale-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, directedTail, reusedFirstRaw: directedTail ? firstRaw + '.json' : undefined,
    fixture: {source: source + '-checkpoint.sqlite', newFundsInjected: false, ownedRecordsInjected: false},
    scope: 'Reused normalBUY/maintenance14003/EQUIP, WAITING SELL whole equipped instance accepted, complete success1 receipt, qualified slot cleanup, passive source withdrawal, dual state, Leave/native and same-database restart.'};
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
  async function sale(index: number, request: ReqPartSale): Promise<ResPartSale> {
    const result = await clients[index].callApi('PartSale', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(result.isSucc, JSON.stringify(result)); return result.res;
  }
  async function rejected(index: number, request: ReqPartSale, message: string): Promise<void> {
    const before = projection(await sale(index, {operation: 'QUERY'}));
    const result = await clients[index].callApi('PartSale', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(!result.isSucc, 'Expected sale rejection');
    assert(result.err.message.includes(message), JSON.stringify(result));
    assert.deepEqual(projection(await sale(index, {operation: 'QUERY'})), before);
  }
  try {
    await start(); await authenticate();
    const initial = await sale(0, {operation: 'QUERY'}); evidence.initial = initial;
    if (directedTail) {
      const first = JSON.parse(readFileSync(firstRaw + '.json', 'utf8'));
      assert.deepEqual(initial.inventory.records, first.initial.inventory.records.map((row: {instanceId: number}) =>
        row.instanceId === 4 ? {...row, state: 2} : row));
      assert.equal(initial.money, first.initial.money);
      assert.deepEqual(initial.profile, first.equipped.profile);
    }
    const savedPart = initial.inventory.records.find(row => row.itemTableId === 14003)!;
    assert(savedPart); const instanceId = savedPart.instanceId;
    assert.equal(savedPart.ownedQuantity, 1441);
    evidence.reusedPart = savedPart;
    const owned = [];
    for (const [index, client] of clients.entries()) {
      const roles = await must(client.callApi('OwnedRoles', {})); owned.push(roles);
      await must(client.callApi('SelectRole', {kind: 'tank', instanceId: fields(roles.equipment[0]).get(0x1c)!}));
      await must(client.callApi('SelectRole', {kind: 'pet', instanceId: fields(roles.base[0]).get(0)!}));
    }
    const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '已装部件出售',
      name: 'Seller', tankId: fields(owned[0].equipment[0]).get(0x24)!, minPlayers: 2, maxPlayers: 2}));
    const joined = await must(clients[1].callApi('Join', {roomId: created.room.id, clientId: 'ignored',
      name: 'Peer', tankId: fields(owned[1].equipment[0]).get(0x24)!}));
    evidence.room = {created, joined};
    const equipped = await must(clients[0].callApi('Equipment', directedTail
      ? {operation: 'QUERY'} : {operation: 'EQUIP', target: 'PART', slot: 0, instanceId}));
    assert.equal(equipped.slots[0], instanceId); evidence.equipped = equipped;
    const skillIds = combatItemSkills.get(14003)!.skillIds.filter(id => id > 0);
    const player = () => frames[0].at(-1)?.snapshot.players.find(row => row.id === created.playerId);
    await wait(() => skillIds.every(id => player()?.roleSkillSources?.selectedSkillIds.includes(id)));
    evidence.sourceBefore = player()!.roleSkillSources;
    const before = await sale(0, {operation: 'QUERY'});
    const quote = before.quotes.find(row => row.instanceId === instanceId)!;
    assert.deepEqual(quote, {instanceId, itemTableId: 14003, price: 1000, canSell: true});
    const peer = await sale(1, {operation: 'QUERY'});
    if (!peer.inventory.records.some(row => row.instanceId === instanceId)) {
      await rejected(1, {operation: 'SELL', instanceId, requestId: 'part_sale_foreign'}, '不属于');
      evidence.foreignAbsentInstanceRejected = true;
    } else {
      evidence.foreignNamespaceCollision = 'Other account has its own same local ID; foreign ownership rejection is covered by root transaction fixtures.';
    }
    await must(clients[0].callApi('Ready', {round: 1}));
    await wait(() => frames[0].at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true);
    const request = {operation: 'SELL', instanceId, requestId: 'part_sale_first_equipped'} as const;
    const sold = await sale(0, request);
    assert.deepEqual(sold.sold, {instanceId, itemTableId: 14003, price: 1000, result: 1});
    assert.equal(sold.money, before.money! + 1000);
    assert.deepEqual(sold.inventory.records, before.inventory.records.filter(row => row.instanceId !== instanceId));
    const expected = Uint8Array.from(before.profile!.bytes), view = new DataView(expected.buffer);
    view.setUint32(0x70, sold.money!, true);
    for (const offset of [0x118, 0x13c, 0x140, 0x144, 0x148, 0x14c, 0x150, 0x154, 0x158]) {
      if (view.getUint32(offset, true) === instanceId) view.setUint32(offset, 0, true);
    }
    assert.deepEqual(sold.profile!.bytes, [...expected]); assert.deepEqual(sold.profile!.strings, before.profile!.strings);
    assert(!sold.inventory.hotkeys.includes(instanceId)); evidence.sold = sold;
    await wait(() => !frames[0].at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId)
      && skillIds.every(id => !player()?.roleSkillSources?.selectedSkillIds.includes(id)));
    evidence.sourceAfter = player()!.roleSkillSources; evidence.waitingReadyReset = true;
    const afterEquipment = await must(clients[0].callApi('Equipment', {operation: 'QUERY'}));
    assert.equal(afterEquipment.slots[0], 0); evidence.afterEquipment = afterEquipment;
    const replay = await sale(0, request); assert.equal(replay.replayed, true);
    assert.deepEqual(projection(replay), projection(sold)); evidence.replay = replay;
    await rejected(0, {...request, instanceId: 0xffffffff}, '不同实例');
    await rejected(0, {...request, requestId: 'part_sale_missing'}, '不属于');
    assert.deepEqual(await must(clients[0].callApi('Inventory', {})), sold.inventory);
    assert.deepEqual((await must(clients[0].callApi('RoleProfile', {}))).profile, sold.profile);
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    await rejected(0, {...request, requestId: 'part_sale_playing'}, '准备阶段');
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
    const final = await sale(0, {operation: 'QUERY'}), finalPeer = await sale(1, {operation: 'QUERY'});
    evidence.final = final; evidence.finalPeer = finalPeer;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const receipts = native.prepare('SELECT request_id, instance_id, receipt FROM part_sales WHERE account_id = ? ORDER BY request_id').all(identities[0].accountId);
      assert.equal(receipts.length, 1);
      const records = native.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(identities[0].accountId).map(row => JSON.parse(String(row.record)));
      assert.deepEqual(records, final.inventory.records);
      const saved = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(identities[0].accountId)!;
      const profile = {bytes: [...new Uint8Array(saved.payload as Uint8Array)], strings: JSON.parse(String(saved.strings))};
      assert.deepEqual(profile, final.profile); evidence.native = {receipts, records, profile};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = await sale(0, {operation: 'QUERY'}), restoredPeer = await sale(1, {operation: 'QUERY'});
    assert.deepEqual(restored, final); assert.deepEqual(restoredPeer, finalPeer);
    evidence.restored = {seller: restored, peer: restoredPeer}; evidence.actualSameDatabaseRestart = true;
    evidence.status = 'PASS_FINITE_PURCHASED_EQUIPPED_PART_WHOLE_SALE_SOURCE_WITHDRAWAL_DUAL_STATE_LEAVE_RESTART_SCOPE';
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
