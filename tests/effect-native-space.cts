import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeEffectVector, rotateEffectVector, transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface NormalizeRow {input: EffectVec3; output: EffectVec3;}
interface SpaceRow {input: EffectVec3; matrix: number[]; rotate: EffectVec3; transform: EffectVec3;}
const native: {normalize: NormalizeRow[]; space: SpaceRow[]} = JSON.parse(readFileSync('recovery/output/effect-space-native.json', 'utf8'));
for (const row of native.normalize) {
  assert.deepEqual(normalizeEffectVector(row.input), row.output);
}
for (const row of native.space) {
  assert.deepEqual(rotateEffectVector(row.matrix, row.input), row.rotate);
  assert.deepEqual(transformEffectPosition(row.matrix, row.input), row.transform);
}
console.log(`PASS: ${native.normalize.length} normalize and ${native.space.length} native matrix cases, supplied original DLL/CRT with no math substitutes`);
