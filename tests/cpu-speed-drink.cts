import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {speedDrinkHotkey, healingHotkey, attackDrinkHotkey} from '../apps/server/src/battle/cpu/items';
import {originalMovementParameters} from '../apps/server/src/battle/movement';
import type {PlayerState} from '../apps/server/src/battle/player-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const actor = {alive: true, hp: 80, maxHp: 300, movementReady: true,
  inventory: [{instanceId: 77, itemTableId: 6, ownedQuantity: 2, battleQuantity: 2},
    {instanceId: 88, itemTableId: 1, ownedQuantity: 1, battleQuantity: 1},
    {instanceId: 99, itemTableId: 4, ownedQuantity: 1, battleQuantity: 1}],
  combat: {record: {arrays: new Map([[0, Int32Array.from([0, 0, 0, 77, 88, 99, 0])], [4, new Int32Array(16)]])}}};
assert.equal(speedDrinkHotkey(actor, true), 5);
assert.equal(speedDrinkHotkey(actor, false), 0);
assert.equal(speedDrinkHotkey({...actor, alive: false}, true), 0);
assert.equal(speedDrinkHotkey({...actor, movementReady: false}, true), 0);
assert.equal(healingHotkey(actor) || attackDrinkHotkey(actor, true) || speedDrinkHotkey(actor, true), 6);
assert.equal(healingHotkey({...actor, hp: 300}) || attackDrinkHotkey(actor, true) || speedDrinkHotkey(actor, true), 7);
actor.combat.record.arrays.get(4)![0] = 6;
assert.equal(speedDrinkHotkey(actor, true), 0);
actor.combat.record.arrays.get(4)!.fill(999);
assert.equal(speedDrinkHotkey(actor, true), 0);
actor.combat.record.arrays.get(4)!.fill(0);
actor.inventory[0].battleQuantity = 0;
assert.equal(speedDrinkHotkey(actor, true), 0);
actor.inventory[0].battleQuantity = 2; actor.inventory[0].ownedQuantity = 0;
assert.equal(speedDrinkHotkey(actor, true), 0);

const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
  .find((row: {tankId: number; part: number}) => row.tankId === 1 && row.part === 0);
const fields = (source: Record<string, number>) => new Map(Object.entries(source).map(([key, value]) => [Number(key), value]));
const owned = {base: {name: 'Explicit imported pet', fields: fields(native.base)},
  equipment: {name: 'Explicit imported tank', fields: fields(native.equipment)}};
let now = 100000;
const world = new World(() => now);
const owner = world.createAndJoin('speed-observer', 4, 7, 'CPU speed drink', 'Observer', 1);
const ids = Array.from({length: 3}, () => world.manageCpu(owner.playerId, 1, 'ADD', 1));
for (const [index, id] of ids.entries()) {
  world.bindRoleSources(id, owned);
  world.bindInventory(id, {hotkeys: [0, 0, 0, 77 + index, 0, 0, 0], records: [{instanceId: 77 + index,
    itemTableId: 6, ownedQuantity: 2, battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234,
    float28Bits: 0, float2cBits: 0}]});
}
for (const id of ids) world.ready(id, 1);
world.ready(owner.playerId, 1);
// Observe accepted inputs and source movement; no live battle-state writes.
const players = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(owner.roomId)!.players;
const baselines = new Map(ids.map(id => [id, originalMovementParameters(players.get(id)!)!]));
const used: MsgRoomEvent[] = [], casts: object[] = [], counts: number[][] = [];
let enhancedSteps = 0, sourceDistanceSteps = 0, stationaryInputs = 0;
for (let round = 1; round <= 2; round++) {
  if (round === 2) world.rematch(owner.playerId, 1);
  assert(world.snapshot(owner.roomId)!.players.every(player => !player.speedBoost));
  for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
    const previous = new Map(ids.map(id => {const p = players.get(id)!; return [id, {x: p.x, z: p.z}];}));
    now += 50; const events = world.step(50).events;
    for (const id of ids) {
      const p = players.get(id)!, before = previous.get(id)!;
      const distance = Math.hypot(p.x - before.x, p.z - before.z);
      if (p.alive && p.input.move === 0) {stationaryInputs++; assert.notEqual(p.input.useItem, 5);}
      if (!p.alive) assert.equal(p.speedBoost, undefined);
      if (p.speedBoost && p.alive && distance > 0) {
        const parameters = originalMovementParameters(p)!;
        assert.equal(parameters.speed, baselines.get(id)!.speed + 60);
        assert.equal(parameters.turn, baselines.get(id)!.turn); enhancedSteps++;
        if (p.input.turn === 0 && Math.abs(distance - parameters.speed * Math.fround(.05)) < .001) sourceDistanceSteps++;
      }
    }
    for (const event of events) {
      assert.notEqual(event.type, 'itemRejected');
      if (event.type !== 'itemUsed') continue;
      assert(ids.includes(event.playerId)); assert.equal(event.skillId, 6);
      const p = players.get(event.playerId)!, before = previous.get(event.playerId)!;
      assert.notEqual(p.input.move, 0, 'Speed drink belongs to the actual accepted moving input');
      assert.equal(p.input.useItem, 5);
      const distance = Math.hypot(p.x - before.x, p.z - before.z);
      assert(distance > 0, 'Cast tick must actually displace the CPU');
      used.push(event); casts.push({round, playerId: p.id, move: p.input.move, distance,
        speed: originalMovementParameters(p)!.speed});
    }
  }
  assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
  assert(world.snapshot(owner.roomId)!.players.every(player => !player.speedBoost));
  counts.push(ids.map(id => world.inventory(id).records[0].ownedQuantity));
}
assert.equal(used.length, 6);
assert(enhancedSteps > 0 && sourceDistanceSteps > 0);
assert.deepEqual(counts, [[0, 0, 0], [0, 0, 0]]);
world.leave(owner.playerId);
writeFileSync('recovery/output/cpu-speed-drink.json', JSON.stringify({status: 'PASS', used, casts,
  enhancedSteps, sourceDistanceSteps, stationaryInputs, counts,
  scope: 'Rebuilt AI ordinary moving inputs; explicit initial owned item and role sources; source speed +60 and actual displacement; finite consumption, nonstacking, natural two-round settlement and no rematch grants. Read-only battle observation.'}, null, 2));
console.log('PASS: CPU speed drink, six moving casts, source +60 displacement, finite stock and two natural rounds');
