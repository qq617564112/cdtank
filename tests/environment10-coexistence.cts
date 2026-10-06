import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSceneObjects} from '../apps/server/src/battle/environment';
import {getSceneBreakables, getSceneCastles} from '../apps/server/src/scene-objects';

const objects = createSceneObjects({mode: 1, map: {mapId: 10}});
const castles = objects.filter(object => object.id.startsWith('CASTLE:'));
assert.deepEqual(castles, getSceneCastles(10).map(source => ({id: `CASTLE:${source.id}`,
  sourcePlacementId: source.id, sourceModel: source.model,
  x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp: source.hp, maxHp: source.hp})));
assert.equal(castles.length, 2);
const environment = objects.filter(object => object.id.startsWith('ENV:'));
const source = getSceneBreakables(10).filter(object => object.model === 'obj05425');
assert.equal(environment.length, 16);
assert.deepEqual(environment.map(object => object.sourcePlacementId), source.map(object => object.id));
assert(environment.every(object => object.sourceModel === 'obj05425' && object.hp === 200 && object.maxHp === 200));
assert.equal(environment.find(object => object.sourcePlacementId === '198')?.sourceModel, 'obj05425');
for (const mode of [2, 3, 4, 5]) assert.deepEqual(createSceneObjects({mode, map: {mapId: 10}}), []);
writeFileSync('recovery/output/environment10-coexistence.json', JSON.stringify({
  status: 'PASS_MAP10_ORIGINAL_CASTLE_NAMED_ENV25_COEXISTENCE', castleCount: 2,
  environmentCount: 16, target: 'ENV:198', castles,
  scope: 'Only mode1/map10 original Castle snapshots plus named25; existing damage/fade rules reused.',
}, null, 2) + '\n');
