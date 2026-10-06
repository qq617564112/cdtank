import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../apps/shared/protocols/PtlOwnedRoleSale';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}
const fields = (record: OwnedRoleRecordData) => new Map(record.fields);
const projection = ({owned, profile, money, quotes}: ResOwnedRoleSale) => ({owned, profile, money, quotes});

async function main(): Promise<void> {
  const port = Number(process.env.OWNED_ROLE_SALE_PORT);
  assert.equal(port, 3609, 'Use the coordinated owned-role sale window');
  const directedTail = process.env.OWNED_ROLE_SALE_DIRECTED_TAIL === '1';
  const firstRaw = 'recovery/output/owned-role-sale-network-2026-10-05T19-46-39-274Z';
  const source = directedTail ? firstRaw : 'recovery/output/pet-learning-network-2026-10-05T19-06-05-701Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  assert.equal(identities.length, 2);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-owned-sale-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/owned-role-sale-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, directedTail,
    reusedFirstRaw: directedTail ? firstRaw + '.json' : undefined,
    fixture: {source: source + '-checkpoint.sqlite', newFundsInjected: false, ownedRecordsInjected: false,
      reusedSourcePointFixture: true, earnedPointClaim: false},
    scope: 'Ordinary Pet2/Tank52 BUY, selected sale rejection, normal reselection, WAITING pet sale, PLAYING tank rejection, dual state, normal Leave, tank sale, replay/conflict/foreign/missing and same-database restart.'};
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
  async function sale(index: number, request: ReqOwnedRoleSale): Promise<ResOwnedRoleSale> {
    const result = await clients[index].callApi('OwnedRoleSale', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(result.isSucc, JSON.stringify(result)); return result.res;
  }
  async function rejected(index: number, request: ReqOwnedRoleSale, message: string): Promise<void> {
    const before = projection(await sale(index, {operation: 'QUERY'}));
    const result = await clients[index].callApi('OwnedRoleSale', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(!result.isSucc, 'Expected sale rejection');
    assert(result.err.message.includes(message), JSON.stringify(result));
    assert.deepEqual(projection(await sale(index, {operation: 'QUERY'})), before);
  }
  try {
    await start(); await authenticate();
    if (directedTail) {
      const first = JSON.parse(readFileSync(firstRaw + '.json', 'utf8'));
      const tankId = fields(first.acquisition.boughtTank.purchased).get(0x1c)!;
      const baseline = await sale(0, {operation: 'QUERY'}), peer = await sale(1, {operation: 'QUERY'});
      assert.equal(baseline.money, first.soldPet.money);
      assert.deepEqual(baseline.owned, first.soldPet.owned);
      assert(baseline.owned.equipment.some(row => fields(row).get(0x1c) === tankId));
      evidence.baseline = baseline;
      for (const [index, account] of [baseline, peer].entries()) {
        const reservePet = account.owned.base[0], reserveTank = account.owned.equipment.find(row => index === 1 || fields(row).get(0x1c) !== tankId)!;
        assert(reservePet && reserveTank);
        await must(clients[index].callApi('SelectRole', {kind: 'pet', instanceId: fields(reservePet).get(0)!}));
        await must(clients[index].callApi('SelectRole', {kind: 'tank', instanceId: fields(reserveTank).get(0x1c)!}));
      }
      const reserveTank = baseline.owned.equipment.find(row => fields(row).get(0x1c) !== tankId)!;
      const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '出售持久终点',
        name: 'Seller', tankId: fields(reserveTank).get(0x24)!, minPlayers: 2, maxPlayers: 2}));
      const joined = await must(clients[1].callApi('Join', {roomId: created.room.id,
        clientId: 'ignored', name: 'Peer', tankId: fields(peer.owned.equipment[0]).get(0x24)!}));
      evidence.room = {created, joined};
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING' && rows.at(-1)!.snapshot.tick >= 6));
      const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
      const peers = new Map(frames[1].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
      const common = frames[0].filter(row => row.snapshot.phase === 'PLAYING' && peers.has(key(row.snapshot)));
      assert(common.length >= 5);
      for (const row of common) assert.deepEqual(row.snapshot.players, peers.get(key(row.snapshot))!.players);
      evidence.commonKeys = [...new Set(common.map(row => key(row.snapshot)))];
      evidence.leave = [];
      for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
      const tankRequest = {operation: 'SELL', kind: 'tank', instanceId: tankId, requestId: 'owned_sale_first_tank'} as const;
      const soldTank = await sale(0, tankRequest);
      assert.deepEqual(soldTank.sold, {kind: 'tank', instanceId: tankId, price: 2000, result: 2});
      assert.equal(soldTank.money, baseline.money! + 2000);
      assert.deepEqual(soldTank.owned.base, baseline.owned.base);
      assert.deepEqual(soldTank.owned.equipment, baseline.owned.equipment.filter(row => fields(row).get(0x1c) !== tankId));
      evidence.soldTank = soldTank;
      const replay = await sale(0, tankRequest); assert.equal(replay.replayed, true);
      assert.deepEqual(projection(replay), projection(soldTank));
      const final = await sale(0, {operation: 'QUERY'}), finalPeer = await sale(1, {operation: 'QUERY'});
      evidence.final = final; evidence.finalPeer = finalPeer;
      for (const client of clients) await client.disconnect(); await stop();
      const native = new DatabaseSync(database, {readOnly: true});
      try {
        const receipts = native.prepare('SELECT request_id, kind, instance_id, receipt FROM owned_role_sales WHERE account_id = ? ORDER BY request_id').all(identities[0].accountId);
        assert.equal(receipts.length, 2);
        const nativeOwned = {base: [] as OwnedRoleRecordData[], equipment: [] as OwnedRoleRecordData[]};
        for (const row of native.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(identities[0].accountId)) {
          nativeOwned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)));
        }
        assert.deepEqual(nativeOwned, final.owned);
        const bytes = [...new Uint8Array(native.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identities[0].accountId)!.payload as Uint8Array)];
        assert.deepEqual(bytes, final.profile!.bytes);
        evidence.native = {receipts, owned: nativeOwned, profileBytes: bytes};
      } finally {native.close();}
      await start(); await authenticate();
      const restored = await sale(0, {operation: 'QUERY'}), restoredPeer = await sale(1, {operation: 'QUERY'});
      assert.deepEqual(restored, final); assert.deepEqual(restoredPeer, finalPeer);
      evidence.restored = {seller: restored, peer: restoredPeer}; evidence.actualSameDatabaseRestart = true;
      evidence.status = 'PASS_FINITE_OWNED_ROLE_SALE_FIRST_CHECKPOINT_TANK_TAIL_DUAL_STATE_LEAVE_RESTART_SCOPE';
      console.log('PASS: ' + output + '.json');
      return;
    }
    const before = await sale(0, {operation: 'QUERY'}); evidence.before = before;
    const reservePet = before.owned.base[0], reserveTank = before.owned.equipment[0];
    assert(reservePet && reserveTank);
    const boughtPet = await must(clients[0].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'owned_sale_first_buy_pet2'}));
    const boughtTank = await must(clients[0].callApi('TankShop', {operation: 'BUY', tankId: 52,
      currency: 'MONEY', requestId: 'owned_sale_first_buy_tank52'}));
    assert(boughtPet.purchased && boughtTank.purchased);
    const petId = fields(boughtPet.purchased).get(0)!, tankId = fields(boughtTank.purchased).get(0x1c)!;
    const acquired = await sale(0, {operation: 'QUERY'});
    const petQuote = acquired.quotes.find(row => row.kind === 'pet' && row.instanceId === petId)!;
    const tankQuote = acquired.quotes.find(row => row.kind === 'tank' && row.instanceId === tankId)!;
    assert(petQuote && tankQuote);
    // Original PetMoney3500/TankMoney4000, independent of normalized BUY prices.
    assert.equal(petQuote.price, 1750);
    assert.equal(tankQuote.price, 2000);
    evidence.acquisition = {boughtPet, boughtTank, acquired};
    const selected = [];
    for (const [kind, instanceId] of [['pet', petId], ['tank', tankId]] as const) {
      selected.push(await must(clients[0].callApi('SelectRole', {kind, instanceId})));
      await rejected(0, {operation: 'SELL', kind, instanceId, requestId: `owned_sale_selected_${kind}`}, '出击');
    }
    evidence.selected = selected;
    for (const [kind, instanceId] of [['pet', fields(reservePet).get(0)!], ['tank', fields(reserveTank).get(0x1c)!]] as const) {
      await must(clients[0].callApi('SelectRole', {kind, instanceId}));
    }
    const peer = await sale(1, {operation: 'QUERY'});
    for (const [kind, instanceId] of [['pet', fields(peer.owned.base[0]).get(0)!],
      ['tank', fields(peer.owned.equipment[0]).get(0x1c)!]] as const) {
      await must(clients[1].callApi('SelectRole', {kind, instanceId}));
    }
    const baseline = await sale(0, {operation: 'QUERY'}); evidence.baseline = baseline;
    const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '拥有角色出售',
      name: 'Seller', tankId: fields(reserveTank).get(0x24)!, minPlayers: 2, maxPlayers: 2}));
    const joined = await must(clients[1].callApi('Join', {roomId: created.room.id,
      clientId: 'ignored', name: 'Peer', tankId: fields(peer.owned.equipment[0]).get(0x24)!}));
    evidence.room = {created, joined};
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.players.length === 2));
    const petRequest = {operation: 'SELL', kind: 'pet', instanceId: petId, requestId: 'owned_sale_first_pet'} as const;
    const soldPet = await sale(0, petRequest);
    assert.deepEqual(soldPet.sold, {kind: 'pet', instanceId: petId, price: petQuote.price, result: 2});
    assert.equal(soldPet.money, baseline.money! + petQuote.price);
    assert(!soldPet.owned.base.some(row => fields(row).get(0) === petId));
    assert.deepEqual(soldPet.owned.equipment, baseline.owned.equipment);
    evidence.soldPet = soldPet;
    const replayPet = await sale(0, petRequest); assert.equal(replayPet.replayed, true);
    assert.deepEqual(projection(replayPet), projection(soldPet));
    await rejected(0, {...petRequest, kind: 'tank', instanceId: tankId}, '不同实例');
    await rejected(0, {...petRequest, requestId: 'owned_sale_missing_pet'}, '不属于');
    const foreignPet = peer.owned.base.find(row => !soldPet.owned.base.some(own => fields(own).get(0) === fields(row).get(0)))!;
    assert(foreignPet, 'The lawful peer checkpoint supplies a foreign instance absent from seller');
    await rejected(0, {operation: 'SELL', kind: 'pet', instanceId: fields(foreignPet).get(0)!, requestId: 'owned_sale_foreign_pet'}, '不属于');
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const tankRequest = {operation: 'SELL', kind: 'tank', instanceId: tankId, requestId: 'owned_sale_first_tank'} as const;
    await rejected(0, tankRequest, '准备阶段');
    const firstPlayingTick = frames[0].at(-1)!.snapshot.tick;
    await wait(() => frames.every(rows => rows.at(-1)!.snapshot.tick >= firstPlayingTick + 5));
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const peers = new Map(frames[1].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
    const common = frames[0].filter(row => row.snapshot.phase === 'PLAYING' && peers.has(key(row.snapshot)));
    assert(common.length >= 5);
    for (const row of common) assert.deepEqual(row.snapshot.players, peers.get(key(row.snapshot))!.players);
    assert(!events.flat().some(row => row.type === 'fire'));
    evidence.commonKeys = [...new Set(common.map(row => key(row.snapshot)))];
    evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
    const soldTank = await sale(0, tankRequest);
    assert.deepEqual(soldTank.sold, {kind: 'tank', instanceId: tankId, price: tankQuote.price, result: 2});
    assert.equal(soldTank.money, baseline.money! + petQuote.price + tankQuote.price);
    assert(!soldTank.owned.equipment.some(row => fields(row).get(0x1c) === tankId));
    assert.deepEqual(soldTank.owned.base, soldPet.owned.base);
    evidence.soldTank = soldTank;
    const replayTank = await sale(0, tankRequest); assert.equal(replayTank.replayed, true);
    assert.deepEqual(projection(replayTank), projection(soldTank));
    const final = await sale(0, {operation: 'QUERY'}), finalPeer = await sale(1, {operation: 'QUERY'});
    evidence.final = final; evidence.finalPeer = finalPeer;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const receipts = native.prepare('SELECT request_id, kind, instance_id, receipt FROM owned_role_sales WHERE account_id = ? ORDER BY request_id').all(identities[0].accountId);
      assert.equal(receipts.length, 2);
      const records = native.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(identities[0].accountId);
      const nativeOwned = {base: [] as OwnedRoleRecordData[], equipment: [] as OwnedRoleRecordData[]};
      for (const row of records) nativeOwned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)));
      assert.deepEqual(nativeOwned, final.owned);
      const bytes = [...new Uint8Array(native.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identities[0].accountId)!.payload as Uint8Array)];
      assert.deepEqual(bytes, final.profile!.bytes);
      evidence.native = {receipts, owned: nativeOwned, profileBytes: bytes};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = await sale(0, {operation: 'QUERY'}), restoredPeer = await sale(1, {operation: 'QUERY'});
    assert.deepEqual(restored, final); assert.deepEqual(restoredPeer, finalPeer);
    evidence.restored = {seller: restored, peer: restoredPeer}; evidence.actualSameDatabaseRestart = true;
    evidence.status = 'PASS_FINITE_OWNED_ROLE_SALE_ACQUISITION_SELECTED_REJECTION_ATOMIC_REPLAY_DUAL_STATE_LEAVE_RESTART_SCOPE';
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
