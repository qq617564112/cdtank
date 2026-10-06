import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {petInjectionHotkey} from '../apps/server/src/battle/cpu/items';
import {BotController, type BotActor} from '../apps/server/src/battle/cpu/controller';
import {createRoomBattlefield} from '../apps/server/src/battlefield';

function actor(): BotActor {
  return {id: 'P1', team: 0, x: 0, y: 0, z: 0, yaw: 0, aim: 0, alive: true, vip: false,
    tank: {speed: 10, turn: 1}, hp: 300, maxHp: 300,
    burn: {ownerId: 'P2', startedAt: 1000, nextTick: 1},
    combat: {status: 2, record: {arrays: new Map([[0, new Int32Array([0, 0, 0, 77, 78, 0, 0])],
      [4, new Int32Array(16).fill(99)]])}},
    inventory: [{instanceId: 77, itemTableId: 3, ownedQuantity: 2, battleQuantity: 2},
      {instanceId: 78, itemTableId: 1, ownedQuantity: 2, battleQuantity: 2}]};
}
const cases = ['dead', 'status', 'noBurn', 'unassigned', 'wrongItem', 'owned0', 'battle0'] as const;
for (const name of cases) {
  const value = actor();
  if (name === 'dead') value.alive = false;
  if (name === 'status') value.combat!.status = 3;
  if (name === 'noBurn') delete value.burn;
  if (name === 'unassigned') value.combat!.record!.arrays.get(0)![3] = 0;
  if (name === 'wrongItem') value.inventory![0].itemTableId = 4;
  if (name === 'owned0') value.inventory![0].ownedQuantity = 0;
  if (name === 'battle0') value.inventory![0].battleQuantity = 0;
  assert.equal(petInjectionHotkey(value), 0, name);
}
const full = actor();
assert.equal(petInjectionHotkey(full), 5, 'Cure does not require a free long-term skill slot');
const field = createRoomBattlefield(7);
const bot = new BotController();
bot.input(full, [full], [], field, 4, 1000, .05);
const cure = bot.input(full, [full], [], field, 4, 1050, .05);
assert.equal(cure.useItem, 5, 'No enemy target must still reach cure policy');
assert.equal(cure.fire, false);
full.hp = 50;
const healing = bot.input(full, [full], [], field, 4, 1100, .05);
assert.equal(healing.useItem, 6, 'Existing healing stays ahead of burn cure');
assert.equal(full.inventory![0].ownedQuantity, 2, 'Decision emits input without consuming');
assert.equal(full.burn!.ownerId, 'P2', 'Decision does not directly clear burn');
writeFileSync('recovery/output/pet-injection-ai.json', JSON.stringify({status: 'PASS',
  scope: 'Unit eligibility fixtures; rebuilt ordinary CPU input decision only, not live combat.',
  cases, cure, healing}, null, 2) + '\n');
console.log('PASS: CPU cure eligibility, full-slot/no-target input and healing priority');
