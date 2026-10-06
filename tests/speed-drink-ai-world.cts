import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World, type WorldEvent} from '../apps/server/src/world';
import {originalMovementParameters} from '../apps/server/src/battle/movement';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-speed-ai-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database), now = 100000;
const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
  .find((row: {tankId: number; part: number}) => row.tankId === 1 && row.part === 0);
const fields = (source: Record<string, number>) => new Map(Object.entries(source).map(([key, value]) => [Number(key), value]));
const owned = {base: {name: 'Explicit imported pet', fields: fields(native.base)},
  equipment: {name: 'Explicit imported tank', fields: fields(native.equipment)}};
// Private access observes actual accepted inputs, movement and cleanup only.
function actualPlayer(world: World, roomId: string, playerId: string): PlayerState {
  return (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(roomId)!.players.get(playerId)!;
}
try {
  const account = store.open();
  store.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 6, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  store.assign(account.accountId, 77, 4);
  let persistedConsumes = 0;
  const world: World = new World(() => now, {consumeItem: (id, instance, quantity, definition) => {
    assert.equal(id, owner.playerId); assert.equal(instance, 77); assert.equal(definition, 6);
    assert.equal(quantity, 3 - persistedConsumes);
    const accepted = store.consumeItem(account.accountId, instance, quantity, definition);
    assert(accepted); persistedConsumes++; return accepted;
  }});
  const owner = world.createAndJoin('speed-owned-ai', 4, 7, 'Owned speed AI', 'Owner', 1);
  world.bindRoleSources(owner.playerId, owned);
  world.bindInventory(owner.playerId, store.inventory(account.accountId));
  for (let i = 0; i < 3; i++) world.manageCpu(owner.playerId, 1, 'ADD', 1);
  world.ready(owner.playerId, 1, false);
  world.configureAutopilot(owner.playerId, 1, true);
  assert.equal(world.snapshot(owner.roomId)!.phase, 'WAITING');
  world.ready(owner.playerId, 1);
  const local = actualPlayer(world, owner.roomId, owner.playerId);
  const baseline = originalMovementParameters(local)!; assert(baseline);
  const ordinary = {sequence: 1000, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: now};
  assert.deepEqual(world.updateInput(owner.playerId, ordinary), [], 'AI control isolates manual item requests');
  const uses: WorldEvent[] = [], casts: object[] = [], rounds: object[] = [];
  let enhancedSteps = 0, sourceDistanceSteps = 0, deaths = 0, revivals = 0, stationaryInputs = 0, boostedDeaths = 0;
  for (let round = 1; round <= 2; round++) {
    if (round === 2) {
      assert(!world.snapshot(owner.roomId)!.match!.rematchPlayerIds.includes(owner.playerId));
      world.rematch(owner.playerId, 1);
      assert.equal(world.inventory(owner.playerId).records[0].battleQuantity, 3 - uses.length);
    }
    assert.equal(local.speedBoost, undefined);
    let roundEnhancedSteps = 0;
    for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
      const before = {x: local.x, z: local.z}, boostedBefore = !!local.speedBoost; now += 50;
      const events = world.step(50).events;
      const distance = Math.hypot(local.x - before.x, local.z - before.z);
      if (local.alive && local.input.move === 0) {stationaryInputs++; assert.notEqual(local.input.useItem, 5);}
      if (!local.alive) assert.equal(local.speedBoost, undefined);
      if (local.speedBoost && local.alive && distance > 0) {
        const parameters = originalMovementParameters(local)!;
        assert.equal(parameters.speed, baseline.speed + 60); assert.equal(parameters.turn, baseline.turn);
        enhancedSteps++; roundEnhancedSteps++;
        if (local.input.turn === 0 && Math.abs(distance - parameters.speed * Math.fround(.05)) < .001) sourceDistanceSteps++;
      }
      for (const event of events) {
        assert.notEqual(event.type, 'itemRejected');
        if (event.type === 'destroy' && event.targetId === owner.playerId) {
          deaths++; if (boostedBefore) boostedDeaths++; assert.equal(local.speedBoost, undefined);
        }
        if (event.type === 'respawn' && event.playerId === owner.playerId) revivals++;
        if (event.type !== 'itemUsed') continue;
        assert.equal(event.playerId, owner.playerId); assert.equal(event.skillId, 6);
        assert.notEqual(local.input.move, 0); assert.equal(local.input.useItem, 5);
        assert(distance > 0, 'Automatic cast actually advances with source movement');
        uses.push(event); casts.push({round, move: local.input.move, distance, speed: originalMovementParameters(local)!.speed});
        assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - uses.length);
        assert.equal(world.inventory(owner.playerId).records[0].ownedQuantity, 3 - uses.length);
      }
    }
    assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
    assert(world.snapshot(owner.roomId)!.players.every(player => !player.speedBoost));
    assert(world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.isAutopilot);
    assert.deepEqual(originalMovementParameters(local), baseline);
    rounds.push({round, uses: uses.length, enhancedSteps: roundEnhancedSteps, result: world.snapshot(owner.roomId)!.match!.result});
  }
  assert.equal(uses.length, 3); assert.equal(persistedConsumes, 3);
  assert(enhancedSteps > 0 && sourceDistanceSteps > 0 && deaths > 0 && revivals > 0 && boostedDeaths > 0);
  world.configureAutopilot(owner.playerId, 2, false);
  assert(!world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.isAutopilot);
  world.leave(owner.playerId); assert.equal(world.snapshot(owner.roomId), undefined);
  store.close(); store = new AccountStore(database);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 0);
  assert.equal(store.inventory(account.accountId).records[0].float24Bits, 0x7fc01234);
  assert.equal(store.inventory(account.accountId).hotkeys[3], 77);
  const rejoined = world.createAndJoin('speed-owned-ai', 4, 7, 'Rejoin', 'Owner', 1);
  world.bindRoleSources(rejoined.playerId, owned);
  world.bindInventory(rejoined.playerId, store.inventory(account.accountId));
  world.ready(rejoined.playerId, 1); world.configureAutopilot(rejoined.playerId, 1, true);
  for (let i = 0; i < 25; i++) {now += 50; assert(!world.step(50).events.some(event => event.type === 'itemUsed' || event.type === 'itemRejected'));}
  world.configureAutopilot(rejoined.playerId, 1, false);
  const before = world.snapshot(rejoined.roomId)!.players[0];
  world.updateInput(rejoined.playerId, {...ordinary, sequence: 1, move: 1, useItem: 0});
  now += 50; world.step(50);
  const after = world.snapshot(rejoined.roomId)!.players[0];
  assert(Math.hypot(after.x - before.x, after.z - before.z) > 0);
  assert.equal(actualPlayer(world, rejoined.roomId, rejoined.playerId).input.sequence, 1);
  world.leave(rejoined.playerId);
  writeFileSync('recovery/output/speed-drink-ai-world.json', JSON.stringify({status: 'PASS', uses, casts, rounds,
    baseline, enhancedSteps, sourceDistanceSteps, stationaryInputs, deaths, boostedDeaths, revivals, persistedConsumes,
    persisted: store.inventory(account.accountId), manualDisplacement: Math.hypot(after.x - before.x, after.z - before.z),
    scope: 'Explicit account item and role sources, ordinary Autopilot/Ready, automatic accepted moving inputs and source +60 displacement, stock CAS, natural death/revive/finish/rematch, persistence restart, exhausted reentry and manual recovery; read-only battle observation.'}, null, 2));
  console.log('PASS: account speed AI moving casts/source +60, natural two rounds, CAS persistence and manual recovery');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
