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
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-team-life-ai-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database), account = seed.open(), observer = seed.open();
  seed.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 501, ownedQuantity: 1,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  seed.assign(account.accountId, 77, 4); seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3185', logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const ticks = [new Map<number, MsgRoomSnapshot>(), new Map<number, MsgRoomSnapshot>()];
  const events: MsgRoomEvent[][] = [[], []];
  const receivedAtTicks = [new Map<MsgRoomEvent, number>(), new Map<MsgRoomEvent, number>()];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', value => {snapshots[index] = value; ticks[index].set(value.tick, value);});
    client.listenMsg('RoomEvent', value => {events[index].push(value);
      receivedAtTicks[index].set(value, snapshots[index]?.tick ?? -1);});
  });
  async function wait(check: () => boolean, timeout = 15000): Promise<void> {
    const until = Date.now() + timeout;
    while (!check() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), JSON.stringify({log: log.slice(-1000), snapshots, eventCounts: events.map(stream => stream.reduce<Record<string, number>>((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1; return counts;
    }, {}))}));
  }
  async function start(): Promise<void> {
    log = '';
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3185', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);}); server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started'));
    for (const client of clients) assert((await client.connect()).isSucc);
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
  }
  try {
    await start();
    const joined = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7, roomName: 'Team life AI', name: 'Owner', tankId: 1});
    assert(joined.isSucc);
    const guest = await clients[1].callApi('Join', {clientId: 'team-life-ai-observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id});
    assert(guest.isSucc);
    for (let i = 0; i < 3; i++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: true})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.length === 2 && snapshots.every(value => value?.phase === 'PLAYING'));
    const owner = (snapshot: MsgRoomSnapshot) => snapshot.players.find(p => p.id === joined.res.playerId)!;
    const initial = snapshots[0]!, team = owner(initial).team, initialLives = [...initial.match!.teamLives];
    assert(owner(initial).isAutopilot); assert(initial.players.some(p => p.isCpu && p.team !== team));
    assert(!owner(initial).isCpu); assert(!initial.players.find(p => p.id === guest.res.playerId)!.isAutopilot);
    const beforeInventory = await clients[0].callApi('Inventory', {}); assert(beforeInventory.isSucc);
    assert.equal(beforeInventory.res.records[0].ownedQuantity, 1);
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1000, move: -1, turn: 1, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
    const usedByOwner = (stream: MsgRoomEvent[]) => stream.filter(e => e.type === 'itemUsed' && e.playerId === joined.res.playerId);
    await wait(() => events.every(stream => usedByOwner(stream).length > 0), 150000);
    const used = usedByOwner(events[0])[0]; assert.deepEqual(usedByOwner(events[1])[0], used);
    const castTicks = events.map((stream, index) => receivedAtTicks[index].get(usedByOwner(stream)[0])!);
    assert.equal(castTicks[0], castTicks[1]);
    assert.equal(used.skillId, 501); assert.equal(used.value, 1); assert.equal(used.playSkillEffect?.skillId, 501);
    const previous = events[0].slice(0, events[0].indexOf(used));
    const teamDeaths = previous.filter(e => e.type === 'destroy'
      && initial.players.find(p => p.id === e.targetId)!.team === team);
    const naturalHits = previous.filter(e => e.type === 'hit');
    assert(teamDeaths.length > 0 && naturalHits.length > 0, 'Automatic501 follows actual projectile team death');
    const expected = [...initialLives];
    for (const event of previous) if (event.type === 'destroy') expected[initial.players.find(p => p.id === event.targetId)!.team]--;
    assert(expected.every(value => value > 0)); assert(expected[team] < initialLives[team]); expected[team]++;
    const common = () => [...ticks[0].keys()].find(tick => ticks[1].has(tick)
      && ticks[0].get(tick)!.match!.teamLives.every((value, index) => value === expected[index])
      && owner(ticks[0].get(tick)!).isAutopilot
      && tick === castTicks[0]);
    await wait(() => common() !== undefined);
    const pairedTick = common()!, paired = ticks[0].get(pairedTick)!;
    assert.deepEqual(paired.match!.teamLives, ticks[1].get(pairedTick)!.match!.teamLives);
    assert.deepEqual(paired.players, ticks[1].get(pairedTick)!.players);
    const inventory = await clients[0].callApi('Inventory', {}); assert(inventory.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 0); assert.equal(inventory.res.records[0].battleQuantity, 0);
    await wait(() => snapshots.every(s => s!.tick > pairedTick + 6));
    assert(events.every(stream => usedByOwner(stream).length === 1));
    assert((await clients[0].callApi('Autopilot', {round: 1, enabled: false})).isSucc);
    await wait(() => snapshots.every(s => !owner(s!).isAutopilot && owner(s!).alive));
    const before = owner(snapshots[0]!);
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 1, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    await wait(() => {const p = owner(snapshots[0]!); return Math.hypot(p.x - before.x, p.z - before.z) > .0001;});
    const manualRecovered = owner(snapshots[0]!); assert(!manualRecovered.isAutopilot);
    assert(events.every(stream => usedByOwner(stream).length === 1 && !stream.some(e => e.type === 'itemRejected')));
    await stop(); await start();
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    assert(persisted.isSucc && isolated.isSucc);
    assert.equal(persisted.res.records[0].itemTableId, 501); assert.equal(persisted.res.records[0].ownedQuantity, 0);
    assert.equal(persisted.res.records[0].battleQuantity, 0); assert.equal(persisted.res.records[0].float24Bits, 0x7fc01234);
    assert.equal(persisted.res.hotkeys[3], 77); assert.deepEqual(isolated.res.records, []);
    writeFileSync('recovery/output/team-life-ai-network.json', JSON.stringify({status: 'PASS', port: 3185, used,
      initialLives, afterCastLives: expected, team, castTicks, pairedTick, pairedLives: paired.match!.teamLives, teamDeaths, naturalHits,
      initialOwner: owner(initial), castOwner: owner(paired), manualRecovery: {before, after: manualRecovered},
      inventory: inventory.res, persisted: persisted.res, observer: isolated.res,
      scope: 'Real isolated TSRPC3185/two accounts, ordinary mode1/map7/Cpu/Autopilot/Ready APIs, actual projectiles and team death before automatic501, same accepted event and common snapshot tick, finite one-item stock, manual high-sequence isolation and sequence1 movement recovery, real child-server kill/start and account isolation. Rebuilt AI eligibility; no battle-state writes.'}, null, 2));
    console.log('PASS: :3185 autonomous501 after natural team death, same two-client event/tick, finite stock, manual recovery and real persistent restart');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
