import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyHealingItem} from '../apps/server/src/battle/healing';
import {healingHotkey} from '../apps/server/src/battle/cpu/items';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const rate = Math.fround(20 * Math.fround(.01));
function participant(itemTableId = 1, hp = 100, attributesReady = true) {
  const combat = createRoleCombatState();
  combat.setStatus(2);
  combat.roleFloatFields.set(0x8c, rate);
  combat.record!.arrays.get(0)![3] = 77;
  return {id: 'P1', name: '食物恢复', alive: true, hp, x: 0, y: 0, z: 0,
    attributesReady, combat, attributes: {record: {hp, maxHp: 1000}},
    inventory: [{instanceId: 77, itemTableId, ownedQuantity: 2, battleQuantity: 2,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]};
}

const cases: unknown[] = [];
for (const [itemId, ready, expected] of [[1, true, 240], [2, true, 480], [1, false, 200]] as const) {
  const player = participant(itemId, 100, ready);
  const events: MsgRoomEvent[] = [];
  let committed = 0;
  applyHealingItem('R1', player, {kind: 'useItem', instanceId: 77}, () => 1000,
    (id, instance, owned, definition) => {
      assert.deepEqual([id, instance, owned, definition], ['P1', 77, 2, itemId]);
      assert.equal(player.hp, 100);
      assert.equal(player.inventory[0].ownedQuantity, 2);
      committed++;
      return true;
    }, events);
  assert.equal(committed, 1);
  assert.equal(player.hp, 100 + expected);
  assert.equal(player.attributes.record.hp, player.hp);
  assert.equal(player.combat.record!.numericFields!.get(0x54), player.hp);
  assert.deepEqual([player.inventory[0].ownedQuantity, player.inventory[0].battleQuantity], [1, 1]);
  assert.equal(events[0].type, 'itemUsed');
  assert.equal(events[0].value, expected);
  assert.equal(events[0].playSkillEffect?.skillId, itemId);
  cases.push({itemId, ready, restored: events[0].value});
}

for (const failure of ['changed', 'storage'] as const) {
  const player = participant();
  const before = structuredClone(player.inventory);
  const events: MsgRoomEvent[] = [];
  applyHealingItem('R1', player, {kind: 'useItem', instanceId: 77}, () => 1000,
    () => {
      if (failure === 'storage') throw new Error('Storage commit failure');
      return false;
    }, events);
  assert.equal(player.hp, 100);
  assert.equal(player.attributes.record.hp, 100);
  assert.deepEqual(player.inventory, before);
  assert.equal(events[0].type, 'itemRejected');
}

for (const [hp, restored, commits] of [[900, 100, 1], [1000, 0, 0]]) {
  const player = participant(1, hp);
  const events: MsgRoomEvent[] = [];
  let called = 0;
  applyHealingItem('R1', player, {kind: 'useItem', instanceId: 77}, () => 1000,
    () => {called++; return true;}, events);
  assert.equal(called, commits);
  assert.equal(player.hp, hp + restored);
  assert.equal(player.inventory[0].ownedQuantity, 2 - commits);
  if (restored) assert.equal(events[0].value, restored);
  else assert.equal(events[0].type, 'itemRejected');
}

const cpu = {...participant(1, 800), maxHp: 1000};
assert.equal(healingHotkey(cpu), 0, 'Qualified 240 healing waits for sufficient missing life');
assert.equal(healingHotkey({...cpu, hp: 760}), 5);
assert.equal(healingHotkey({...cpu, attributesReady: false}), 5, 'Withdrawn source uses base200');
assert.equal(healingHotkey({...cpu, hp: 300}), 5, 'Low-life policy still permits clamped healing');

writeFileSync('recovery/output/food-healing-consumer.json', JSON.stringify({status: 'PASS',
  cases, scope: 'Qualified food ratio, stale-source withdrawal, CAS before life/count mutation, commit rejection, maximum clamp and shared CPU threshold. Direct consumer fixtures; not actual match evidence.'}, null, 2) + '\n');
console.log('PASS food healing consumer and CPU decision');
