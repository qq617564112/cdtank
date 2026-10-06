import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {healingHotkey, attackDrinkHotkey} from '../apps/server/src/battle/cpu/items';
import type {MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';

const actor = {alive: true, hp: 80, maxHp: 300,
  inventory: [{instanceId: 77, itemTableId: 4, ownedQuantity: 3, battleQuantity: 3},
    {instanceId: 88, itemTableId: 1, ownedQuantity: 1, battleQuantity: 1}],
  combat: {record: {arrays: new Map([[0, Int32Array.from([0, 0, 0, 77, 88, 0, 0])], [4, new Int32Array(16)]])}}};
assert.equal(healingHotkey(actor), 6);
assert.equal(attackDrinkHotkey(actor, true), 5);
assert.equal(attackDrinkHotkey(actor, false), 0);
assert.equal(attackDrinkHotkey({...actor, alive: false}, true), 0);
actor.combat.record.arrays.get(4)![0] = 4;
assert.equal(attackDrinkHotkey(actor, true), 0);
actor.combat.record.arrays.get(4)!.fill(999);
assert.equal(attackDrinkHotkey(actor, true), 0);
actor.combat.record.arrays.get(4)!.fill(0);
actor.inventory[0].battleQuantity = 0;
assert.equal(attackDrinkHotkey(actor, true), 0);

let now = 100000;
const world = new World(() => now);
const owner = world.createAndJoin('drink-observer', 4, 7, 'CPU drink', 'Observer', 1);
const ids = Array.from({length: 3}, () => world.manageCpu(owner.playerId, 1, 'ADD', 1));
for (const [index, id] of ids.entries()) world.bindInventory(id, {hotkeys: [0, 0, 0, 77 + index, 0, 0, 0], records: [{instanceId: 77 + index,
  itemTableId: 4, ownedQuantity: 2, battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
world.ready(owner.playerId, 1);
const used: MsgRoomEvent[] = [];
let enhancedHits = 0;
const attack = TANKS.find(tank => tank.id === 1)!.attack;
const damage = 35 + (attack * 2 + 20) * .08;
const counts: number[][] = [];
for (let round = 1; round <= 2; round++) {
  if (round === 2) world.rematch(owner.playerId, 1);
  assert(world.snapshot(owner.roomId)!.players.every(player => !player.attackBoost));
  for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
    now += 50;
    const events = world.step(50).events;
    for (const event of events) {
      if (event.type === 'itemUsed') {
        assert(ids.includes(event.playerId)); assert.equal(event.skillId, 4);
        assert(events.some(value => value.type === 'fire' && value.playerId === event.playerId), 'CPU drinks on its ordinary firing input');
        used.push(event);
      }
      if (event.type === 'hit' && ids.includes(event.playerId) && event.value === damage) enhancedHits++;
      assert(event.type !== 'itemRejected', 'CPU must avoid nonstacking/empty/full-slot repeated requests');
    }
  }
  assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
  assert(world.snapshot(owner.roomId)!.players.every(player => !player.attackBoost));
  counts.push(ids.map(id => world.inventory(id).records[0].ownedQuantity));
}
assert.equal(used.length, 6);
assert(enhancedHits > 0);
assert.deepEqual(counts, [[0, 0, 0], [0, 0, 0]]);
world.leave(owner.playerId);
writeFileSync('recovery/output/cpu-attack-drink.json', JSON.stringify({status: 'PASS', used, enhancedHits, counts,
  scope: 'Rebuilt AI item policy, explicit initial CPU ownership, ordinary firing/shortcut inputs only; natural hits/settlement across two rounds, exhaustion and no rematch grants. No state injection or original AI/embedded ww051 proof.'}, null, 2));
console.log('PASS: CPU attack drink on ordinary firing, six uses/enhanced hits, two natural rounds and exhausted stock preserved');
