import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/queued-part-persistence-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo-stock-'));
  const database = join(directory, 'accounts.sqlite'), port = 3395;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], []], events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index].push(snapshot);});
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
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '120'},
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
    scope: 'Actual purchased role/parts, confirmed passive queue snapshots, ordinary natural death/respawn, Leave, process restart, unload and no stale authority.',
    fixture: 'Two new empty accounts. Only owner profile MONEY10000 is a pre-room funds fixture; tanks/pet/parts are ordinary purchases. No active HP/position/event injection.'};
  const accounts: {accountId: string; token: string}[] = [];
  try {
    await start();
    for (const client of clients) {const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);}
    const store = new AccountStore(database);
    try {
      const bytes = new Uint8Array(0x170); new DataView(bytes.buffer).setUint32(0x70, 10000, true);
      store.replaceRoleProfile(accounts[0].accountId, {bytes, strings: ['', '']});
    } finally {store.close();}
    const tank = await clients[0].callApi('TankShop', {operation: 'BUY', tankId: 3, currency: 'MONEY', requestId: 'queue_tank'}); assert(tank.isSucc);
    const pet = await clients[0].callApi('PetShop', {operation: 'BUY', petId: 2, currency: 'MONEY', requestId: 'queue_pet'}); assert(pet.isSucc);
    assert((await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: new Map(tank.res.purchased!.fields).get(0x1c)!})).isSucc);
    assert((await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: new Map(pet.res.purchased!.fields).get(0)!})).isSucc);
    const instances: number[] = [];
    for (const [slot, itemTableId] of [17031, 17032].entries()) {
      const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId, quantity: 1, currency: 'MONEY', requestId: `queue_part_${slot}`}); assert(bought.isSucc);
      instances.push(bought.res.purchased!.instanceId);
      assert((await clients[0].callApi('Equipment', {operation: 'EQUIP', target: 'PART', slot, instanceId: instances[slot]})).isSucc);
    }
    const denied = await clients[1].callApi('Equipment', {operation: 'EQUIP', target: 'PART', slot: 0, instanceId: instances[0]}); assert(!denied.isSucc);
    const before = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(before.isSucc);
    evidence.purchase = {tank: tank.res, pet: pet.res, instances, money: before.res.money, tokens: before.res.tokens, otherOwnerRejected: denied.err.code};
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '被动光效', name: 'Equipped', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id, clientId: 'ignored', name: 'Patient', tankId: 1}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0].at(-1)?.phase === 'PLAYING');
    const player = (id: string) => snapshots[0].at(-1)!.players.find(p => p.id === id)!;
    assert.deepEqual(player(ownerId).queuedPartSkillIds, [13501, 13502]);
    assert.deepEqual(player(targetId).queuedPartSkillIds, []);
    await wait(() => snapshots[1].at(-1)?.phase === 'PLAYING');
    assert.deepEqual(snapshots[1].at(-1)!.players.find(p => p.id === ownerId)!.queuedPartSkillIds, [13501, 13502]);
    const busy = await clients[0].callApi('Equipment', {operation: 'UNEQUIP', target: 'PART', slot: 0}); assert(!busy.isSucc);
    evidence.liveMutationRejected = busy.err.code;
    if (!process.argv.includes('--persistence-only')) {
    let sequence = 0;
    const input = async (aim = 0, fire = false) => {assert((await clients[1].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0, aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);};
    let aimed = false;
    for (let tick = 0; tick < 300; tick++) {
      const shooter = player(targetId), target = player(ownerId);
      const desired = Math.atan2(target.x - shooter.x, target.z - shooter.z);
      const difference = Math.atan2(Math.sin(desired - shooter.yaw - shooter.aim), Math.cos(desired - shooter.yaw - shooter.aim));
      if (Math.abs(difference) < .025) {aimed = true; break;}
      await input(Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await input(0, true);
    await wait(() => events[0].some(e => e.type === 'destroy' && e.targetId === ownerId), 70000); await input();
    const dead = snapshots[0].find(s => s.players.some(p => p.id === ownerId && !p.alive)); assert(dead);
    assert.deepEqual(dead.players.find(p => p.id === ownerId)!.queuedPartSkillIds, [13501, 13502]);
    await wait(() => player(ownerId).alive && player(ownerId).deaths === 1);
    assert.deepEqual(player(ownerId).queuedPartSkillIds, [13501, 13502]);
    const common = snapshots[0].filter(a => snapshots[1].some(b => a.roomId === b.roomId && a.tick === b.tick));
    assert(common.length > 10);
    for (const a of common) assert.deepEqual(a.players, snapshots[1].find(b => a.roomId === b.roomId && a.tick === b.tick)!.players);
    evidence.lifecycle = {deadTick: dead.tick, revivedTick: snapshots[0].at(-1)!.tick, destroy: events[0].find(e => e.type === 'destroy'), commonTicks: common.length};
    }
    for (const client of clients) assert((await client.callApi('Leave', {roomId, round: 1})).isSucc);
    await stop(); await start();
    for (const [index, client] of clients.entries()) assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    const stock = await clients[0].callApi('Inventory', {}); assert(stock.isSucc);
    assert.deepEqual(stock.res.records.map(r => [r.itemTableId, r.ownedQuantity, r.state]), [[17031, 1, 2], [17032, 1, 2]]);
    const equipment = await clients[0].callApi('Equipment', {operation: 'QUERY'}); assert(equipment.isSucc);
    assert.deepEqual(equipment.res.slots, [instances[0], instances[1], 0, 0, 0]);
    const shop = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(shop.isSucc);
    assert.equal(shop.res.money, before.res.money); assert.equal(shop.res.tokens, before.res.tokens);
    evidence.restored = {stock: stock.res, slots: equipment.res.slots, money: shop.res.money, tokens: shop.res.tokens};
    for (const slot of [0, 1]) assert((await clients[0].callApi('Equipment', {operation: 'UNEQUIP', target: 'PART', slot})).isSucc);
    const newFrameOffset = snapshots[0].length;
    const next = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '卸下光效', name: 'Equipped', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(next.isSucc);
    assert((await clients[1].callApi('Join', {roomId: next.res.room.id, clientId: 'ignored', name: 'Other', tankId: 1})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0].length > newFrameOffset && snapshots[0].at(-1)?.roomId === next.res.room.id && snapshots[0].at(-1)?.phase === 'PLAYING');
    assert.deepEqual(snapshots[0].at(-1)!.players.find(p => p.id === next.res.playerId)!.queuedPartSkillIds, []);
    for (const client of clients) assert((await client.callApi('Leave', {roomId: next.res.room.id, round: 1})).isSucc);
    evidence.newRoomSkills = snapshots[0].at(-1)!.players.map(p => ({id: p.id, skills: p.queuedPartSkillIds}));
    const unloaded = await clients[0].callApi('Equipment', {operation: 'QUERY'}); assert(unloaded.isSucc);
    assert.deepEqual(unloaded.res.slots, [0, 0, 0, 0, 0]); evidence.unloaded = unloaded.res.slots;
    evidence.status = process.argv.includes('--persistence-only') ? 'PASS_PURCHASED_QUEUED_PART_RESTART_UNLOAD_SCOPE' : 'PASS_PURCHASED_QUEUED_PART_LIFECYCLE_RESTART_SCOPE'; console.log(`PASS ${output}.json`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {await stop(); evidence.snapshots = snapshots; evidence.events = events;
    writeFileSync(`${output}.json`, JSON.stringify(evidence, null, 2)); writeFileSync(`${output}.log`, log);
    rmSync(directory, {recursive: true, force: true});}
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
