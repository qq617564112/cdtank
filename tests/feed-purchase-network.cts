import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {ReqShop} from '../apps/shared/protocols/PtlShop';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';

/** Consume the actual received notification through the source CAS runtime. */
function finiteEffect(event: MsgRoomEvent): {drawNodes: number[]; expired: boolean} {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
    camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
    const runtime = new EffectRuntime(scene, camera);
    const loaded = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
      instances: {handle: number}[]};
    loaded.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
    const drawNodes = [2664, 2665, 2667, 2830, 2834];
    for (const grid of loaded.library.textureGrids.filter(grid => drawNodes.includes(grid.node))) {
      if (!loaded.textures.has(grid.asset)) loaded.textures.set(grid.asset,
        RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
    }
    const root = new TransformNode('received-event-actor', scene);
    const view = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? EFFECT_IDENTITY : undefined} as unknown as TankView;
    const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
    const notifications = createSkillEffectNotifications(runtime, catalog, {role: () => view, localRole: () => view});
    runtime.start(); new BattleSkillEffects(notifications).event(event);
    assert.equal(loaded.instances.length, 1);
    const rendered = new Set<number>();
    for (let tick = 0; tick < 200 && loaded.instances.length; tick++) {
      runtime.update(.025);
      for (const mesh of scene.meshes) if (mesh.isEnabled() && mesh.getTotalVertices() > 0) rendered.add(mesh.metadata.sourceNode);
    }
    assert.deepEqual([...rendered].sort((a, b) => a - b), drawNodes);
    assert.equal(loaded.instances.length, 0); assert.equal(scene.meshes.length, 0);
    assert.equal(notifications.records.length, 0);
    return {drawNodes, expired: true};
  } finally {scene.dispose(); engine.dispose();}
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-feed-purchase-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const accounts = [seed.open(), seed.open(), seed.open(), seed.open()];
  const evidence: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
  const pair = readOwnedRolePairMessage(new Uint8Array(evidence.rows[0].raw), evidence.rows[0].alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  const base = {name: 'Feed acceptance pet', fields: new Map(pair.base.fields)};
  base.fields.set(0, 71001); base.fields.set(8, 1);
  for (let index = 0; index < 6; index++) {base.fields.set(0x44 + index * 4, 0); base.fields.set(0x5c + index * 4, 0);}
  const equipment = {name: 'Feed acceptance tank', fields: new Map(pair.equipment.fields)};
  for (const [offset, value] of [[0x1c, 71002], [0x24, 1], [0x28, 0], [0x2c, 0], [0x30, 0],
    [0x58, 0], [0x5c, 0], [0x60, 0], [0x6c, 3]]) equipment.fields.set(offset, value);
  for (const [index, account] of accounts.entries()) {
    assert.deepEqual(seed.inventory(account.accountId).records, []);
    if (index === 3) continue;
    seed.replaceRoleRecords(account.accountId, {base: [base], equipment: [equipment]});
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setUint32(0xa4, 71001, true); view.setUint32(0xa8, 71002, true);
    view.setUint32(0x70, index === 2 ? 9 : 1000, true); view.setUint32(0x74, index === 2 ? 9 : 1000, true);
    seed.replaceRoleProfile(account.accountId, {bytes, strings: [account.accountId, 'Feed acceptance pet']});
  }
  seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = accounts.map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3160', logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const events: MsgRoomEvent[][] = accounts.map(() => []);
  const ticks = accounts.map(() => new Map<number, MsgRoomSnapshot>());
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index] = snapshot; ticks[index].set(snapshot.tick, snapshot);
      if (ticks[index].size > 200) ticks[index].delete(ticks[index].keys().next().value!);});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  async function wait(check: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; server log: ${log.slice(-1500)}`);
  }
  async function start(): Promise<void> {
    log = ''; snapshots.length = 0;
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3160', ACCOUNT_DB_PATH: database};
    delete environment.MATCH_TIME_LIMIT_SECONDS; delete environment.MATCH_MIN_PLAYERS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', value => {log += String(value);}); server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started') || server!.exitCode !== null);
    assert(log.includes('Server started'), log);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve())); server.kill(); await ended;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [index, account] of accounts.entries()) assert((await clients[index].callApi('Account', {token: account.token})).isSucc);
  }
  async function state(index = 0) {
    const inventory = await clients[index].callApi('Inventory', {}), profile = await clients[index].callApi('RoleProfile', {});
    assert(inventory.isSucc && profile.isSucc); return {inventory: inventory.res, profile: profile.res};
  }
  const buy: ReqShop = {operation: 'BUY', itemTableId: 1, quantity: 3, currency: 'MONEY', requestId: 'feed-money-0001'};
  const tokenBuy: ReqShop = {...buy, currency: 'TOKENS', requestId: 'feed-token-0001'};
  async function reject(index: number, request: ReqShop): Promise<void> {
    const before = await state(index); assert(!(await clients[index].callApi('Shop', request)).isSucc);
    assert.deepEqual(await state(index), before, 'Rejection preserves profile balance, stock and slots');
  }
  try {
    await start();
    assert(!(await clients[0].callApi('Shop', {operation: 'QUERY'})).isSucc);
    assert(!(await clients[0].callApi('Shop', buy)).isSucc);
    await authenticate();
    const initial = await state(), observerBefore = await state(1);
    const query = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(query.isSucc);
    assert.equal(query.res.items[0].itemTableId, 1); assert.equal(query.res.items[0].moneyPrice, 10); assert.equal(query.res.items[0].tokenPrice, 10);
    assert.equal(query.res.money, 1000); assert.equal(query.res.tokens, 1000);
    await reject(3, buy);
    for (const currency of ['MONEY', 'TOKENS'] as const) await reject(2, {...buy, quantity: 1, currency});
    for (const quantity of [0, -1, 11, 1.5]) await reject(0, {...buy, quantity});
    for (const itemTableId of [0, 999999]) await reject(0, {...buy, itemTableId});
    for (const requestId of ['short', 'bad space id', 'x'.repeat(81)]) await reject(0, {...buy, requestId});
    const moneyPurchase = await clients[0].callApi('Shop', buy); assert(moneyPurchase.isSucc && moneyPurchase.res.purchased);
    const instanceId = moneyPurchase.res.purchased.instanceId;
    assert(instanceId > 0); assert.equal(moneyPurchase.res.purchased.itemTableId, 1);
    assert.equal(moneyPurchase.res.purchased.ownedQuantity, 3); assert.equal(moneyPurchase.res.money, 970); assert.equal(moneyPurchase.res.tokens, 1000);
    const moneyState = await state();
    const replay = await clients[0].callApi('Shop', buy); assert(replay.isSucc && replay.res.replayed);
    assert.equal(replay.res.purchased?.instanceId, instanceId); assert.deepEqual(await state(), moneyState);
    await reject(0, {...buy, quantity: 2}); await reject(0, {...buy, currency: 'TOKENS'});
    const tokenPurchase = await clients[1].callApi('Shop', tokenBuy); assert(tokenPurchase.isSucc && tokenPurchase.res.purchased);
    assert.equal(tokenPurchase.res.money, 1000); assert.equal(tokenPurchase.res.tokens, 970);
    assert.equal(tokenPurchase.res.purchased.itemTableId, 1); assert.equal(tokenPurchase.res.purchased.ownedQuantity, 3);
    assert.deepEqual(await state(), moneyState, 'Token purchase in another account preserves owner stock and money');
    assert.equal((await state(1)).inventory.records.length, 1);
    assert.deepEqual((await state(2)).inventory.records, []); assert.deepEqual((await state(3)).inventory.records, []);
    const assigned = await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 4}); assert(assigned.isSucc);
    assert.equal(assigned.res.hotkeys[3], instanceId);
    assert((await clients[1].callApi('Kitbag', {operation: 'ASSIGN', instanceId: tokenPurchase.res.purchased.instanceId, slot: 4})).isSucc);
    const room = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Purchased feed acceptance', name: 'Owner', tankId: 1}); assert(room.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: room.res.room.id, clientId: 'feed-purchase-observer', name: 'Observer', tankId: 1}); assert(guest.isSucc);
    for (let index = 0; index < 3; index++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    const casts: object[] = [];
    for (let round = 1; round <= 2; round++) {
      for (const client of clients.slice(0, 2)) assert((await client.callApi('Ready', {round})).isSucc);
      await wait(() => snapshots[0]?.phase === 'PLAYING' && snapshots[0]?.match?.round === round);
      console.log(`Round ${round}: ordinary Ready complete, waiting for natural CPU injury`);
      await reject(0, {...buy, requestId: `feed-playing-${round}`});
      const player = () => snapshots[0]?.players.find(value => value.id === room.res.playerId);
      await wait(() => player()?.alive === true && player()!.hp < player()!.maxHp, 120000);
      const injured = structuredClone(player()!);
      const usedBefore: number = events[0].filter((event: MsgRoomEvent): boolean => event.type === 'itemUsed' && event.playerId === room.res.playerId).length;
      const sequence = round * 100;
      assert((await clients[0].sendMsg('PlayerInput', {sequence, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
      await wait(() => events.slice(0, 2).every(stream => stream.filter(event => event.type === 'itemUsed' && event.playerId === room.res.playerId).length === usedBefore + 1));
      const received: MsgRoomEvent[] = events.slice(0, 2).map((stream: MsgRoomEvent[]): MsgRoomEvent => stream.filter((event: MsgRoomEvent): boolean => event.type === 'itemUsed' && event.playerId === room.res.playerId).at(-1)!);
      assert.deepEqual(received[0], received[1]);
      assert.equal(received[0].skillId, 1); assert.equal(received[0].playSkillEffect?.skillId, 1);
      assert.equal(received[0].playSkillEffect?.effectIndex, 0); assert.equal(received[0].playSkillEffect?.duration, 0);
      assert(received[0].value > 0, 'Actual cast restores HP after natural CPU injury');
      const current = await state();
      assert.equal(current.inventory.records[0].ownedQuantity, 3 - round); assert.equal(current.inventory.records[0].battleQuantity, 3 - round);
      const castTick = snapshots[0]!.tick;
      await wait(() => [...ticks[0].keys()].some(tick => tick > castTick && ticks[1].has(tick)));
      const pairedTick = [...ticks[0].keys()].reverse().find(tick => tick > castTick && ticks[1].has(tick))!;
      assert.deepEqual(ticks[0].get(pairedTick)!.players, ticks[1].get(pairedTick)!.players);
      const effects = received.map(finiteEffect);
      assert((await clients[0].sendMsg('PlayerInput', {sequence, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: Date.now()})).isSucc);
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.equal(events[0].filter(event => event.type === 'itemUsed' && event.playerId === room.res.playerId).length, usedBefore + 1);
      assert.equal((await state()).inventory.records[0].ownedQuantity, 3 - round);
      casts.push({round, injured, event: received[0], pairedTick, effects});
      if (round === 1) {
        console.log('Round 1: purchased feed healed; waiting for ordinary match settlement');
        await wait(() => snapshots[0]?.phase === 'FINISHED', 660000);
        assert(['TIME_LIMIT', 'OBJECTIVE'].includes(snapshots[0]!.match!.result!.reason));
        for (const client of clients.slice(0, 2)) assert((await client.callApi('Rematch', {round})).isSucc);
        await wait(() => snapshots[0]?.phase === 'PLAYING' && snapshots[0]?.match?.round === 2);
      }
    }
    console.log('Round 2: purchased feed healed; waiting for ordinary match settlement');
    await wait(() => snapshots[0]?.phase === 'FINISHED', 660000);
    assert(['TIME_LIMIT', 'OBJECTIVE'].includes(snapshots[0]!.match!.result!.reason));
    const persisted = await state(), observerPersisted = await state(1);
    // Battle quantities are room projections; the stored records retain zero outside a room.
    for (const accountState of [persisted, observerPersisted]) {
      for (const record of accountState.inventory.records) record.battleQuantity = 0;
    }
    await stop(); await start();
    assert(!(await clients[0].callApi('Shop', buy)).isSucc);
    await authenticate();
    assert.deepEqual(await state(), persisted); assert.deepEqual(await state(1), observerPersisted);
    assert.equal(persisted.inventory.hotkeys[3], instanceId); assert.equal(persisted.inventory.records[0].ownedQuantity, 1);
    const restartReplay = await clients[0].callApi('Shop', buy); assert(restartReplay.isSucc && restartReplay.res.replayed);
    assert.equal(restartReplay.res.purchased?.instanceId, instanceId); assert.deepEqual(await state(), persisted);
    const tokenReplay = await clients[1].callApi('Shop', tokenBuy); assert(tokenReplay.isSucc && tokenReplay.res.replayed);
    assert.deepEqual(await state(1), observerPersisted); await reject(0, {...buy, quantity: 2});
    const restartedQuery = await clients[0].callApi('Shop', {operation: 'QUERY'}); assert(restartedQuery.isSucc);
    assert.equal(restartedQuery.res.money, 970); assert.equal(restartedQuery.res.tokens, 1000);
    assert.deepEqual((await state(2)).inventory.records, []); assert.deepEqual((await state(3)).inventory.records, []);
    writeFileSync('recovery/output/feed-purchase-network.json', JSON.stringify({status: 'PASS', port: 3160,
      scope: 'Isolated real TSRPC service and SQLite; explicitly imported role/profile balances, zero initial inventory; ordinary purchase/Kitbag/Ready/CPU/input/rematch; natural injury and settlement; same event and tick on two clients; received notifications run through finite source CAS runtime; actual service restart.',
      initial, observerBefore, query: query.res, moneyPurchase: moneyPurchase.res, tokenPurchase: tokenPurchase.res,
      unauthenticatedRejected: true, missingProfileRejected: true, insufficientBalancesRejected: true,
      invalidRequestsRejected: true, playingRejected: true, replayNoDuplicate: true, conflictingReplayRejected: true,
      naturalTwoRounds: true, casts, persisted, observerPersisted, restartReplayPersisted: true, accountIsolation: true}, null, 2));
    console.log('PASS: purchased feed money/tokens, natural two-round healing, finite CAS, two-client agreement, replay ledger and actual restart persistence');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
