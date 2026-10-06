import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';
import {originalMovementParameters} from '../apps/server/src/battle/movement';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-speed-world-'));
let store = new AccountStore(join(directory, 'accounts.sqlite'));
const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
  .find((row: {tankId: number; part: number}) => row.tankId === 1 && row.part === 0);
const fields = (source: Record<string, number>) => new Map(Object.entries(source).map(([key, value]) => [Number(key), value]));
const owned = {base: {name: 'Explicit imported pet', fields: fields(native.base)},
  equipment: {name: 'Explicit imported tank', fields: fields(native.equipment)}};
// Read-only observation of actual movement parameters, never a battle-state injection.
function actualPlayer(world: World, roomId: string, playerId: string): PlayerState {
  return (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(roomId)!.players.get(playerId)!;
}
try {
  const account = store.open();
  const record = {instanceId: 77, itemTableId: 6, ownedQuantity: 4, battleQuantity: 0, state: 0,
    field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0};
  store.replaceInventory(account.accountId, [record]); store.assign(account.accountId, 77, 4);
  let now = 100000, allow = true, failure = false;
  const world = new World(() => now, {consumeItem: (_id, instance, quantity, definition) => {
    if (failure) throw new Error('Explicit persistence failure');
    return allow && store.consumeItem(account.accountId, instance, quantity, definition);
  }});
  const host = world.createAndJoin('speed-owner', 4, 7, 'Speed drink', 'Owner', 1);
  world.bindInventory(host.playerId, store.inventory(account.accountId));
  world.ready(host.playerId, 1);
  let sequence = 0;
  const input = (useItem = 0, move = 0) => world.updateInput(host.playerId,
    {sequence: ++sequence, move, turn: 0, aim: 0, fire: false, useItem, clientTime: now});
  assert(input(5).some(event => event.type === 'itemRejected'), 'No-source request must refuse rather than silently consume');
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 4);
  world.leave(host.playerId);

  const solo = new World(() => now, {consumeItem: (_id, instance, quantity, definition) => {
    if (failure) throw new Error('Explicit persistence failure');
    return allow && store.consumeItem(account.accountId, instance, quantity, definition);
  }});
  const joined = solo.createAndJoin('speed-source', 4, 7, 'Source movement', 'Owner', 1);
  solo.bindRoleSources(joined.playerId, owned);
  solo.bindInventory(joined.playerId, store.inventory(account.accountId)); solo.ready(joined.playerId, 1);
  const player = actualPlayer(solo, joined.roomId, joined.playerId);
  const initial = originalMovementParameters(player)!;
  assert(initial);
  const send = (useItem = 0, move = 0) => solo.updateInput(joined.playerId,
    {sequence: ++sequence, move, turn: 0, aim: 0, fire: false, useItem, clientTime: now});
  function walk(ticks: number): number {
    send(0, 1);
    let distance = 0;
    for (let tick = 0; tick < ticks; tick++) {
      const before = {x: player.x, z: player.z}; now += 50; solo.step(50);
      distance += Math.hypot(player.x - before.x, player.z - before.z);
    }
    send(0); return distance;
  }
  const normalDistance = walk(5);
  allow = false; assert(send(5).some(event => event.type === 'itemRejected'));
  allow = true; failure = true; assert(send(5).some(event => event.type === 'itemRejected'));
  assert.equal(player.speedBoost, undefined); assert.deepEqual(originalMovementParameters(player), initial);
  failure = false;
  const used = send(5).find(event => event.type === 'itemUsed')!; assert(used);
  assert.deepEqual(player.speedBoost, {skillId: 6, expiresAt: now + 10000, moveBonus: 6});
  assert(send(5).some(event => event.type === 'itemRejected'));
  const boosted = originalMovementParameters(player)!;
  assert.equal(boosted.speed, initial.speed + 60, 'Source ItemMove6 × original scale10, not a new speed formula');
  assert.equal(boosted.turn, initial.turn);
  const boostedDistance = walk(5);
  assert(normalDistance > 0 && boostedDistance > normalDistance, 'Ordinary movement actually advances farther with the drink');
  assert(Math.abs(boostedDistance / normalDistance - boosted.speed / initial.speed) < .0001);
  const deadline = solo.snapshot(joined.roomId)!.players.find(value => value.id === joined.playerId)!.speedBoost!.expiresAt;
  now = deadline; assert(solo.step(50).events.some(event => event.stopSkillEffect?.skillId === 6));
  assert.equal(player.speedBoost, undefined); assert.deepEqual(originalMovementParameters(player), initial);
  solo.leave(joined.playerId);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3);

  const battle = new World(() => now, {consumeItem: (_id, instance, quantity, definition) =>
    store.consumeItem(account.accountId, instance, quantity, definition)});
  const owner = battle.createAndJoin('speed-cpu', 4, 7, 'Natural speed battle', 'Owner', 1);
  battle.bindRoleSources(owner.playerId, owned); battle.bindInventory(owner.playerId, store.inventory(account.accountId));
  for (let index = 0; index < 3; index++) battle.manageCpu(owner.playerId, 1, 'ADD', 1);
  battle.ready(owner.playerId, 1);
  const local = actualPlayer(battle, owner.roomId, owner.playerId);
  const snapshot = () => battle.snapshot(owner.roomId)!;
  const rounds = []; let enhancedSteps = 0, deaths = 0, revivals = 0;
  for (let round = 1; round <= 2; round++) {
    if (round === 2) battle.rematch(owner.playerId, 1);
    assert.equal(local.speedBoost, undefined);
    battle.configureAutopilot(owner.playerId, round, false);
    const beforeStock = battle.inventory(owner.playerId).records[0].ownedQuantity;
    assert.equal(battle.inventory(owner.playerId).records[0].battleQuantity, Math.min(5, beforeStock));
    const baseline = originalMovementParameters(local)!;
    const events = battle.updateInput(owner.playerId, {sequence: ++sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: now});
    assert(events.some(event => event.type === 'itemUsed'));
    battle.configureAutopilot(owner.playerId, round, true);
    let boostedSteps = 0;
    for (let tick = 0; tick < 6200 && snapshot().phase === 'PLAYING'; tick++) {
      const previous = {x: local.x, z: local.z}, boostedBefore = !!local.speedBoost;
      now += 50; const step = battle.step(50);
      const distance = Math.hypot(local.x - previous.x, local.z - previous.z);
      if (boostedBefore && local.speedBoost && distance > 0 && local.alive) {
        assert.equal(originalMovementParameters(local)!.speed, baseline.speed + 60); enhancedSteps++; boostedSteps++;
      }
      deaths += step.events.filter(event => event.type === 'destroy' && event.targetId === owner.playerId).length;
      revivals += step.events.filter(event => event.type === 'respawn' && event.playerId === owner.playerId).length;
      if (!local.alive) assert.equal(local.speedBoost, undefined);
    }
    assert(boostedSteps > 0, 'Each natural round must actually move using source boosted speed');
    assert.equal(snapshot().phase, 'FINISHED'); assert(snapshot().players.every(player => !player.speedBoost));
    assert.equal(battle.inventory(owner.playerId).records[0].ownedQuantity, beforeStock - 1);
    rounds.push({round, boostedSteps, result: snapshot().match!.result});
  }
  assert(deaths > 0 && revivals > 0);
  battle.leave(owner.playerId); store.close(); store = new AccountStore(join(directory, 'accounts.sqlite'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 1);
  assert.equal(store.inventory(account.accountId).hotkeys[3], 77);
  writeFileSync('recovery/output/speed-drink-world.json', JSON.stringify({status: 'PASS', initial, boosted,
    normalDistance, boostedDistance, enhancedSteps, deaths, revivals, rounds, persisted: store.inventory(account.accountId),
    scope: 'Ordinary slot and original source recompute/movement, no-source/CAS/storage refusal, real enhanced displacement and deadline restoration; normal AI vs3CPU natural two rounds/death/revive/rematch/save. Initial explicit owned records only; no injected HP/position/damage/outcome. Qualification/consume authority rebuilt.'}, null, 2));
  console.log('PASS: source speed6 real ordinary movement, safe refusals/expiry, natural AI two rounds and persisted stock');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
