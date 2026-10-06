import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS} from '../apps/server/src/config';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-defense-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database), account = seed.open(), observer = seed.open();
  assert.deepEqual(seed.inventory(account.accountId).records, []);
  assert.deepEqual(seed.inventory(observer.accountId).records, []);
  const row = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
    .find((value: {tankId: number; part: number}) => value.tankId === 1 && value.part === 0);
  const fields = (source: Record<string, number>) => new Map(Object.entries(source).map(([key, value]) => [Number(key), value]));
  const equipment = {name: 'Explicit imported tank', fields: fields(row.equipment)}; equipment.fields.set(0x24, 1);
  seed.replaceRoleRecords(account.accountId, {base: [{name: 'Explicit imported pet', fields: fields(row.base)}], equipment: [equipment]});
  const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
  view.setUint32(0xa4, row.base['0'], true); view.setUint32(0xa8, equipment.fields.get(0x1c)!, true);
  view.setUint32(0x70, 1000, true); view.setUint32(0x74, 1000, true);
  seed.replaceRoleProfile(account.accountId, {bytes, strings: [account.accountId, 'Defense acceptance pet']}); seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3165', logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [], ticks = [new Map<number, MsgRoomSnapshot>(), new Map<number, MsgRoomSnapshot>()];
  const events: MsgRoomEvent[][] = [[], []];
  const hitSamples: {event: MsgRoomEvent; serverTime?: number; tick?: number; targetHp?: number; boost?: object}[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', value => {snapshots[index] = value; ticks[index].set(value.tick, value);
      if (ticks[index].size > 300) ticks[index].delete(ticks[index].keys().next().value!);});
    client.listenMsg('RoomEvent', value => {events[index].push(value);
      if (value.type === 'hit') {
        const target = snapshots[index]?.players.find(player => player.id === value.targetId);
        hitSamples[index].push({event: value, serverTime: snapshots[index]?.serverTime, tick: snapshots[index]?.tick,
          targetHp: target?.hp, boost: target?.defenseBoost && {...target.defenseBoost}});
      }
    });
  });
  async function wait(check: () => boolean, timeout = 15000): Promise<void> {
    const until = Date.now() + timeout;
    while (!check() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; snapshots: ${JSON.stringify(snapshots[0]?.players)}; recent events: ${JSON.stringify(events.map(stream => stream.filter(event => event.targetId === 'P1')))}; server log: ${log.slice(-500)}`);
  }
  async function start(): Promise<void> {
    log = ''; snapshots.length = 0; ticks.forEach(stream => stream.clear());
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3165', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);}); server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started') || server!.exitCode !== null); assert(log.includes('Server started'), log);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve())); server.kill(); await ended;
    }
  }
  async function authenticate(): Promise<void> {
    assert((await clients[0].callApi('Account', {token: account.token})).isSucc);
    assert((await clients[1].callApi('Account', {token: observer.token})).isSucc);
  }
  try {
    await start(); await authenticate();
    const query = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(query.isSucc);
    const item = query.res.items.find(value => value.itemTableId === 5)!;
    assert(item); assert.equal(item.moneyPrice, 20); assert.equal(item.tokenPrice, 20);
    const purchaseRequest = {operation: 'BUY' as const, itemTableId: 5, quantity: 3,
      currency: 'MONEY' as const, requestId: 'defense-three'};
    const purchase = await clients[0].callApi('Shop', purchaseRequest); assert(purchase.isSucc && purchase.res.purchased);
    assert.equal(purchase.res.money, 940); assert.equal(purchase.res.tokens, 1000);
    assert.equal(purchase.res.purchased.ownedQuantity, 3);
    const instanceId = purchase.res.purchased.instanceId;
    const joined = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Defense drink', name: 'Owner', tankId: 1}); assert(joined.isSucc);
    assert((await clients[1].callApi('Join', {clientId: 'defense-observer', name: 'Observer', tankId: 1, roomId: joined.res.room.id})).isSucc);
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 4})).isSucc);
    for (let index = 0; index < 3; index++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots.length === 2 && snapshots.every(value => value?.phase === 'PLAYING'));
    const player = () => snapshots[0]?.players.find(value => value.id === joined.res.playerId);
    console.log('Defense network: waiting for natural CPU injury');
    await wait(() => player()?.alive === true && player()!.hp < player()!.maxHp, 120000);
    const injured = structuredClone(player()!); console.log('Defense network: ordinary manual cast');
    const send = (sequence: number) => clients[0].sendMsg('PlayerInput', {sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: Date.now()});
    assert((await send(1)).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId)));
    const used = events[0].find(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId)!;
    assert.deepEqual(events[1].find(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId), used);
    assert.equal(used.skillId, 5); assert.equal(used.playSkillEffect?.skillId, 5);
    assert.equal(used.playSkillEffect?.effectIndex, 0); assert.equal(used.playSkillEffect?.duration, 0);
    await wait(() => !!player()?.defenseBoost); const active = structuredClone(player()!.defenseBoost!);
    assert.equal(active.source, 'original-attributes'); assert.equal(active.defensePercent, 30); assert.equal(active.defenseBonus, 20);
    const common = () => [...ticks[0].keys()].find(tick => ticks[0].get(tick)!.players.some(value => value.id === joined.res.playerId && value.defenseBoost)
      && ticks[1].has(tick));
    await wait(() => common() !== undefined); const pairedTick = common()!;
    assert.deepEqual(ticks[0].get(pairedTick)!.players, ticks[1].get(pairedTick)!.players);
    assert((await send(1)).isSucc); assert((await send(2)).isSucc);
    await wait(() => events.every(stream => stream.some(event => event.type === 'itemRejected' && event.playerId === joined.res.playerId)));
    assert(events.every(stream => stream.filter(event => event.type === 'itemUsed' && event.playerId === joined.res.playerId).length === 1));
    const inventory = await clients[0].callApi('Inventory', {}); assert(inventory.isSucc);
    assert.equal(inventory.res.records[0].ownedQuantity, 2); assert.equal(inventory.res.records[0].battleQuantity, 2);
    const raw = 35 + TANKS.find(tank => tank.id === 1)!.attack * .08;
    const expectedDamage = raw * Math.max(0, Math.min(1, (100 + active.baseDefense) / (100 + active.boostedDefense)));
    console.log('Defense network: waiting for reduced projectile hit');
    await wait(() => events.every(stream => stream.some(event => event.type === 'hit' && event.targetId === joined.res.playerId
      && Math.abs(event.value - expectedDamage) < 1e-9)), 12000);
    const reducedHit = events[0].find(event => event.type === 'hit' && event.targetId === joined.res.playerId
      && Math.abs(event.value - expectedDamage) < 1e-9)!;
    assert(expectedDamage < raw);
    assert.deepEqual(events[1].find(event => event.type === 'hit' && event.targetId === joined.res.playerId
      && Math.abs(event.value - expectedDamage) < 1e-9), reducedHit);
    await wait(() => snapshots.every(value => !value?.players.find(value => value.id === joined.res.playerId)?.defenseBoost)
      && events.every(stream => stream.some(event => (event.stopSkillEffect?.skillId === 5 && event.playerId === joined.res.playerId)
        || (event.type === 'destroy' && event.targetId === joined.res.playerId))));
    const stoppedAt = snapshots[0]!.serverTime;
    // A natural death may end the buff before its deadline; both paths remove it.
    assert(stoppedAt <= active.expiresAt + 1000);
    await wait(() => events.every(stream => stream.some(event => event.type === 'hit' && event.targetId === joined.res.playerId
      && event.value === raw && stream.indexOf(event) > stream.findIndex(value => (value.stopSkillEffect?.skillId === 5 && value.playerId === joined.res.playerId)
        || (value.type === 'destroy' && value.targetId === joined.res.playerId)))), 60000);
    const reducedHitSamples = hitSamples.map(stream => stream.find(sample => sample.event.targetId === joined.res.playerId
      && Math.abs(sample.event.value - expectedDamage) < 1e-9)!);
    assert(reducedHitSamples.every(sample => sample.serverTime! < active.expiresAt));
    const restoredHitSamples = hitSamples.map(stream => stream.find(sample => sample.event.targetId === joined.res.playerId
      && sample.event.value === raw && sample.serverTime! >= stoppedAt)!);
    assert(restoredHitSamples.every(Boolean));
    assert.deepEqual(restoredHitSamples[0].event, restoredHitSamples[1].event);
    const profile = await clients[0].callApi('RoleProfile', {}); assert(profile.isSucc);
    const persistedBefore = await clients[0].callApi('Inventory', {}); assert(persistedBefore.isSucc);
    for (const record of persistedBefore.res.records) record.battleQuantity = 0;
    await stop(); await start(); await authenticate();
    const persisted = await clients[0].callApi('Inventory', {}), isolated = await clients[1].callApi('Inventory', {});
    const restartedProfile = await clients[0].callApi('RoleProfile', {});
    assert(persisted.isSucc && isolated.isSucc && restartedProfile.isSucc);
    assert.deepEqual(persisted.res, persistedBefore.res); assert.deepEqual(restartedProfile.res, profile.res);
    assert.equal(persisted.res.hotkeys[3], instanceId); assert.deepEqual(isolated.res.records, []);
    const replay = await clients[0].callApi('Shop', purchaseRequest); assert(replay.isSucc && replay.res.replayed);
    assert.equal(replay.res.money, 940); assert.equal(replay.res.tokens, 1000);
    const afterReplay = await clients[0].callApi('Inventory', {}); assert(afterReplay.isSucc); assert.deepEqual(afterReplay.res, persisted.res);
    writeFileSync('recovery/output/defense-drink-network.json', JSON.stringify({status: 'PASS', port: 3165,
      query: query.res, purchase: purchase.res, injured, used, active, pairedTick, reducedHit, raw, expectedDamage,
      stoppedAt, reducedHitSamples, restoredHitSamples, persisted: persisted.res, profile: profile.res, accountIsolation: true, purchaseReplayAfterRestart: true,
      scope: 'Actual isolated TSRPC/SQLite, initial empty inventory and imported owned profile/balances, source20/20 BUY5, WAITING Kitbag4 and manual Digit5, natural CPU injury/projectile hits, exact rebuilt mitigation and later raw hit, paired event/snapshot/first-slot notification, finite nonstacking, actual server restart, durable receipt and account isolation.'}, null, 2));
    console.log('PASS: defense5 purchase/Kitbag/manual input, paired exact reduced hit, finite stock and actual restart');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
