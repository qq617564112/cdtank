import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialEffectParticle, EffectParticleSpawnConfig} from '../apps/web/src/render/effects/particles/effect-particle-spawn';
import {EffectParticleState} from '../apps/web/src/render/effects/particles/effect-particle-state';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Row {
  config: EffectParticleSpawnConfig;
  frameCount: number;
  emitterPosition: EffectVec3;
  orbitOffset: EffectVec3;
  globalRotation: number[];
  parent: number[] | null;
  randomValues: number[];
  result: EffectParticleState;
}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/effect-spawn-native.json', 'utf8'));
for (const row of native.rows) {
  let draws = 0;
  const result = initialEffectParticle(row.config, row.frameCount, row.emitterPosition,
    row.orbitOffset, row.globalRotation, () => row.randomValues[draws++], row.parent ?? undefined);
  assert.deepEqual(result, row.result);
  assert.equal(draws, row.randomValues.length);
}
console.log(`PASS: ${native.rows.length} complete native source spawns, point/box/disc, parent/global matrices and exact RNG consumption`);
