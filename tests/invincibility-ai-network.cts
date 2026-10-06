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
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-invincibility-ai-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 8, ownedQuantity: 1,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4);
  seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3151', logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
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
    assert(check(), JSON.stringify({serverLog: log.slice(-1000), snapshots: snapshots.map(value => ({tick: value?.tick, phase: value?.phase, players: value?.players})), eventCounts: events.map(stream => stream.reduce<Record<string, number>>((counts, event) => {counts[event.type] = (counts[event.type] ?? 0) + 1; return counts;}, {}))}));
  }
  async function start(): Promise<void> {
    log = '';
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3151', ACCOUNT_DB_PATH: database};
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
    const joined = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Invincibility AI', name: 'Owner', tankId: 1});
    assert(joined.isSucc);
    const guest = await clients[1].callApi('Join', {clientId: 'invincibility-ai-observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id});
    assert(guest.isSucc);
    for (let index = 0; index < 3; index++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    assert(!(await clients[1].callApi('Autopilot', {round: 2, enabled: true})).isSucc);
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: true})).isSucc);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.every(value => value?.phase === 'PLAYING'));
    const owner = (snapshot: MsgRoomSnapshot) => snapshot.players.find(player => player.id === joined.res.playerId)!;
    await wait(() => snapshots.every(snapshot => owner(snapshot!).isAutopilot === true));
    const beforeInventory = await clients[0].callApi('Inventory', {});
    assert(beforeInventory.isSucc);
    assert.equal(beforeInventory.res.records[0].itemTableId, 8);
    assert.equal(beforeInventory.res.records[0].ownedQuantity, 1);
    assert.equal(beforeInventory.res.hotkeys[3], 77);
    const initial = snapshots[0]!;
    assert.equal(owner(initial).hp, owner(initial).maxHp);
    assert.equal(owner(initial).invincibility, undefined);
    // Manual requests cannot replace the autonomous defensive decision.
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1000, move: -1, turn: 1, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemUsed'
      && event.playerId === joined.res.playerId && event.skillId === 8)), 120000);
    const used = events[0].find(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId)!;
    assert.deepEqual(events[1].find(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId), used);
    assert.equal(used.skillId, 8);
    assert.equal(used.playSkillEffect?.skillId, 8);
    assert.equal(used.playSkillEffect?.effectIndex, 0);
    assert.equal(used.playSkillEffect?.duration, 10);
    const naturalHits = events[0].slice(0, events[0].indexOf(used))
      .filter(event => event.type === 'hit' && event.targetId === joined.res.playerId);
    assert(naturalHits.length > 0, 'Automatic cast follows natural projectile damage');
    const common = () => [...ticks[0].keys()].find(tick => ticks[1].has(tick)
      && owner(ticks[0].get(tick)!).invincibility?.skillId === 8);
    await wait(() => common() !== undefined);
    const pairedTick = common()!;
    const paired = ticks[0].get(pairedTick)!;
    assert.deepEqual(paired.players, ticks[1].get(pairedTick)!.players);
    const active = owner(paired).invincibility!;
    assert(owner(paired).isAutopilot && owner(paired).alive);
    assert(owner(paired).hp > 0 && owner(paired).hp <= owner(paired).maxHp * .5);
    assert(paired.players.some(player => player.alive && player.id !== joined.res.playerId
      && Math.hypot(player.x - owner(paired).x, player.z - owner(paired).z) <= 300));
    assert(!paired.players.find(player => player.id === guest.res.playerId)!.isAutopilot);
    const immune = () => events[0].find(event => event.type === 'immuneHit'
      && event.targetId === joined.res.playerId
      && paired.players.some(player => player.id === event.playerId && player.isCpu));
    await wait(() => immune() !== undefined, 15000);
    const immuneHit = immune()!;
    await wait(() => events[1].some(event => event.type === 'immuneHit'
      && event.targetId === joined.res.playerId && event.playerId === immuneHit.playerId));
    assert.deepEqual(events[1].find(event => event.type === 'immuneHit'
      && event.targetId === joined.res.playerId && event.playerId === immuneHit.playerId), immuneHit);
    assert.equal(immuneHit.value, 0);
    assert.equal(immuneHit.skillId, 8);
    // Observe the first common snapshot after the actual immune projectile event.
    const immuneAfterTick = snapshots[0]!.tick;
    const protectedTick = () => [...ticks[0].keys()].find(tick => tick > immuneAfterTick && ticks[1].has(tick)
      && owner(ticks[0].get(tick)!).invincibility?.expiresAt === active.expiresAt);
    await wait(() => protectedTick() !== undefined);
    const afterImmuneTick = protectedTick()!;
    for (const stream of ticks) {
      const protectedOwner = owner(stream.get(afterImmuneTick)!);
      assert.equal(protectedOwner.hp, owner(paired).hp, 'Real CPU hit cannot damage protected owner');
      assert.deepEqual(protectedOwner.invincibility, active, 'Repeated AI decisions must not stack or renew item8');
    }
    assert.deepEqual(ticks[0].get(afterImmuneTick)!.players, ticks[1].get(afterImmuneTick)!.players);
    const inventory = await clients[0].callApi('Inventory', {});
    assert(inventory.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 0);
    assert.equal(inventory.res.records[0].battleQuantity, 0);
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed'
      && event.playerId === joined.res.playerId && event.skillId === 8).length === 1));
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: false})).isSucc);
    await wait(() => snapshots.every(snapshot => !owner(snapshot!).isAutopilot));
    const before = owner(snapshots[0]!);
    assert(before.alive && before.invincibility, 'Resume manual input during immunity');
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 1, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    await wait(() => {const player = owner(snapshots[0]!); return !player.alive
      || Math.hypot(player.x - before.x, player.z - before.z) > .0001;});
    const manualRecovered = owner(snapshots[0]!);
    assert(!manualRecovered.isAutopilot);
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed'
      && event.playerId === joined.res.playerId && event.skillId === 8).length === 1));
    await stop(); await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && isolated.isSucc);
    assert.equal(persisted.res.records[0].itemTableId, 8);
    assert.equal(persisted.res.records[0].ownedQuantity, 0);
    assert.equal(persisted.res.records[0].battleQuantity, 0);
    assert.equal(persisted.res.records[0].float28Bits, 0);
    assert.equal(persisted.res.records[0].float2cBits, 0);
    assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234);
    assert.equal(persisted.res.hotkeys[3], 77); assert.deepEqual(isolated.res.records, []);
    writeFileSync('recovery/output/invincibility-ai-network.json', JSON.stringify({status: 'PASS', used, active,
      naturalHits, initialOwner: owner(initial), castOwner: owner(paired), pairedTick,
      immuneHit, afterImmuneTick, protectedOwner: owner(ticks[0].get(afterImmuneTick)!),
      manualRecovery: {before, after: manualRecovered}, inventory: inventory.res, persisted: persisted.res,
      scope: 'Real isolated TSRPC server3151/two clients, ordinary room7/mode4/three CPUs/owner autopilot/both Ready, natural damage before automatic item8 at half HP with nearby enemy, Play effect0 duration10, same event/tick immunity and real CPU immuneHit with unchanged HP, one consumption/no stacking or extra casts, high sequence manual isolation and sequence1 recovery, real server restart and account isolation.'}, null, 2));
    console.log('PASS: autonomous two-client invincibility8 after natural damage, same tick immunity, real CPU immune hit without HP loss, one consumption, manual sequence1 recovery and persistent restart/account isolation');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
