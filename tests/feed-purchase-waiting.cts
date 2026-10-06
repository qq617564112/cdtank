import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-feed-purchase-waiting-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const accounts = [seed.open(), seed.open()];
  const evidence: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
  const pair = readOwnedRolePairMessage(new Uint8Array(evidence.rows[0].raw), evidence.rows[0].alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  const base = {name: 'Feed acceptance pet', fields: new Map(pair.base.fields)};
  base.fields.set(0, 71001); base.fields.set(8, 1);
  for (let index = 0; index < 6; index++) {base.fields.set(0x44 + index * 4, 0); base.fields.set(0x5c + index * 4, 0);}
  const equipment = {name: 'Feed acceptance tank', fields: new Map(pair.equipment.fields)};
  for (const [offset, value] of [[0x1c, 71002], [0x24, 1], [0x28, 0], [0x2c, 0], [0x30, 0],
    [0x58, 0], [0x5c, 0], [0x60, 0], [0x6c, 3]]) equipment.fields.set(offset, value);
  for (const [index, account] of accounts.entries()) {
    assert.deepEqual(seed.inventory(account.accountId).records, []);
    seed.replaceRoleRecords(account.accountId, {base: [base], equipment: [equipment]});
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setUint32(0xa4, 71001, true); view.setUint32(0xa8, 71002, true);
    view.setUint32(0x70, 1000, true); view.setUint32(0x74, 1000, true);
    seed.replaceRoleProfile(account.accountId, {bytes, strings: [account.accountId, 'Feed acceptance pet']});
  }
  seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = accounts.map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3162', logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = accounts.map(() => undefined);
  const snapshotCounts = accounts.map(() => 0);
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', snapshot => {snapshots[index] = snapshot; snapshotCounts[index]++;}));
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; server log: ${log.slice(-1500)}`);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve())); server.kill(); await ended;
    }
  }
  try {
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3162', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);}); server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started') || server!.exitCode !== null); assert(log.includes('Server started'), log);
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Waiting feed purchase', name: 'Owner', tankId: 1}); assert(host.isSucc);
    assert((await clients[1].callApi('Join', {roomId: host.res.room.id, clientId: 'waiting-feed-guest', name: 'Observer', tankId: 1})).isSucc);
    const before = await clients[0].callApi('Inventory', {}); assert(before.isSucc); assert.deepEqual(before.res.records, []);
    const profileBefore = await clients[0].callApi('RoleProfile', {}); assert(profileBefore.isSucc && profileBefore.res.profile);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(snapshot => snapshot?.phase === 'WAITING' && snapshot.match?.readyPlayerIds.includes(host.res.playerId)));
    const readyTick = snapshots[0]!.tick;
    const readySnapshotCounts = [...snapshotCounts];
    const purchase = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 1, quantity: 1,
      currency: 'MONEY', requestId: 'waiting-feed-money-001'});
    assert(purchase.isSucc && purchase.res.purchased);
    assert.equal(purchase.res.money, 990); assert.equal(purchase.res.tokens, 1000);
    assert.equal(purchase.res.purchased.itemTableId, 1); assert.equal(purchase.res.purchased.ownedQuantity, 1);
    await wait(() => snapshots.every((snapshot, index) => snapshotCounts[index] > readySnapshotCounts[index] && snapshot?.phase === 'WAITING' && snapshot.tick >= readyTick &&
      snapshot.match?.readyPlayerIds.includes(host.res.playerId) === true));
    const acquired = await clients[0].callApi('Inventory', {}); assert(acquired.isSucc);
    assert.deepEqual(acquired.res.records, [purchase.res.purchased], 'Authenticated in-room Inventory projects the newly bound world stock');
    const profileAfter = await clients[0].callApi('RoleProfile', {}); assert(profileAfter.isSucc && profileAfter.res.profile);
    const expectedProfile = structuredClone(profileBefore.res.profile);
    const bytes = Uint8Array.from(expectedProfile.bytes); new DataView(bytes.buffer).setUint32(0x70, 990, true);
    expectedProfile.bytes = [...bytes]; assert.deepEqual(profileAfter.res.profile, expectedProfile);
    const assigned = await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId: purchase.res.purchased.instanceId}); assert(assigned.isSucc);
    const worldInventory = await clients[0].callApi('Inventory', {}); assert(worldInventory.isSucc);
    assert.equal(worldInventory.res.hotkeys[3], purchase.res.purchased.instanceId);
    assert.deepEqual(worldInventory.res.records, [purchase.res.purchased]);
    const guestInventory = await clients[1].callApi('Inventory', {}); assert(guestInventory.isSucc);
    assert.deepEqual(guestInventory.res.records, []); assert.deepEqual(guestInventory.res.hotkeys, Array(7).fill(0));
    assert(snapshots.every(snapshot => snapshot?.phase === 'WAITING' && snapshot.match?.readyPlayerIds.length === 1 && snapshot.match.readyPlayerIds[0] === host.res.playerId));
    writeFileSync('recovery/output/feed-purchase-waiting.json', JSON.stringify({status: 'PASS', port: 3162,
      scope: 'Actual isolated TSRPC service; owned native role/profile fixtures, zero initial inventory; normal room join and host-only Ready; purchase binds world inventory/profile and broadcasts room state while preserving unchanged preparation readiness; real Kitbag assignment and account isolation. No battle started.',
      purchase: purchase.res, worldInventory: worldInventory.res, profile: profileAfter.res.profile,
      hostReadyRetainedOnBothClients: true, remainedWaiting: true, guestInventory: guestInventory.res}, null, 2));
    console.log('PASS: WAITING purchase refreshes world inventory, retains host Ready on both clients, charges10 and assigns source feed slot4');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
