import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSceneObjects} from '../../apps/server/src/battle/environment';
import {getSceneBreakables, getSceneCastles} from '../../apps/server/src/scene-objects';

const objects = createSceneObjects({mode: 1, map: {mapId: 2}});
const castles = objects.filter(object => object.id.startsWith('CASTLE:'));
assert.deepEqual(castles, getSceneCastles(2).map(source => ({id: `CASTLE:${source.id}`,
  sourcePlacementId: source.id, sourceModel: source.model,
  x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp: source.hp, maxHp: source.hp})));
assert.deepEqual(castles.map(object => object.sourcePlacementId), ['304', '305']);
const environment = objects.filter(object => object.id.startsWith('ENV:'));
const source = getSceneBreakables(2).filter(object => ['obj05428', 'obj05427', 'obj05425', 'obj05426', 'obj05422'].includes(object.model));
assert.equal(environment.length, 60);
assert.equal(environment.filter(object => object.sourceModel === 'obj05428').length, 20);
assert.equal(environment.filter(object => object.sourceModel === 'obj05427').length, 6);
assert.equal(environment.filter(object => object.sourceModel === 'obj05425').length, 16);
assert.equal(environment.filter(object => object.sourceModel === 'obj05426').length, 10);
assert.equal(environment.filter(object => object.sourceModel === 'obj05422').length, 8);
assert.deepEqual(environment.map(object => object.sourcePlacementId), source.map(object => object.id));
assert(environment.every(object => ['obj05428', 'obj05427', 'obj05425', 'obj05426', 'obj05422'].includes(object.sourceModel) && object.hp === 200 && object.maxHp === 200));
assert.equal(environment.find(object => object.sourcePlacementId === '214')?.sourceModel, 'obj05428');
assert.equal(environment.find(object => object.sourcePlacementId === '126')?.sourceModel, 'obj05427');
for (const mode of [2, 3, 4, 5]) assert.deepEqual(createSceneObjects({mode, map: {mapId: 2}}), []);
writeFileSync('recovery/output/environment02-all-breach-coexistence.json', JSON.stringify({
  status: 'PASS_MAP02_ORIGINAL_CASTLE_ALL_SIXTY_BREACH_COEXISTENCE', castleCount: 2,
  environmentCount: 60, target: 'ENV:126', castles,
  scope: 'Only mode1/map2 original Castle snapshots plus all five named Breach models; existing damage/fade rules reused.',
}, null, 2) + '\n');
