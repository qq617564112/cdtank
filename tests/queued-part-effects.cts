import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {queuedPartSkillIds} from '../apps/server/src/battle/passive-part-effects';
import {resolveBattlePartTableIds} from '../apps/server/src/battle/roles/part-definitions';
import {combatItems, combatCatalog} from '../apps/server/src/battle/catalog';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {SkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-notifications';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

const current = Array(16).fill(0);
const inventory: InventoryWireRecord[] = [17031, 17032].map((itemTableId, index) => ({
  instanceId: index + 1, itemTableId, ownedQuantity: 1, battleQuantity: 0,
  state: 2, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}));
const ids = () => queuedPartSkillIds(resolveBattlePartTableIds([1, 2, 0, 0, 0], inventory, combatItems), current);
assert.deepEqual(ids(), [13501, 13502]);
inventory[0].state = 0; assert.deepEqual(ids(), [13502]);
inventory[0].state = 2; inventory[1].ownedQuantity = 0; assert.deepEqual(ids(), [13501]);
inventory[1].ownedQuantity = 1; assert.deepEqual(queuedPartSkillIds(undefined, current), []);
assert.deepEqual(queuedPartSkillIds([17031], undefined), []);
assert.deepEqual(queuedPartSkillIds([16001, 15001], current), []);
const draws: number[] = [], stops: number[] = [], sounds: string[] = [];
const notifications = new SkillEffectNotifications<number, number, number>({
  skill: id => combatCatalog.skills.find(skill => skill.skillId === id),
  role: id => id, hasActor: () => true, world: () => {},
  attached: (_role, effect) => {draws.push(effect); return effect;},
  sound: (_role, reference) => {if (reference !== '0' && reference !== '') sounds.push(reference); return 0;},
  stopEffect: effect => {if (effect !== undefined) stops.push(effect);}, stopSound: () => {},
  release: () => {}, resetRoleEffects: () => {},
});
const battle = new BattleSkillEffects(notifications);
assert.equal(battle.reconcileQueuedParts('P1', ids(), false), false);
assert.deepEqual(draws, []);
assert.equal(battle.reconcileQueuedParts('P1', ids(), true), true);
assert.deepEqual(draws, [31]);
assert.equal(battle.reconcileQueuedParts('P1', ids(), true), false);
assert.equal(notifications.queues.get(1)!.length, 2);
notifications.advanceTimers(5); assert.deepEqual(draws, [31]);
notifications.advanceTimers(.01); assert.deepEqual(draws, [31, 32]);
// A queued source lifecycle must not remove unrelated retained skills.
battle.play({skillId: 8, duration: 10, effectIndex: 0, roleId: 1, xBits: 0, zBits: 0});
const retained = notifications.records.length; assert.equal(retained, 1);
battle.reconcileQueuedParts('P1', ids(), false);
assert.equal(notifications.records.length, retained);
assert.equal(notifications.queues.size, 0); assert.equal(notifications.queueTimers.size, 0);
const count = draws.length; notifications.advanceTimers(10); assert.equal(draws.length, count);
assert.equal(battle.reconcileQueuedParts('P1', ids(), true), true);
assert.equal(draws.at(-1), 31);
battle.remove('P1'); assert.equal(notifications.queues.size, 0);
battle.reconcileQueuedParts('P1', [13502], true); assert.equal(draws.at(-1), 32);
battle.clear(); assert.equal(notifications.queues.size, 0); assert.equal(notifications.records.length, 0);
battle.reconcileQueuedParts('P1', [13501], true); assert.equal(draws.at(-1), 31);
battle.clear();
writeFileSync('recovery/output/queued-part-effects.json', JSON.stringify({
  status: 'PASS_OWNERSHIP_SELECTOR_QUEUE_LIFECYCLE_MODULE_SCOPE',
  selected: ids(), draws, stops,
  scope: 'Actual original passive selection from qualified part instances and original notification queue; entry, unchanged snapshot, five-second alternation, death, revive, removal and round reset. Ordinary purchase/drawing verified separately.'}, null, 2) + '\n');
console.log('PASS qualified parts and original queue lifecycle without removing retained consumable effects');
