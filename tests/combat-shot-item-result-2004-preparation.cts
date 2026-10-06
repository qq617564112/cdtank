import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TankShotDisplay} from '../apps/web/src/assets/tanks/shot-display';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

const catalog: CombatCatalog = JSON.parse(readFileSync(
  'recovery/output/web-assets/combat-catalog.json', 'utf8'));
const audio = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8'));
const item = catalog.items.find(row => row.itemTableId === 2004)!;
const skill = catalog.skills.find(row => row.skillId === item.skillIds[1])!;
const feedback = audio.battleFire.find((row: {skillId: number}) => row.skillId === 2004);
assert.equal(skill.skillId, 4020);
assert.deepEqual(skill.effects[0], {effectId: 7, sound: 'SE30', tag: 0, method: 3});
assert.equal(feedback.soundId, 48);
assert.equal(feedback.name, 'GA07');

const calls: unknown[][] = [];
const runtime = {
  spawnWorldEffect: (...args: unknown[]) => {calls.push(['endpoint', ...args]); return 1;},
  playShotSound: (...args: unknown[]) => {calls.push(['endpointSound', ...args]); return 1;},
};
const message = {itemId: 2004, x: 123.45, y: 25, z: -77.1};
new TankShotDisplay(runtime, catalog).show(message);
assert.deepEqual(calls, [['endpoint', '_root\\online\\007',
  [Math.fround(123.45), 25, Math.fround(-77.1)]], ['endpointSound', 'SE30']]);

writeFileSync('recovery/output/combat-shot-item-result-2004-preparation.json',
  JSON.stringify({status: 'PASS_PREPARATION_ONLY', itemId: 2004, skillId: skill.skillId,
    endpointEffect: '007', endpointSound2D: 'SE30', feedbackSound: 'GA07', feedbackSoundId: 48,
    ordinarySceneResultVerified: false,
    reused: ['combat-shot-player-result-2004-source.json', 'scene-breach21-hit-native.json',
      'ordinary2001-immediate-accepted.json'],
    scope: 'Existing endpoint renderer selects second skill4020 and f32XYZ; source mapping preparation only.'}, null, 2) + '\n');
console.log('PASS_PREPARATION_ONLY: 2004 endpoint007/2DSE30 and source GA07/48');
