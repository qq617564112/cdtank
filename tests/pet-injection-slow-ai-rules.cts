import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {petInjectionHotkey} from '../apps/server/src/battle/cpu/items';
import {BotController, type BotActor} from '../apps/server/src/battle/cpu/controller';
import {createRoomBattlefield} from '../apps/server/src/battlefield';

function actor(): BotActor {
  return {id: 'P1', team: 0, x: 0, y: 0, z: 0, yaw: 0, aim: 0, alive: true, vip: false,
    tank: {speed: 130, turn: .68}, hp: 655, maxHp: 700,
    ammoSlow: {skillId: 4006, expiresAt: 15000},
    combat: {status: 2, record: {arrays: new Map([[0, new Int32Array([0, 0, 0, 77, 78, 0, 0])],
      [4, new Int32Array(16).fill(4006)]])}},
    inventory: [{instanceId: 77, itemTableId: 3, ownedQuantity: 2, battleQuantity: 2},
      {instanceId: 78, itemTableId: 1, ownedQuantity: 2, battleQuantity: 2}]};
}
const gates = ['dead', 'status', 'noAbnormal', 'unassigned', 'wrongItem', 'owned0', 'battle0'] as const;
for (const gate of gates) {
  const value = actor();
  if (gate === 'dead') value.alive = false;
  if (gate === 'status') value.combat!.status = 3;
  if (gate === 'noAbnormal') delete value.ammoSlow;
  if (gate === 'unassigned') value.combat!.record!.arrays.get(0)![3] = 0;
  if (gate === 'wrongItem') value.inventory![0].itemTableId = 4;
  if (gate === 'owned0') value.inventory![0].ownedQuantity = 0;
  if (gate === 'battle0') value.inventory![0].battleQuantity = 0;
  assert.equal(petInjectionHotkey(value), 0, gate);
}
const value = actor(), slow = value.ammoSlow;
assert.equal(petInjectionHotkey(value), 5, 'Slow-only can use ordinary cure slot, including full skill array');
const controller = new BotController(), field = createRoomBattlefield(7);
controller.input(value, [value], [], field, 4, 1000, .05);
const cure = controller.input(value, [value], [], field, 4, 1050, .05);
assert.equal(cure.useItem, 5, 'No target still reaches slow cure policy');
assert.equal(cure.fire, false);
assert.equal(value.ammoSlow, slow, 'Decision does not clear state');
assert.equal(value.inventory![0].ownedQuantity, 2, 'Decision does not consume');
value.hp = 50;
const healing = controller.input(value, [value], [], field, 4, 1100, .05);
assert.equal(healing.useItem, 6, 'Healing priority preserved');
writeFileSync('recovery/output/pet-injection-slow-ai-rules.json', JSON.stringify({status: 'PASS',
  scope: 'Slow-only ordinary AI input decision, not live state or original AI recovery', gates, cure, healing}, null, 2) + '\n');
console.log('PASS: slow-only AI eligibility/ordinary output/no target/full slots/healing priority');
