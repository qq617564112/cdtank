import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {sceneCrushTransform} from '../apps/web/src/assets/scenes/scene-crush-transform';
import type {EffectVec3} from '../apps/web/src/render/effects/common/types';

const native = JSON.parse(readFileSync('recovery/output/scene-crush07-matrix-native.json', 'utf8'));
const source = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json', 'utf8'));
const map = source.find((entry: {id: string}) => entry.id === '0007');
const rows = native.placements.map((expected: {id: string; position: EffectVec3;
  rotation: EffectVec3; enabled: number; matrix: number[]}) => {
  const placement = map.records.find((row: {id: string}) => row.id === expected.id);
  assert.equal(placement.className, 'SYcScnObjCrush');
  assert.equal(placement.model, 'obj05420');
  assert.deepEqual(placement.position, expected.position);
  assert.deepEqual(placement.rotation, expected.rotation);
  assert.equal(placement.enabled, expected.enabled);
  const matrix = sceneCrushTransform(placement.position, placement.rotation);
  assert.deepEqual(matrix, expected.matrix);
  return {id: expected.id, enabled: expected.enabled, matrix};
});
writeFileSync('recovery/output/scene-crush07-transform.json', JSON.stringify({
  status: 'PASS_SOURCE_TRANSFORM', rows,
  scope: 'Three original Crush07 placement transforms match original44de02 output; no authority or player claim.',
}, null, 2) + '\n');
console.log('PASS_SOURCE_TRANSFORM: original075–077 inputs and native world matrices');
