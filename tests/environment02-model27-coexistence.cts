import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSceneObjects} from '../apps/server/src/battle/environment';
import {getSceneBreakables, getSceneCastles} from '../apps/server/src/scene-objects';

const objects = createSceneObjects({mode: 1, map: {mapId: 2}});
const castles = objects.filter(object => object.id.startsWith('CASTLE:'));
assert.deepEqual(castles, getSceneCastles(2).map(source => ({id: `CASTLE:${source.id}`,
  sourcePlacementId: source.id, sourceModel: source.model,
  x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp: source.hp, maxHp: source.hp})));
assert.deepEqual(castles.map(object => object.sourcePlacementId), ['304', '305']);
const environment = objects.filter(object => object.id.startsWith('ENV:'));
const source = getSceneBreakables(2).filter(object => ['obj05428', 'obj05427'].includes(object.model));
assert.equal(environment.length, 26);
assert.equal(environment.filter(object => object.sourceModel === 'obj05428').length, 20);
assert.equal(environment.filter(object => object.sourceModel === 'obj05427').length, 6);
assert.deepEqual(environment.map(object => object.sourcePlacementId), source.map(object => object.id));
assert(environment.every(object => ['obj05428', 'obj05427'].includes(object.sourceModel) && object.hp === 200 && object.maxHp === 200));
assert.equal(environment.find(object => object.sourcePlacementId === '214')?.sourceModel, 'obj05428');
assert.equal(environment.find(object => object.sourcePlacementId === '126')?.sourceModel, 'obj05427');
for (const mode of [2, 3, 4, 5]) assert.deepEqual(createSceneObjects({mode, map: {mapId: 2}}), []);
writeFileSync('recovery/output/environment02-model27-coexistence.json', JSON.stringify({
  status: 'PASS_MAP02_ORIGINAL_CASTLE_NAMED_ENV28_ENV27_COEXISTENCE', castleCount: 2,
  environmentCount: 26, target: 'ENV:126', castles,
  scope: 'Only mode1/map2 original Castle snapshots plus named28/27; existing damage/fade rules reused.',
}, null, 2) + '\n');
