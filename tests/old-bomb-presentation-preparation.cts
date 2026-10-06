import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolveItemHotkey} from '../apps/shared/combat/item-hotkeys';
import {SkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-notifications';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const item = catalog.items.find((row: {itemTableId: number}) => row.itemTableId === 3001);
const skill = catalog.skills.find((row: {skillId: number}) => row.skillId === 3001);
assert.deepEqual(item.skillIds, [3001, 0, 0]);
assert.equal(item.battleUseMax, 10);
assert.deepEqual(skill.effects[0], {effectId: 10, sound: 'SE02', tag: 0, method: 3});
assert.deepEqual(skill.functions[0], {type: 13, t: 5, x: 30, y: 3009, z: 3001});
assert.deepEqual(resolveItemHotkey(2, true, [77], [{instanceId: 77, itemTableId: 3001,
  ownedQuantity: 1, battleQuantity: 1}]), {accepted: true, command: {kind: 'placeTrap', instanceId: 77}});
const calls: unknown[][] = [];
const notifications = new SkillEffectNotifications<number, number, number>({
  skill: id => id === 3001 ? skill : undefined,
  role: () => {throw new Error('World notification must not query a role');},
  hasActor: () => false,
  world: (...args) => {calls.push(args);},
  attached: () => {throw new Error('World notification must not attach');},
  sound: () => {throw new Error('World notification must not add the outer SE02');},
  stopEffect() {}, stopSound() {}, release() {}, resetRoleEffects() {},
});
const bits = (value: number): number => {
  const data = new DataView(new ArrayBuffer(4)); data.setFloat32(0, value, true);
  return data.getUint32(0, true);
};
notifications.play({skillId: 3001, effectIndex: 0, duration: 0, roleId: 0,
  xBits: bits(12.5), zBits: bits(-4)});
assert.deepEqual(calls, [['_root\\online\\010', [12.5, 0, -4], 1]]);
writeFileSync('recovery/output/old-bomb-presentation-preparation.json', JSON.stringify({
  status: 'PASS_CONDITIONAL_MODULE_PREPARATION_ONLY', itemId: 3001,
  input: 'placeTrap', effect: skill.effects[0], functionFields: skill.functions[0],
  conditionalWorldNotification: {root: '010', position: [12.5, 0, -4], outerSound: false},
  reuse: ['skill-effect-message-native.json', 'effects-skill13-world.json'],
  missing: ['authoritative trap object/placement/trigger contract',
    'evidence that accepted placement dispatches this skill as roleId0', 'ordinary actual'],
  parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_CONDITIONAL_MODULE_PREPARATION_ONLY: 3001 hotkey and conditional world010; no trap business or trigger assertion');
