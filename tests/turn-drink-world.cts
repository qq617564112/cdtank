import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';
import {originalMovementParameters} from '../apps/server/src/battle/movement';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-turn-world-'));
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
  const record = {instanceId: 77, itemTableId: 7, ownedQuantity: 4, battleQuantity: 0, state: 0,
    field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0};
  store.replaceInventory(account.accountId, [record]); store.assign(account.accountId, 77, 4);
  let now = 100000, allow = true, failure = false;
  const world = new World(() => now, {consumeItem: (_id, instance, quantity, definition) => {
    if (failure) throw new Error('Explicit persistence failure');
    return allow && store.consumeItem(account.accountId, instance, quantity, definition);
  }});
  const host = world.createAndJoin('turn-owner', 4, 7, 'Turn drink', 'Owner', 1);
  world.bindInventory(host.playerId, store.inventory(account.accountId));
  world.ready(host.playerId, 1);
  let sequence = 0;
  const input = (useItem = 0, turn = 0) => world.updateInput(host.playerId,
    {sequence: ++sequence, move: 0, turn, aim: 0, fire: false, useItem, clientTime: now});
  assert(input(5).some(event => event.type === 'itemRejected'), 'No-source request must refuse rather than silently consume');
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 4);
  world.leave(host.playerId);

  const solo = new World(() => now, {consumeItem: (_id, instance, quantity, definition) => {
    if (failure) throw new Error('Explicit persistence failure');
    return allow && store.consumeItem(account.accountId, instance, quantity, definition);
  }});
  const joined = solo.createAndJoin('turn-source', 4, 7, 'Source movement', 'Owner', 1);
  solo.bindRoleSources(joined.playerId, owned);
  solo.bindInventory(joined.playerId, store.inventory(account.accountId)); solo.ready(joined.playerId, 1);
  const player = actualPlayer(solo, joined.roomId, joined.playerId);
  const initial = originalMovementParameters(player)!;
  assert(initial);
  const send = (useItem = 0, turn = 0) => solo.updateInput(joined.playerId,
    {sequence: ++sequence, move: 0, turn, aim: 0, fire: false, useItem, clientTime: now});
  const turnScale = Math.fround(0.06981316953897476);
  const turnOffset = Math.fround(.1919862);
  const sourceTurnUnits = Math.round((initial.turn - turnOffset) / turnScale);
  const expectedBoostedTurn = Math.fround((sourceTurnUnits + 6) * turnScale + turnOffset);
  const angleDelta = (before: number, after: number) =>
    Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before)));
  function rotate(ticks: number): number {
    send(0, 1);
    let angle = 0;
    for (let tick = 0; tick < ticks; tick++) {
      const before = {x: player.x, z: player.z, yaw: player.yaw}; now += 50; solo.step(50);
      angle += angleDelta(before.yaw, player.yaw);
      assert.equal(player.x, before.x); assert.equal(player.z, before.z);
    }
    send(0); return angle;
  }
  const normalAngle = rotate(5);
  allow = false; assert(send(5).some(event => event.type === 'itemRejected'));
  allow = true; failure = true; assert(send(5).some(event => event.type === 'itemRejected'));
  assert.equal(player.turnBoost, undefined); assert.deepEqual(originalMovementParameters(player), initial);
  failure = false;
  const used = send(5).find(event => event.type === 'itemUsed')!; assert(used);
  assert.deepEqual(player.turnBoost, {skillId: 7, expiresAt: now + 10000, turnBonus: 6});
  assert(send(5).some(event => event.type === 'itemRejected'));
  const boosted = originalMovementParameters(player)!;
  assert.equal(boosted.turn, expectedBoostedTurn, 'Source ItemTurn6 uses original f32 mastery affine formula');
  assert(Math.abs(boosted.turn - initial.turn - 6 * turnScale) < 1e-6);
  assert.equal(boosted.speed, initial.speed);
  const boostedAngle = rotate(5);
  assert(normalAngle > 0 && boostedAngle > normalAngle, 'Ordinary stationary D input actually turns faster with the drink');
  assert(Math.abs(boostedAngle / normalAngle - boosted.turn / initial.turn) < .0001);
  const deadline = solo.snapshot(joined.roomId)!.players.find(value => value.id === joined.playerId)!.turnBoost!.expiresAt;
  now = deadline; assert(solo.step(50).events.some(event => event.stopSkillEffect?.skillId === 7));
  assert.equal(player.turnBoost, undefined); assert.deepEqual(originalMovementParameters(player), initial);
  solo.leave(joined.playerId);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3);

  const battle = new World(() => now, {consumeItem: (_id, instance, quantity, definition) =>
    store.consumeItem(account.accountId, instance, quantity, definition)});
  const owner = battle.createAndJoin('turn-cpu', 4, 7, 'Natural turn battle', 'Owner', 1);
  battle.bindRoleSources(owner.playerId, owned); battle.bindInventory(owner.playerId, store.inventory(account.accountId));
  for (let index = 0; index < 3; index++) battle.manageCpu(owner.playerId, 1, 'ADD', 1);
  battle.ready(owner.playerId, 1);
  const local = actualPlayer(battle, owner.roomId, owner.playerId);
  const snapshot = () => battle.snapshot(owner.roomId)!;
  const rounds = []; let enhancedSteps = 0, deaths = 0, revivals = 0;
  for (let round = 1; round <= 2; round++) {
    if (round === 2) battle.rematch(owner.playerId, 1);
    assert.equal(local.turnBoost, undefined);
    battle.configureAutopilot(owner.playerId, round, false);
    const beforeStock = battle.inventory(owner.playerId).records[0].ownedQuantity;
    assert.equal(battle.inventory(owner.playerId).records[0].battleQuantity, Math.min(5, beforeStock));
    const baseline = originalMovementParameters(local)!;
    const roundBoostedTurn = Math.fround((Math.round((baseline.turn - turnOffset) / turnScale) + 6) * turnScale + turnOffset);
    const events = battle.updateInput(owner.playerId, {sequence: ++sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 5, clientTime: now});
    assert(events.some(event => event.type === 'itemUsed'));
    battle.configureAutopilot(owner.playerId, round, true);
    let boostedSteps = 0;
    for (let tick = 0; tick < 6200 && snapshot().phase === 'PLAYING'; tick++) {
      const previous = {yaw: local.yaw}, boostedBefore = !!local.turnBoost;
      now += 50; const step = battle.step(50);
      const angle = angleDelta(previous.yaw, local.yaw);
      if (boostedBefore && local.turnBoost && angle > 0 && local.alive) {
        assert.equal(originalMovementParameters(local)!.turn, roundBoostedTurn);
        assert.equal(originalMovementParameters(local)!.speed, baseline.speed);
        enhancedSteps++; boostedSteps++;
      }
      deaths += step.events.filter(event => event.type === 'destroy' && event.targetId === owner.playerId).length;
      revivals += step.events.filter(event => event.type === 'respawn' && event.playerId === owner.playerId).length;
      if (!local.alive) assert.equal(local.turnBoost, undefined);
    }
    assert(boostedSteps > 0, 'Each natural round must actually turn using source boosted turn');
    assert.equal(snapshot().phase, 'FINISHED'); assert(snapshot().players.every(player => !player.turnBoost));
    assert.equal(battle.inventory(owner.playerId).records[0].ownedQuantity, beforeStock - 1);
    rounds.push({round, boostedSteps, result: snapshot().match!.result});
  }
  assert(deaths > 0 && revivals > 0);
  battle.leave(owner.playerId); store.close(); store = new AccountStore(join(directory, 'accounts.sqlite'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 1);
  assert.equal(store.inventory(account.accountId).hotkeys[3], 77);
  writeFileSync('recovery/output/turn-drink-world.json', JSON.stringify({status: 'PASS', initial, boosted,
    normalAngle, boostedAngle, enhancedSteps, deaths, revivals, rounds, persisted: store.inventory(account.accountId),
    scope: 'Ordinary slot and original source recompute/movement, no-source/CAS/storage refusal, real enhanced rotation and deadline restoration; normal AI vs3CPU natural two rounds/death/revive/rematch/save. Initial explicit owned records only; no injected HP/position/damage/outcome. Qualification/consume authority rebuilt.'}, null, 2));
  console.log('PASS: source turn7 real ordinary rotation, safe refusals/expiry, natural AI two rounds and persisted stock');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
