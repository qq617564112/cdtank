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
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-invincible-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 8, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4); seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3146', logger: undefined}));
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
  async function start(): Promise<void> {
    log = '';
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3146', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started'));
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null) {const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;}
  }
  try {
    await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const joined = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Drink', name: 'Owner', tankId: 1});
    assert(joined.isSucc);
    assert((await clients[1].callApi('Join', {clientId: 'observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id})).isSucc);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(value => value?.phase === 'PLAYING'));
    const send = (sequence: number) => clients[0].sendMsg('PlayerInput', {sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()});
    assert((await send(1)).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemUsed')));
    const used = events[0].find(event => event.type === 'itemUsed')!;
    assert.deepEqual(events[1].find(event => event.type === 'itemUsed'), used);
    assert.equal(used.playSkillEffect?.skillId, 8);
    const boost = () => snapshots[0]?.players.find(value => value.id === joined.res.playerId)?.invincibility;
    await wait(() => !!boost());
    const active = boost()!;
    assert.equal(active.skillId, 8);
    assert.equal(used.playSkillEffect?.duration, 10);
    const common = () => [...ticks[0].keys()].find(tick => ticks[0].get(tick)!.players.some(value => value.invincibility)
      && ticks[1].has(tick));
    await wait(() => common() !== undefined);
    const pairedTick = common()!;
    assert.deepEqual(ticks[0].get(pairedTick)!.players, ticks[1].get(pairedTick)!.players);
    assert((await send(1)).isSucc); assert((await send(2)).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemRejected')));
    assert.equal(events[0].filter(event => event.type === 'itemUsed').length, 1);
    assert.equal(events[1].filter(event => event.type === 'itemUsed').length, 1);
    const inventory = await clients[0].callApi('Inventory', {});
    assert(inventory.isSucc); assert.equal(inventory.res.records[0].ownedQuantity, 2);
    await wait(() => snapshots.every(value => !value?.players.find(player => player.id === joined.res.playerId)?.invincibility)
      && events.every(stream => stream.some(event => event.stopSkillEffect?.skillId === 8)));
    const expiredAt = snapshots[0]!.serverTime;
    assert(expiredAt >= active.expiresAt);
    assert(expiredAt < active.expiresAt + 1000);
    await stop(); await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && isolated.isSucc);
    assert.equal(persisted.res.records[0].itemTableId, 8);
    assert.equal(persisted.res.records[0].ownedQuantity, 2);
    assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234);
    assert.equal(persisted.res.hotkeys[3], 77); assert.deepEqual(isolated.res.records, []);
    writeFileSync('recovery/output/invincibility-network.json', JSON.stringify({status: 'PASS', used, active, expiredAt, pairedTick,
      persisted: persisted.res, refusal: events[0].find(event => event.type === 'itemRejected'),
      scope: 'Real isolated TSRPC two clients, ordinary input self cast, same event/tick, source immunity10s expiry, no duplicate consumption/nonstacking, real server restart and account isolation. Server authorization/damage policies rebuilt; no browser/resource proof.'}, null, 2));
    console.log('PASS: two-client ordinary invincibility, same tick boost, nonstacking/duplicate refusal, real10s expiry and persistent restart');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
