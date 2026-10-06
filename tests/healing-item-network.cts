import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {WorldEvent} from '../apps/server/src/world';

const largeFeed = process.argv.includes('--large-feed');
const definitionId = largeFeed ? 2 : 1;
async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-healing-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: definitionId, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0x80000000, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4); seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3137', logger: undefined}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const events: WorldEvent[][] = [[], []];
  const ticks = [new Map<number, MsgRoomSnapshot>(), new Map<number, MsgRoomSnapshot>()];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', value => {
      snapshots[index] = value; ticks[index].set(value.tick, value);
      if (ticks[index].size > 200) ticks[index].delete(ticks[index].keys().next().value!);
    });
    client.listenMsg('RoomEvent', value => {events[index].push(value);});
  });
  async function wait(check: () => boolean, timeout = 5000): Promise<void> {
    const until = Date.now() + timeout;
    while (!check() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; server log: ${log.slice(-1500)}`);
  }
  async function start(): Promise<void> {
    log = '';
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3137', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: environment, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started'), 15000);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server && server.exitCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve()));
      server.kill(); await ended;
    }
  }
  try {
    await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const joined = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Healing test', name: 'Owner', tankId: 1});
    assert(joined.isSucc);
    const guest = await clients[1].callApi('Join', {clientId: 'healing-observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id});
    assert(guest.isSucc);
    for (let i = 0; i < 3; i++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]?.phase === 'PLAYING');
    const full = snapshots[0]!.players.find(player => player.id === joined.res.playerId)!;
    assert.equal(full.hp, full.maxHp);
    await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()});
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemRejected')));
    const refused = events[0].find(event => event.type === 'itemRejected')!;
    assert.equal(refused.message, '满血无需使用道具');
    assert.deepEqual(events[1].find(event => event.type === 'itemRejected'), refused);
    assert(events.every(stream => !stream.some(event => event.type === 'itemUsed')));
    const untouched = await clients[0].callApi('Inventory', {});
    assert(untouched.isSucc); assert.equal(untouched.res.records[0].ownedQuantity, 3);
    assert.equal(untouched.res.records[0].battleQuantity, 3);
    // Both humans stay still. Natural CPU movement/fire supplies all injury.
    await wait(() => snapshots[0]!.players.some(p => p.id === joined.res.playerId && p.alive && p.hp < p.maxHp), 120000);
    const injured = snapshots[0]!.players.find(p => p.id === joined.res.playerId)!;
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 2, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
    await wait(() => events.every(stream => stream.some(e => e.type === 'itemUsed' && e.playerId === joined.res.playerId)));
    const used = events[0].find(e => e.type === 'itemUsed')!;
    assert.deepEqual(events[1].find(e => e.type === 'itemUsed'), used, 'Two independent clients receive the same actual cast/effect event');
    assert.equal(used.skillId, definitionId); assert.equal(used.playSkillEffect?.effectIndex, 0);
    const inventory = await clients[0].callApi('Inventory', {});
    assert(inventory.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 2);
    assert.equal(inventory.res.records[0].battleQuantity, 2);
    const castTick = snapshots[0]!.tick;
    await wait(() => [...ticks[0].keys()].some(tick => tick > castTick && ticks[1].has(tick)));
    const pairedTick = [...ticks[0].keys()].reverse().find(tick => tick > castTick && ticks[1].has(tick));
    assert(pairedTick !== undefined);
    assert.deepEqual(ticks[0].get(pairedTick)!.players, ticks[1].get(pairedTick)!.players);
    await clients[0].sendMsg('PlayerInput', {sequence: 2, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: Date.now()});
    await new Promise(resolve => setTimeout(resolve, 200));
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed').length === 1));
    const repeated = await clients[0].callApi('Inventory', {});
    assert(repeated.isSucc); assert.equal(repeated.res.records[0].ownedQuantity, 2);

    await stop(); await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && isolated.isSucc);
    assert.equal(persisted.res.records[0].ownedQuantity, 2);
    assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234);
    assert.equal(persisted.res.hotkeys[3], 77);
    assert.deepEqual(isolated.res.records, []);
    assert.equal(used.playSkillEffect?.skillId, definitionId);
    assert.equal(persisted.res.records[0].itemTableId, definitionId);
    writeFileSync(`recovery/output/${largeFeed ? 'large-feed' : 'healing-item'}-network.json`, JSON.stringify({status: 'PASS',
      scope: 'Actual isolated TSRPC server3137/two clients, normal account/room/CPU/Ready/input, natural CPU injury, source healing effect notification, persisted consumption/server restart/isolation. No browser pixel/audio or original server rules proved.', fullHealthRefused: refused, pairedTick, staleSequenceNoExtraUse: true, injured, used, inventory: inventory.res, persisted: persisted.res}, null, 2));
    console.log('PASS: live two-client ordinary healing cast/effect, persistent quantity, server restart and account isolation');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
