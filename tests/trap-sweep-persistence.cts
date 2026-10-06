import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/trap-sweep-persistence-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-trap-sweep-persistence-'));
  const database = join(directory, 'accounts.sqlite'), port = 3305;
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], []], events: MsgRoomEvent[][] = [[], []];
  const times: {tick: number; serverTime: number; wallTime: number}[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index].push(snapshot);
      times[index].push({tick: snapshot.tick, serverTime: snapshot.serverTime, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => events[index].push(event));
  });
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    fixture: 'Native SQLite checkpoint of two ordinary BUY3/pet2 Accounts, owner has one previously purchased3003/slot1. New target formal BUY broom12x2/slot4; no ownership/live state imports.',
    checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'FUNC14 actual same-database restart after ordinary BUY12x2/configuration/ground sweep and normal Leave; native SQLite inventory plus restored balance and hotkey. Existing rule/draw/audio evidence reused.'};
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Condition deadline; server tail: ' + log.slice(-500));
  }
  async function startServer(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '60'},
      stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
  }
  async function stopServer(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const done = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await done;
    }
  }
  const sequence = [0, 0];
  const inputs: unknown[] = [];
  async function input(index: number, move = 0, turn = 0, useItem = 0): Promise<void> {
    const value = {sequence: ++sequence[index], move, turn, aim: 0, fire: false, useItem, clientTime: Date.now()};
    inputs.push({index, ...value}); assert((await clients[index].sendMsg('PlayerInput', value)).isSucc);
  }
  const latest = () => snapshots[0].at(-1)!;
  const player = (id: string) => latest().players.find(row => row.id === id)!;
  try {
    await startServer();
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const ownerStock = await clients[0].callApi('Inventory', {}); assert(ownerStock.isSucc);
    const trap = ownerStock.res.records.find(row => row.itemTableId === 3003)!;
    assert.equal(trap.ownedQuantity, 1);
    const bought = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 12,
      quantity: 2, currency: 'MONEY', requestId: 'trap_sweep_first'}); assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    assert.equal(bought.res.purchased!.ownedQuantity, 2);
    const assignment = await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId});
    evidence.assignment = assignment; assert(assignment.isSucc);
    evidence.purchase = bought.res;
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '扫除地夹', name: 'Owner', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(frames => frames.at(-1)?.phase === 'PLAYING'));
    assert.equal(player(targetId).hp, 700);
    await input(0, 0, 0, 2);
    await wait(() => events[0].some(event => event.type === 'trapPlaced'));
    const placed = events[0].find(event => event.type === 'trapPlaced')!;
    await input(0);
    await wait(() => snapshots.every(frames => frames.at(-1)?.match?.groundTraps?.some(row => row.id === placed.targetId)));
    const before = latest(), target = {...player(targetId)};
    assert(Math.hypot(target.x - placed.x, target.z - placed.z) <= 400);
    evidence.before = {tick: before.tick, serverTime: before.serverTime, wallTime: Date.now(),
      player: target, ground: before.match!.groundTraps};
    await input(1, 0, 0, 5);
    await wait(() => events.every(rows => rows.some(e => e.type === 'itemUsed' && e.playerId === targetId && e.skillId === 12))
      && snapshots.every(frames => !frames.at(-1)?.match?.groundTraps?.some(row => row.id === placed.targetId)));
    evidence.after = {tick: latest().tick, serverTime: latest().serverTime, wallTime: Date.now(),
      player: {...player(targetId)}, ground: latest().match!.groundTraps};
    const used = events[0].find(e => e.type === 'itemUsed' && e.playerId === targetId && e.skillId === 12)!;
    assert.equal(used.value, 1);
    assert.deepEqual(used.playSkillEffect, {skillId: 12, effectIndex: 0, duration: 0,
      roleId: Number(targetId.slice(1)), xBits: 0, zBits: 0});
    evidence.used = used;
    assert.equal(player(targetId).hp, target.hp); assert.equal(player(targetId).maxHp, target.maxHp);
    assert.equal(player(targetId).trapRestraint, undefined);
    const usedStock = await clients[1].callApi('Inventory', {}); assert(usedStock.isSucc);
    assert.equal(usedStock.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 1);
    evidence.usedStock = usedStock.res;
    evidence.leave = [];
    for (const client of clients) {const result = await client.callApi('Leave', {roomId, round: 1});
      (evidence.leave as unknown[]).push(result); assert(result.isSucc);}
    await stopServer();
    const native = new AccountStore(database);
    try {
      const session = native.open(accounts[1].token);
      assert.equal(session.accountId, accounts[1].accountId);
      const inventory = native.inventory(session.accountId);
      const record = inventory.records.find(row => row.instanceId === instanceId)!;
      assert.equal(record.itemTableId, 12);
      assert.equal(record.ownedQuantity, 1);
      assert.equal(inventory.hotkeys[3], instanceId);
      evidence.nativeInventory = inventory;
    } finally {native.close();}
    await startServer();
    const restored = [];
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {token: accounts[index].token});
      assert(account.isSucc && account.res.accountId === accounts[index].accountId);
      const stock = await client.callApi('Inventory', {}); assert(stock.isSucc);
      const balance = await client.callApi('Shop', {operation: 'QUERY'}); assert(balance.isSucc);
      const roles = await client.callApi('RoleProfile', {}); assert(roles.isSucc);
      if (index === 1) {
        assert.equal(stock.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 1);
        assert.equal(stock.res.hotkeys[3], instanceId);
        assert.equal(balance.res.money, bought.res.money);
        assert.equal(balance.res.tokens, bought.res.tokens);
        assert.deepEqual(stock.res.records, (evidence.nativeInventory as {records: unknown[]}).records);
      } else {
        assert.equal(stock.res.records.find(row => row.instanceId === trap.instanceId)!.ownedQuantity, 0);
      }
      restored.push({index, stock: stock.res, money: balance.res.money, tokens: balance.res.tokens,
        profile: roles.res});
    }
    evidence.actualRestart = {sameDatabase: true, stoppedAndStarted: true, restored};
    evidence.status = 'PASS_PURCHASED_TRAP_SWEEP_NATIVE_STOCK_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    evidence.snapshots = snapshots; evidence.snapshotTimes = times; evidence.events = events; evidence.inputs = inputs;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
    await stopServer();
    rmSync(directory, {recursive: true, force: true});
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
