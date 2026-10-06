import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/medical-ammo-full-heal-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-full-medical-'));
  const database = join(directory, 'accounts.sqlite'), port = 3294;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], []], events: MsgRoomEvent[][] = [[], []];
  const snapshotTimes: {tick: number; serverTime: number; wallTime: number}[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index].push(snapshot);
      snapshotTimes[index].push({tick: snapshot.tick, serverTime: snapshot.serverTime, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), log.slice(-700));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '60'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server && server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    scope: 'Only first actual uncapped300 medical heal. Empty Accounts funds-only real tank3/pet2 and2009 acquisition; normal2001 wound>=300, medical projectile300, dual health/event, finite stock and normalLeave. Prior purchase/restart/FX/module evidence reused.',
    fixture: 'Two empty new Accounts: funds-only profile100000, all other bytes0; actual BUY/SelectRole provides owned tank3/pet2. No owned/inventory or liveHP/pose/events imports.'};
  const accounts: {accountId: string; token: string}[] = [];
  try {
    await start();
    for (const client of clients) {const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);}
    const store = new AccountStore(database);
    try {
      for (const account of accounts) {
        assert.equal(store.inventory(account.accountId).records.length, 0);
        const bytes = new Uint8Array(0x170);
        new DataView(bytes.buffer).setUint32(0x70, 100000, true);
        store.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
      }
    } finally {store.close();}
    const purchases = [];
    for (const client of clients) {
      const beforeOwned = await client.callApi('OwnedRoles', {}); assert(beforeOwned.isSucc);
      assert.deepEqual(beforeOwned.res, {base: [], equipment: []});
      const tank = await client.callApi('TankShop', {operation: 'BUY', tankId: 3,
        currency: 'MONEY', requestId: 'full_medical_tank'}); assert(tank.isSucc);
      const pet = await client.callApi('PetShop', {operation: 'BUY', petId: 2,
        currency: 'MONEY', requestId: 'full_medical_pet'}); assert(pet.isSucc);
      const tankFields = new Map(tank.res.purchased!.fields), petFields = new Map(pet.res.purchased!.fields);
      assert((await client.callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
      assert((await client.callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
      purchases.push({tank: tank.res, pet: pet.res});
    }
    evidence.rolePurchases = purchases;
    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 2009, quantity: 1, currency: 'MONEY', requestId: 'medical_purchase'}); assert(bought.isSucc);
    assert.equal(bought.res.purchased!.ownedQuantity, 1); const instance = bought.res.purchased!.instanceId;
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId: instance})).isSucc);
    evidence.purchase = {instance, quantity: 1, money: bought.res.money, tokens: bought.res.tokens};
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '完整医疗', name: 'Medic', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id, clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0].at(-1)?.phase === 'PLAYING');
    let sequence = 0;
    const input = async (aim = 0, fire = false, useItem = 0) => {assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0, aim, fire, useItem, clientTime: Date.now()})).isSucc);};
    const player = (id: string) => snapshots[0].at(-1)!.players.find(p => p.id === id)!;
    let aimed = false;
    for (let tick = 0; tick < 300; tick++) {
      const owner = player(ownerId), target = player(targetId);
      const desired = Math.atan2(target.x - owner.x, target.z - owner.z);
      const difference = Math.atan2(Math.sin(desired - owner.yaw - owner.aim), Math.cos(desired - owner.yaw - owner.aim));
      if (Math.abs(difference) < .025) {aimed = true; break;}
      await input(Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await input(0, true);
    await wait(() => player(targetId).alive && player(targetId).maxHp - player(targetId).hp >= 300, 30000); await input();
    await new Promise(resolve => setTimeout(resolve, 500));
    await wait(() => player(targetId).hp < player(targetId).maxHp);
    evidence.beforeHeal = {...player(targetId)}; const beforeHp = player(targetId).hp, score = player(ownerId).score;
    await input(0, false, 2); await wait(() => player(ownerId).ammoItemId === 2009); await input(0, true);
    await wait(() => events[0].some(e => e.type === 'playerHealed')); await input();
    await wait(() => events[1].some(e => e.type === 'playerHealed') && player(targetId).hp === beforeHp + 300);
    const healing = events[0].find(e => e.type === 'playerHealed')!;
    assert.deepEqual(healing, events[1].find(e => e.type === 'playerHealed'));
    assert.equal(healing.value, 300);
    assert.equal(player(targetId).hp - beforeHp, 300);
    assert.equal(player(ownerId).score, score); assert.equal(healing.hurtSelector, undefined);
    assert.deepEqual(events[0].filter(e => e.type === 'ammoConsumed').map(e => e.value), [0]);
    evidence.healing = healing; evidence.afterHeal = {...player(targetId)};
    for (const client of clients) assert((await client.callApi('Leave', {roomId, round: 1})).isSucc);
    const stock = await clients[0].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === instance)!.ownedQuantity, 0);
    evidence.stock = stock.res;
    const common = snapshots[0].filter(frame => frame.phase === 'PLAYING'
      && snapshots[1].some(other => other.roomId === frame.roomId && other.tick === frame.tick));
    assert(common.length > 10);
    for (const frame of common) {
      const other = snapshots[1].find(other => other.roomId === frame.roomId && other.tick === frame.tick)!;
      assert.deepEqual(frame.players, other.players);
    }
    evidence.commonTicks = common.length;
    evidence.normalLeaves = 2;
    evidence.status = 'PASS_MEDICAL_FULL300_HEAL'; console.log(`PASS ${output}.json`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {await stop(); evidence.snapshots = snapshots; evidence.events = events;
    evidence.snapshotTimes = snapshotTimes; evidence.simulatedTickSeconds = .05; evidence.cleaned = true;
    writeFileSync(`${output}.json`, JSON.stringify(evidence, null, 2)); writeFileSync(`${output}.log`, log);
    rmSync(directory, {recursive: true, force: true});}
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
