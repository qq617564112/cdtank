import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS} from '../apps/server/src/config';

const attackDrink = process.argv.includes('--attack-drink');
const definitionId = attackDrink ? 4 : 1;
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {WorldEvent} from '../apps/server/src/world';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-autopilot-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: definitionId, ownedQuantity: 1,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0x80000000, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4); seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3139', logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const events: WorldEvent[][] = [[], []];
  const ticks = [new Map<number, MsgRoomSnapshot>(), new Map<number, MsgRoomSnapshot>()];
  let pairedTick: number | undefined;
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', value => {snapshots[index] = value; ticks[index].set(value.tick, value);});
    client.listenMsg('RoomEvent', value => {events[index].push(value);});
  });
  async function wait(check: () => boolean, timeout = 5000): Promise<void> {
    const until = Date.now() + timeout;
    while (!check() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; server log: ${log.slice(-1500)}`);
  }
  async function start(): Promise<void> {
    log = '';
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: '3139', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
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
    assert(!(await clients[1].callApi('Autopilot', {round: 2, enabled: true})).isSucc);
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: true})).isSucc);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]?.phase === 'PLAYING');
    // The owner AI and CPUs emit ordinary input. The other account observes.
    await wait(() => snapshots[0]!.players.find(p => p.id === joined.res.playerId)!.isAutopilot === true);
    await clients[0].sendMsg('PlayerInput', {sequence: 1000, move: -1, turn: 1, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()});
    await wait(() => events.every(stream => stream.some(e => e.type === 'itemUsed' && e.playerId === joined.res.playerId)), 120000);
    const used = events[0].find(e => e.type === 'itemUsed')!;
    if (!attackDrink) assert(events[0].some(e => e.type === 'hit' && e.targetId === joined.res.playerId));
    if (attackDrink) {
      const attack = TANKS.find(tank => tank.id === 1)!.attack;
      await wait(() => events.every(stream => stream.some(event => event.type === 'hit'
        && event.playerId === joined.res.playerId && event.value === 35 + (attack * 2 + 20) * .08)), 15000);
    }
    assert(events[0].some(e => e.type === 'fire' && e.playerId === joined.res.playerId));
    assert(!snapshots[1]!.players.find(p => p.id === guest.res.playerId)!.isAutopilot);
    if (attackDrink) {
      const common = () => [...ticks[0].keys()].find(tick => ticks[1].has(tick)
        && ticks[0].get(tick)!.players.find(player => player.id === joined.res.playerId)?.attackBoost);
      await wait(() => common() !== undefined);
      pairedTick = common()!;
      assert.deepEqual(ticks[0].get(pairedTick)!.players, ticks[1].get(pairedTick)!.players);
    }
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: false})).isSucc);
    await wait(() => !snapshots[0]!.players.find(p => p.id === joined.res.playerId)!.isAutopilot);
    const before = snapshots[0]!.players.find(p => p.id === joined.res.playerId)!;
    await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 1, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: Date.now()});
    await wait(() => {const p = snapshots[0]!.players.find(p => p.id === joined.res.playerId)!;return Math.hypot(p.x - before.x, p.z - before.z) > 1;});
    assert.deepEqual(events[1].find(e => e.type === 'itemUsed'), used, 'Two independent clients receive the same actual cast/effect event');
    assert.equal(used.skillId, definitionId); assert.equal(used.playSkillEffect?.effectIndex, 0);
    const inventory = await clients[0].callApi('Inventory', {});
    assert(inventory.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 0);
    assert.equal(inventory.res.records[0].battleQuantity, 0);
    await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: Date.now()});
    await stop(); await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && isolated.isSucc);
    assert.equal(persisted.res.records[0].ownedQuantity, 0);
    assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234);
    assert.equal(persisted.res.hotkeys[3], 77);
    assert.deepEqual(isolated.res.records, []);
    writeFileSync(`recovery/output/${attackDrink ? 'attack-drink-ai' : 'account-autopilot'}-network.json`, JSON.stringify({status: 'PASS',
      definitionId, attackDrink, pairedTick, enhancedHit: attackDrink ? events[0].find(event => event.type === 'hit' && event.playerId === joined.res.playerId && event.value === 35 + (TANKS.find(tank => tank.id === 1)!.attack * 2 + 20) * .08) : undefined,
      scope: 'Actual isolated TSRPC server3139/two clients, normal account/room/CPU/Autopilot/Ready/input, natural AI movement/fire/injury, manual isolation and resume, source healing effect notification, persisted consumption/server restart/isolation. No browser pixel/audio or original server rules proved.', used, inventory: inventory.res, persisted: persisted.res}, null, 2));
    console.log(`PASS: live two-client owned AI ${attackDrink ? 'attack drink/enhanced hit' : 'healing'}, input isolation/resume and cast/effect, persistent quantity, server restart and account isolation`);
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
