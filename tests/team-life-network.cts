import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-team-life-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 501, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4); seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3182', logger: undefined}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const ticks = [new Map<number, MsgRoomSnapshot>(), new Map<number, MsgRoomSnapshot>()];
  const events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', value => {snapshots[index] = value; ticks[index].set(value.tick, value);});
    client.listenMsg('RoomEvent', value => {events[index].push(value);});
  });
  async function wait(check: () => boolean, timeout = 15000): Promise<void> {
    const until = Date.now() + timeout;
    while (!check() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1000));
  }
  async function connect(): Promise<void> {
    for (const client of clients) assert((await client.connect()).isSucc);
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
  }
  async function start(): Promise<void> {
    log = '';
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3182', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started')); await connect();
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
  }
  const send = (index: number, sequence: number) => clients[index].sendMsg('PlayerInput',
    {sequence, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: Date.now()});
  async function enterMode(mode: number): Promise<string> {
    snapshots.length = 0; events.forEach(stream => {stream.length = 0;}); ticks.forEach(stream => stream.clear());
    const joined = await clients[0].callApi('CreateRoom', {mode, mapId: 7, roomName: 'Team life', name: 'Owner', tankId: 1});
    assert(joined.isSucc);
    assert((await clients[1].callApi('Join', {clientId: 'observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(value => value?.phase === 'PLAYING') && snapshots.length === 2);
    return joined.res.playerId;
  }
  try {
    await start();
    const shop = await clients[0].callApi('Shop', {operation: 'QUERY'});
    assert(shop.isSucc); assert(!shop.res.items.some(item => item.itemTableId === 501));
    const buy = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 501, quantity: 1,
      currency: 'MONEY', requestId: 'team-life-not-for-sale'});
    assert(!buy.isSucc);
    await enterMode(4);
    assert((await send(0, 1)).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.itemUseRequest?.instanceId === 77)));
    assert(events.every(stream => !stream.some(event => event.type === 'itemUsed')));
    const failed = await clients[0].callApi('Inventory', {}); assert(failed.isSucc);
    assert.equal(failed.res.records[0].ownedQuantity, 3);
    for (const client of clients) await client.disconnect();
    await connect();
    const playerId = await enterMode(1), before = [...snapshots[0]!.match!.teamLives];
    const team = snapshots[0]!.players.find(player => player.id === playerId)!.team;
    assert((await send(0, 1)).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemUsed')));
    const used = events[0].find(event => event.type === 'itemUsed')!;
    assert.deepEqual(events[1].find(event => event.type === 'itemUsed'), used);
    assert.equal(used.value, 1); assert.equal(used.skillId, 501); assert.equal(used.playSkillEffect?.skillId, 501);
    const after = [...before]; after[team]++;
    const common = () => [...ticks[0].keys()].find(tick => ticks[1].has(tick)
      && JSON.stringify(ticks[0].get(tick)!.match!.teamLives) === JSON.stringify(after));
    await wait(() => common() !== undefined);
    const pairedTick = common()!;
    assert.deepEqual(ticks[0].get(pairedTick)!.match!.teamLives, ticks[1].get(pairedTick)!.match!.teamLives);
    assert((await send(0, 1)).isSucc);
    assert((await send(1, 1)).isSucc);
    // A later snapshot proves both messages were processed through the ordinary server loop.
    await wait(() => snapshots.every(value => value!.tick > pairedTick + 3));
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed').length === 1));
    assert.deepEqual(snapshots[0]!.match!.teamLives, after);
    const inventory = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(inventory.isSucc && isolated.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 2); assert.deepEqual(isolated.res.records, []);
    await stop(); await start();
    const persisted = await clients[0].callApi('Inventory', {}), reopenedObserver = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && reopenedObserver.isSucc);
    assert.equal(persisted.res.records[0].itemTableId, 501); assert.equal(persisted.res.records[0].ownedQuantity, 2);
    assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234); assert.equal(persisted.res.hotkeys[3], 77);
    assert.deepEqual(reopenedObserver.res.records, []);
    writeFileSync('recovery/output/team-life-network.json', JSON.stringify({status: 'PASS', port: 3182, used,
      before, after, team, pairedTick, wrongModeOwned: failed.res.records[0].ownedQuantity,
      duplicateConsumed: false, shop501Excluded: true, purchase501Rejected: true, persisted: persisted.res, observer: reopenedObserver.res,
      scope: 'Real isolated TSRPC two accounts, normal APIs and PlayerInput, same event and tick, mode/duplicate refusal, account isolation, actual child-server stop/start. Eligibility and account persistence are rebuilt server rules.'}, null, 2));
    console.log('PASS: :3182 two-account normal team-life input, identical event/tick, mode/duplicate refusal and real server restart');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
