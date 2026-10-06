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
  const output = `recovery/output/ammo-slow-persistence-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo-stock-'));
  const database = join(directory, 'accounts.sqlite'), port = 3392;
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
    scope: 'Actual purchase/configuration, natural2008 hit and ordinary before/during/after movement,15second expiry, dual snapshots, normal Leave and true restart.',
    fixture: 'Two new accounts, empty inventory; pre-room native tank1/pet1 owned fields and profile selection imported from world-role-attributes-native, MONEY100/0 TOKENS0/0. No active HP/position/event injection.'};
  const accounts: {accountId: string; token: string}[] = [];
  try {
    await start();
    for (const client of clients) {const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);}
    const store = new AccountStore(database);
    try {
      const row = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows.find((r: {tankId: number; part: number}) => r.tankId === 1 && r.part === 0);
      for (const [index, account] of accounts.entries()) {
        assert.equal(store.inventory(account.accountId).records.length, 0);
        const fields = (v: Record<string, number>) => new Map(Object.entries(v).map(([k, v]) => [Number(k), v]));
        const base = {name: 'Native pet fixture', fields: fields(row.base)};
        const equipment = {name: 'Native tank fixture', fields: fields(row.equipment)};
        equipment.fields.set(0x1c, 72); equipment.fields.set(0x24, 1);
        equipment.fields.set(0x28, 10011); equipment.fields.set(0x2c, 10012); equipment.fields.set(0x30, 10013);
        store.replaceRoleRecords(account.accountId, {base: [base], equipment: [equipment]});
        const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
        view.setUint32(0xa8, 72, true); view.setUint32(0xa4, base.fields.get(0)!, true);
        view.setUint32(0x70, index ? 0 : 100, true);
        store.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
      }
    } finally {store.close();}
    const insufficient = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 2008, quantity: 2, currency: 'MONEY', requestId: 'medical_denied'});
    assert(!insufficient.isSucc); evidence.insufficient = {code: insufficient.err.code};
    const empty = await clients[1].callApi('Inventory', {}); assert(empty.isSucc && empty.res.records.length === 0);
    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 2008, quantity: 2, currency: 'MONEY', requestId: 'medical_purchase'}); assert(bought.isSucc);
    assert.equal(bought.res.money, 90); const instance = bought.res.purchased!.instanceId;
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId: instance})).isSucc);
    evidence.purchase = {instance, quantity: 2, money: bought.res.money, tokens: bought.res.tokens};
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '黏胶弹', name: 'Medic', tankId: 1, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id, clientId: 'ignored', name: 'Patient', tankId: 1}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0].at(-1)?.phase === 'PLAYING');
    const sequence = [0, 0];
    const input = async (index: number, move = 0, aim = 0, fire = false, useItem = 0) => {
      assert((await clients[index].sendMsg('PlayerInput', {sequence: ++sequence[index], move,
        turn: 0, aim, fire, useItem, clientTime: Date.now()})).isSucc);
    };
    const player = (id: string) => snapshots[0].at(-1)!.players.find(p => p.id === id)!;
    const sample = async (name: string, move: number) => {
      const tick = snapshots[0].at(-1)!.tick;
      await input(1, move);
      await wait(() => snapshots[0].at(-1)!.tick >= tick + 8);
      await input(1);
      const rows = snapshots[0].filter(s => s.tick >= tick + 2 && s.tick <= tick + 7);
      let distance = 0, seconds = 0;
      for (let index = 1; index < rows.length; index++) {
        const previous = rows[index - 1], current = rows[index];
        const a = previous.players.find(p => p.id === targetId)!, b = current.players.find(p => p.id === targetId)!;
        distance += Math.hypot(b.x - a.x, b.z - a.z);
        seconds += (current.serverTime - previous.serverTime) / 1000;
      }
      assert(rows.length >= 5 && distance > 0);
      const measurement = {name, move, distance, seconds, speed: distance / seconds, ticks: rows.map(s => s.tick)};
      await wait(() => snapshots[0].at(-1)!.tick > tick + 9);
      return measurement;
    };
    const baseline = await sample('baseline', 1); await sample('baseline-return', -1);
    let aimed = false;
    for (let tick = 0; tick < 300; tick++) {
      const owner = player(ownerId), target = player(targetId);
      const desired = Math.atan2(target.x - owner.x, target.z - owner.z);
      const difference = Math.atan2(Math.sin(desired - owner.yaw - owner.aim), Math.cos(desired - owner.yaw - owner.aim));
      if (Math.abs(difference) < .025) {aimed = true; break;}
      await input(0, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await input(0, 0, 0, false, 2);
    await wait(() => player(ownerId).ammoItemId === 2008);
    const beforeHp = player(targetId).hp; await input(0, 0, 0, true);
    await wait(() => events[0].some(e => e.type === 'ammoSlowed')); await input(0);
    await wait(() => events[1].some(e => e.type === 'ammoSlowed'));
    const accepted = events[0].find(e => e.type === 'ammoSlowed')!;
    assert.deepEqual(accepted, events[1].find(e => e.type === 'ammoSlowed'));
    assert.equal(accepted.skillId, 4006); assert.equal(accepted.value, -6);
    assert(player(targetId).hp < beforeHp && player(targetId).alive);
    const acceptedAt = snapshots[0].at(-1)!.serverTime;
    const slowed = await sample('slowed', 1); await sample('slowed-return', -1);
    assert(Math.abs((baseline.speed - slowed.speed) - 60) < 1, JSON.stringify({baseline, slowed}));
    await wait(() => events.every(stream => stream.some(e => e.type === 'ammoSlowEnded')), 20000);
    assert.deepEqual(events[0].find(e => e.type === 'ammoSlowEnded'), events[1].find(e => e.type === 'ammoSlowEnded'));
    const expiredAt = snapshots[0].at(-1)!.serverTime;
    assert(expiredAt - acceptedAt >= 14500 && expiredAt - acceptedAt < 15500);
    const restored = await sample('restored', 1);
    assert(Math.abs(restored.speed - baseline.speed) < 1, JSON.stringify({baseline, restored}));
    const paired = snapshots[0].filter(s => snapshots[1].some(other => other.tick === s.tick));
    assert(paired.length > 100);
    for (const state of paired) assert.deepEqual(state.players, snapshots[1].find(other => other.tick === state.tick)!.players);
    assert.deepEqual(events[0].filter(e => e.type === 'ammoConsumed').map(e => e.value), [1]);
    evidence.movement = {baseline, slowed, restored}; evidence.slow = {accepted, acceptedAt, expiredAt, pairedTicks: paired.length};
    for (const client of clients) assert((await client.callApi('Leave', {roomId, round: 1})).isSucc);
    await stop(); await start();
    for (const [index, client] of clients.entries()) assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    const stock = await clients[0].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.length, 1); assert.equal(stock.res.records[0].ownedQuantity, 1);
    assert.equal(stock.res.records[0].itemTableId, 2008); assert.equal(stock.res.hotkeys[0], instance);
    const shop = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(shop.isSucc);
    assert.equal(shop.res.money, 90); assert.equal(shop.res.tokens, 0);
    const guestStock = await clients[1].callApi('Inventory', {}); assert(guestStock.isSucc && guestStock.res.records.length === 0);
    evidence.restored = {stock: stock.res, money: shop.res.money, tokens: shop.res.tokens, guestInventoryEmpty: true};
    evidence.status = 'PASS_PURCHASED_AMMO_SLOW_MOVEMENT_RESTART_SCOPE'; console.log(`PASS ${output}.json`);
  } catch (error) {evidence.error = String(error); throw error;}
  finally {await stop(); evidence.snapshots = snapshots; evidence.events = events;
    writeFileSync(`${output}.json`, JSON.stringify(evidence, null, 2)); writeFileSync(`${output}.log`, log);
    rmSync(directory, {recursive: true, force: true});}
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
