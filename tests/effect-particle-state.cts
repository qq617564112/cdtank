import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
import {advanceEffectParticle, EffectParticleState, EffectParticleUpdateConfig} from '../apps/web/src/render/effects/particles/effect-particle-state';
interface Row {
  state: EffectParticleState;
  config: EffectParticleUpdateConfig;
  delta: number;
  result: EffectParticleState;
  randomDraws: number;
  target: EffectVec3;
}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/effect-particle-native.json', 'utf8'));
for (const row of native.rows) {
  let draws = 0;
  const result = advanceEffectParticle(row.state, row.config, row.delta, count => {
    ++draws;
    return count - 1;
  }, row.target);
  assert.deepEqual(result, row.result);
  assert.equal(draws, row.randomDraws);
}
console.log(`PASS: ${native.rows.length} native type-6 all source motion modes, angles, frame/random and alpha updates match Web`);
