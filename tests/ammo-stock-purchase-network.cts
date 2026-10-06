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
  const output = `recovery/output/ammo-stock-purchase-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo-stock-'));
  const database = join(directory, 'accounts.sqlite'), port = 3385;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1, 2].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], [], []], events: MsgRoomEvent[][] = [[], [], []];
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
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '25'},
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
  const purchases: unknown[] = [], restored: unknown[] = [];
  const evidence: Record<string, unknown> = {status: 'RUNNING', purchases, restored,
    fixture: 'Three new empty accounts. First two profiles contain only explicit funds100000 MONEY/1000 TOKENS; no owned role or stock import. Tank3/pet2 and ammunition are normal BUY results.',
    scope: 'New2002 MONEY and2003 TOKENS purchase -> Kitbag/selected stock -> two ordinary held shots -> empty rejection/default fresh input -> natural short TIME_LIMIT/rematch -> Leave and actual server restart. Existing rebuilt policies; original count producer not claimed.'};
  const accounts: {accountId: string; token: string}[] = [], instances: number[] = [], ids = [2002, 2003];
  const balances: {money: number; tokens: number}[] = [];
  try {
    await start();
    for (const client of clients) {
      const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);
      const inventory = await client.callApi('Inventory', {}); assert(inventory.isSucc && inventory.res.records.length === 0);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
    }
    const store = new AccountStore(database);
    try {
      for (const account of accounts.slice(0, 2)) {
        const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
        view.setUint32(0x70, 100000, true); view.setUint32(0x74, 1000, true);
        store.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
      }
    } finally {store.close();}
    for (let index = 0; index < 2; index++) {
      const client = clients[index];
      const tank = await client.callApi('TankShop', {operation: 'BUY', tankId: 3, currency: 'MONEY', requestId: `stock_tank_${index}`}); assert(tank.isSucc);
      const pet = await client.callApi('PetShop', {operation: 'BUY', petId: 2, currency: 'MONEY', requestId: `stock_pet_${index}`}); assert(pet.isSucc);
      assert((await client.callApi('SelectRole', {kind: 'tank', instanceId: new Map(tank.res.purchased!.fields).get(0x1c)!})).isSucc);
      assert((await client.callApi('SelectRole', {kind: 'pet', instanceId: new Map(pet.res.purchased!.fields).get(0)!})).isSucc);
      const shop = await client.callApi('Shop', {operation: 'QUERY'}); assert(shop.isSucc);
      const product = shop.res.items.find(item => item.itemTableId === ids[index])!; assert(product);
      assert.equal(product.moneyPrice, index === 0 ? 5 : 20);
      assert.equal(product.tokenPrice, index === 0 ? 10 : 20);
      const currency = index === 0 ? 'MONEY' as const : 'TOKENS' as const;
      const bought = await client.callApi('Shop', {operation: 'BUY', itemTableId: ids[index], quantity: 2,
        currency, requestId: `stock_ammo_${index}`}); assert(bought.isSucc);
      assert.equal(bought.res.purchased!.ownedQuantity, 2);
      assert.equal(bought.res.money, shop.res.money! - (index === 0 ? 10 : 0));
      assert.equal(bought.res.tokens, shop.res.tokens! - (index === 1 ? 40 : 0));
      instances.push(bought.res.purchased!.instanceId); balances.push({money: bought.res.money, tokens: bought.res.tokens});
      purchases.push({tank: tank.res, pet: pet.res, ammo: bought.res});
      assert((await client.callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId: instances[index]})).isSucc);
    }
    const insufficient = await clients[2].callApi('Shop', {operation: 'BUY', itemTableId: 2002, quantity: 1,
      currency: 'MONEY', requestId: 'stock_no_funds'}); assert(!insufficient.isSucc);
    const deniedInventory = await clients[2].callApi('Inventory', {}); assert(deniedInventory.isSucc);
    assert.equal(deniedInventory.res.records.length, 0); evidence.insufficient = insufficient;
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '有限弹药', name: '射手', tankId: 3,
      minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id, clientId: 'ignored', name: '另一射手', tankId: 3}); assert(joined.isSucc);
    const playerIds = [created.res.playerId, joined.res.playerId], roomId = created.res.room.id;
    for (const client of clients.slice(0, 2)) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0].at(-1)?.phase === 'PLAYING');
    const sequences = [0, 0];
    const input = async (index: number, fire: boolean, useItem = 0) => {
      assert((await clients[index].sendMsg('PlayerInput', {sequence: ++sequences[index], move: 0, turn: 0, aim: 0,
        fire, useItem, clientTime: Date.now()})).isSucc);
    };
    for (let index = 0; index < 2; index++) await input(index, false, 2);
    await wait(() => snapshots[0].at(-1)!.players.every((player, index) => player.ammoItemId === ids[index]));
    for (let index = 0; index < 2; index++) await input(index, true);
    await wait(() => playerIds.every(id => events[0].filter(event => event.type === 'ammoConsumed' && event.playerId === id).length === 2));
    await wait(() => playerIds.every(id => events[0].some(event => event.type === 'itemRejected' && event.playerId === id)));
    for (let index = 0; index < 2; index++) {
      const ownedEvents = events[0].filter(event => event.playerId === playerIds[index]);
      assert.deepEqual(ownedEvents.filter(event => event.type === 'ammoConsumed').map(event => event.value), [1, 0]);
      assert.equal(ownedEvents.filter(event => event.type === 'fire' && event.skillId === ids[index]).length, 2);
      assert.equal(ownedEvents.filter(event => event.type === 'fire' && event.skillId === 2001).length, 0);
      const stock = await clients[index].callApi('Inventory', {}); assert(stock.isSucc);
      assert.equal(stock.res.records[0].ownedQuantity, 0); assert.equal(stock.res.records[0].battleQuantity, 0);
      await input(index, true);
    }
    await wait(() => playerIds.every(id => events[0].some(event => event.type === 'fire' && event.playerId === id && event.skillId === 2001)));
    for (let index = 0; index < 2; index++) await input(index, false);
    await wait(() => snapshots[0].at(-1)?.phase === 'FINISHED');
    evidence.finished = snapshots[0].at(-1);
    const meaningful = (side: number) => events[side].filter(event => ['ammoConsumed', 'itemRejected', 'fire'].includes(event.type));
    assert.deepEqual(meaningful(0), meaningful(1)); assert.equal(events[2].length, 0);
    for (const client of clients.slice(0, 2)) assert((await client.callApi('Rematch', {round: 1})).isSucc);
    await wait(() => snapshots[0].at(-1)?.phase === 'PLAYING' && snapshots[0].at(-1)?.match?.round === 2);
    evidence.round2 = snapshots[0].at(-1);
    for (const client of clients.slice(0, 2)) {
      const inventory = await client.callApi('Inventory', {}); assert(inventory.isSucc);
      assert.equal(inventory.res.records[0].ownedQuantity, 0); assert.equal(inventory.res.records[0].battleQuantity, 0);
      assert((await client.callApi('Leave', {roomId, round: 2})).isSucc);
    }
    await stop(); await start();
    for (let index = 0; index < 2; index++) {
      assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
      const inventory = await clients[index].callApi('Inventory', {}); assert(inventory.isSucc);
      const shop = await clients[index].callApi('Shop', {operation: 'QUERY'}); assert(shop.isSucc);
      assert.equal(inventory.res.records[0].ownedQuantity, 0); assert.equal(inventory.res.hotkeys[0], instances[index]);
      assert.deepEqual({money: shop.res.money, tokens: shop.res.tokens}, balances[index]);
      restored.push({inventory: inventory.res, balances: balances[index]});
    }
    evidence.status = 'PASS'; console.log(`PASS ${output}.json`);
  } catch (error) {evidence.error = String(error); throw error;}
  finally {
    await stop(); evidence.snapshots = snapshots; evidence.events = events;
    writeFileSync(`${output}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`${output}.log`, log); rmSync(directory, {recursive: true, force: true});
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
