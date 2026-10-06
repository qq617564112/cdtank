import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {SkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-notifications';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const source = JSON.parse(readFileSync('recovery/output/verified/tables/skill.json', 'utf8')) as {
  rows: {values: Record<string, string>}[];
};
for (const skillId of [10, 11]) {
  const row = source.rows.find(row => row.values.SkillTableID === String(skillId))!.values;
  assert.deepEqual([row.Effect1, row.Sound1, row.EffectTag1, row.EffectMethod1], ['3', 'GA16', '0', '3']);
  assert.deepEqual(catalog.skills.find(skill => skill.skillId === skillId)!.effects[0],
    {effectId: 3, sound: 'GA16', tag: 0, method: 3});
}
assert.ok(existsSync('recovery/output/web-assets/audio/sound/GA16.wav'));
const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {
  rows: {node: number; retain: boolean; created: {node: number; retain: boolean}[]}[];
};
const tree = native.rows.find(row => row.node === 2427 && !row.retain)!.created;
assert.deepEqual(tree.map(row => row.node), [2427, 2428, 2436, 2525, 2627]);
let handle = 0;
const stoppedEffects: number[] = [], stoppedSounds: number[] = [], selectors: number[] = [];
const notifications = new SkillEffectNotifications<number, number, number>({
  skill: id => catalog.skills.find(skill => skill.skillId === id),
  role: id => id, hasActor: () => true, world: () => {},
  attached: (_role, effect, binding, tag, oneShot) => {
    assert.deepEqual([effect, binding, tag, oneShot], [3, 3, 0, false]);
    return ++handle;
  },
  sound: (_role, reference, selector) => {
    assert.equal(reference, 'GA16'); selectors.push(selector); return ++handle;
  },
  stopEffect: effect => {stoppedEffects.push(effect);},
  stopSound: sound => {stoppedSounds.push(sound);},
  release: () => {}, resetRoleEffects: () => {},
});
const play = (roleId: number, skillId: number): void => notifications.play({roleId, skillId,
  effectIndex: 0, duration: 3, xBits: 0, zBits: 0});
for (const cleanup of ['stop', 'clearRole']) {
  play(47, 10); play(48, 11);
  const first = notifications.records[0], survivor = notifications.records[1];
  if (cleanup === 'stop') notifications.stop({roleId: 47, skillId: 10});
  else notifications.clearRole(47);
  assert.deepEqual(notifications.records, [survivor]);
  assert.equal(stoppedEffects.at(-1), first.effect);
  assert.equal(stoppedSounds.at(-1), first.sound);
  notifications.update(30); notifications.update(30);
  assert.deepEqual(notifications.records, [survivor]);
  notifications.update(30);
  assert.equal(notifications.records.length, 0);
  assert.equal(stoppedEffects.at(-1), survivor.effect);
  assert.equal(stoppedSounds.at(-1), survivor.sound);
}
assert.deepEqual(selectors, [-1, -1, -1, -1]);
writeFileSync('recovery/output/effects-retained-role-isolation.json', `${JSON.stringify({status: 'PASS',
  skills: [10, 11], effect: 3, sound: 'GA16', selector: -1, duration: 3,
  sourceNodes: tree, drawNodes: [2428, 2436, 2525, 2627],
  cleanup: ['stop', 'clearRole', 'durationExpiry'], roleIsolation: true,
  scope: 'Source table and production notification state; rendering/device playback validated separately in Chromium'}, null, 2)}\n`);
console.log('PASS: original skill10/11 source, retained GA16 loop, role-specific stop/removal and duration expiry');
