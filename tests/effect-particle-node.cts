import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectParticleNodeState} from '../apps/web/src/render/effects/particles/effect-particle-node';
import {EffectEmitterClock} from '../apps/web/src/render/effects/particles/effect-emitter-clock';
import {EffectParticlePool} from '../apps/web/src/render/effects/particles/effect-particle-pool';
import {initialEffectParticle, EffectParticleSpawnConfig} from '../apps/web/src/render/effects/particles/effect-particle-spawn';
import {advanceEffectParticle, EffectParticleState, EffectParticleUpdateConfig} from '../apps/web/src/render/effects/particles/effect-particle-state';
import type {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Fixture {
  capacity: number;
  control: {emitter: {countRange: [number, number]; burst: boolean}; spawn: EffectParticleSpawnConfig;
    particleFrame: EffectParticleUpdateConfig['frame']; particleMotion: EffectParticleUpdateConfig['motion'];
    alphaMode: number; baseStart: number; orbit: {axis: EffectVec3; radius: number; angularRate: number}; motion: {position: EffectVec3; velocity: EffectVec3}};
  steps: {delta: number; randomValues: number[]; states: EffectParticleState[]; emitter: number[]; fraction: number}[];
}
const source = JSON.parse(readFileSync('recovery/output/effect-particle-node-native.json', 'utf8')) as Fixture;
let values: number[] = [], randomIndex = 0;
const random = (): number => {
  assert.ok(randomIndex < values.length, 'Unexpected native RNG consumption');
  return values[randomIndex++];
};
const emitter = new EffectEmitterClock((minimum, maximum) => minimum + random() % (maximum - minimum + 1));
const pool = new EffectParticlePool<EffectParticleState>(source.capacity, state => structuredClone(state));
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
let position: EffectVec3 = [0, 0, 0];
const orbit: EffectVec3 = [0, 0, 0];
const node = new EffectParticleNodeState([source.control], [{position: [0, 0, 0], orbitOffset: [0, 0, 0]}],
  [undefined], source.capacity, random, identity);
let elapsed = 0;
const config = {motion: source.control.particleMotion, frame: source.control.particleFrame,
  alphaMode: source.control.alphaMode};
for (const [index, step] of source.steps.entries()) {
  values = step.randomValues;
  randomIndex = 0;
  const delta = Math.fround(step.delta);
  position = position.map((p, i) => Math.fround(p + source.control.motion.velocity[i] * delta)) as EffectVec3;
  pool.emit(emitter.advance(delta, source.control.emitter), () => initialEffectParticle(source.control.spawn,
    source.control.particleFrame.frameCount, position, orbit, identity, random));
  pool.update(delta, (state, elapsed) => advanceEffectParticle(state, config, elapsed, count => random() % count));
  assert.equal(randomIndex, values.length, `RNG step${index}`);
  assert.equal(emitter.fraction, step.fraction, `Fraction step${index}`);
  assert.deepEqual([...position, ...orbit], step.emitter, `Emitter step${index}`);
  assert.deepEqual(pool.particles, step.states, `Particles step${index}`);
  randomIndex = 0;
  elapsed = Math.fround(elapsed + delta);
  node.update(elapsed, delta);
  assert.equal(randomIndex, values.length);
  assert.equal(node.emitter.fraction, step.fraction);
  assert.deepEqual(node.pool.particles, step.states, `Node particles step${index}`);
}
console.log(`PASS: ${source.steps.length} complete original type6 node17 ticks, shared RNG/spawn/capacity/lifetime ordering`);

const ends = JSON.parse(readFileSync('recovery/output/effect-particle-end-native.json', 'utf8'));
for (const row of ends.rows) {
  node.pool.clear();
  node.pool.emit(row.count, () => structuredClone(source.steps[1].states[0]));
  node.emitter.fraction = row.fraction;
  node.emitter.burstEmitted = Boolean(row.burst);
  node.end();
  assert.equal(node.pool.particles.length, row.result.count);
  assert.equal(node.emitter.fraction, row.result.fraction);
  assert.equal(node.emitter.burstEmitted, row.result.burst);
}
console.log(`PASS: ${ends.rows.length} original type6 end states`);
