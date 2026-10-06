import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-speed-drink-ai-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 6, ownedQuantity: 1,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4);
  const row = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
    .find((row: {tankId: number; part: number}) => row.tankId === 1 && row.part === 0);
  const fields = (source: Record<string, number>) => new Map(Object.entries(source).map(([key, value]) => [Number(key), value]));
  const equipment = {name: 'Explicit imported tank', fields: fields(row.equipment)};
  equipment.fields.set(0x24, 1);
  seed.replaceRoleRecords(account.accountId, {base: [{name: 'Explicit imported pet', fields: fields(row.base)}], equipment: [equipment]});
  const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
  view.setUint32(0xa4, row.base['0'], true); view.setUint32(0xa8, equipment.fields.get(0x1c)!, true);
  seed.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
  seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3150', logger: undefined}));
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
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3150', ACCOUNT_DB_PATH: database};
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
    const joined = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Speed drink AI', name: 'Owner', tankId: 1});
    assert(joined.isSucc);
    const guest = await clients[1].callApi('Join', {clientId: 'speed-ai-observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id});
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
    assert.equal(beforeInventory.res.records[0].itemTableId, 6);
    assert.equal(beforeInventory.res.hotkeys[3], 77);
    // Manual movement and item requests cannot replace the owner's autonomous input.
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1000, move: -1, turn: 1, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemUsed'
      && event.playerId === joined.res.playerId && event.skillId === 6)), 120000);
    const used = events[0].find(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId)!;
    assert.deepEqual(events[1].find(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId), used);
    assert.equal(used.skillId, 6);
    assert.equal(used.playSkillEffect?.skillId, 6);
    assert.equal(used.playSkillEffect?.effectIndex, 0);
    assert.equal(used.playSkillEffect?.duration, 0);
    const common = () => [...ticks[0].keys()].find(tick => ticks[1].has(tick)
      && owner(ticks[0].get(tick)!).speedBoost?.skillId === 6);
    await wait(() => common() !== undefined);
    const pairedTick = common()!;
    const paired = ticks[0].get(pairedTick)!;
    assert.deepEqual(paired.players, ticks[1].get(pairedTick)!.players);
    const active = owner(paired).speedBoost!;
    assert.equal(active.moveBonus, 6);
    assert(owner(paired).isAutopilot);
    assert(!paired.players.find(player => player.id === guest.res.playerId)!.isAutopilot);
    const moved = () => [...ticks[0].values()].find(snapshot => snapshot.tick > pairedTick
      && owner(snapshot).speedBoost?.skillId === 6 && owner(snapshot).alive
      && Math.hypot(owner(snapshot).x - owner(paired).x, owner(snapshot).z - owner(paired).z) > 1);
    await wait(() => moved() !== undefined);
    const movedSnapshot = moved()!;
    assert(owner(movedSnapshot).isAutopilot, 'Owner still moves autonomously after manual high sequence input');
    const inventory = await clients[0].callApi('Inventory', {});
    assert(inventory.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 0);
    assert.equal(inventory.res.records[0].battleQuantity, 0);
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed'
      && event.playerId === joined.res.playerId && event.skillId === 6).length === 1));
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: false})).isSucc);
    await wait(() => snapshots.every(snapshot => !owner(snapshot!).isAutopilot && owner(snapshot!).alive));
    const before = owner(snapshots[0]!);
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 1, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    await wait(() => {const player = owner(snapshots[0]!); return player.alive
      && Math.hypot(player.x - before.x, player.z - before.z) > 1;});
    const manualRecovered = owner(snapshots[0]!);
    assert(!manualRecovered.isAutopilot);
    await stop(); await start();
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && isolated.isSucc);
    assert.equal(persisted.res.records[0].itemTableId, 6);
    assert.equal(persisted.res.records[0].ownedQuantity, 0);
    assert.equal(persisted.res.records[0].battleQuantity, 0);
    assert.equal(persisted.res.records[0].float28Bits, 0);
    assert.equal(persisted.res.records[0].float2cBits, 0);
    assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234);
    assert.equal(persisted.res.hotkeys[3], 77); assert.deepEqual(isolated.res.records, []);
    writeFileSync('recovery/output/speed-drink-ai-network.json', JSON.stringify({status: 'PASS', used, active, pairedTick,
      autonomousMovement: {from: owner(paired), to: owner(movedSnapshot), tick: movedSnapshot.tick},
      manualRecovery: {before, after: manualRecovered}, inventory: inventory.res, persisted: persisted.res,
      scope: 'Real isolated TSRPC server3150/two clients, explicitly imported owned role records/profile, ordinary room7/mode4/three CPUs/owner autopilot/both Ready, autonomous speed6 cast/effect0, same event/tick, movement during buff, manual high sequence isolation and sequence1 recovery, quantity1 to0, real server restart and account isolation.'}, null, 2));
    console.log('PASS: autonomous two-client speed6 cast/effect0, same tick moveBonus6 and movement, manual input isolation/recovery, quantity1 to0 and real restart/account isolation');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
