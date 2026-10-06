import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectNodeLifecycle} from '../apps/web/src/render/effects/runtime/effect-lifecycle';
import {EffectParticleNodeState, EffectParticleController} from '../apps/web/src/render/effects/particles/effect-particle-node';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectParticleState} from '../apps/web/src/render/effects/particles/effect-particle-state';
interface Fixture {
  timing: EffectTimelineConfig;
  control: EffectParticleController;
  capacity: number;
  steps: {delta: number; randomValues: number[]; phase: number; elapsed: number; controller: number;
    burst: boolean; fraction: number; emitter: number[]; states: EffectParticleState[]}[];
}
const source = JSON.parse(readFileSync('recovery/output/effect-particle-lifecycle-native.json', 'utf8')) as Fixture;
let values: number[] = [], randomIndex = 0;
const random = (): number => {
  assert.ok(randomIndex < values.length);
  return values[randomIndex++];
};
const particle = new EffectParticleNodeState([source.control], [{position: [0, 0, 0], orbitOffset: [0, 0, 0]}],
  [undefined], source.capacity, random, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const lifecycle = new EffectNodeLifecycle(source.timing, {
  start: () => particle.start([0, 0, 0]),
  activate: () => {},
  reset: (_, controller) => particle.reset(controller),
  update: (node, delta) => particle.update(node.elapsed, delta),
  end: () => particle.end(),
  release: () => {},
  additionalEnd: () => false,
});
lifecycle.start();
for (const [index, step] of source.steps.entries()) {
  values = step.randomValues;
  randomIndex = 0;
  lifecycle.tick(step.delta);
  assert.equal(lifecycle.phase, step.phase, `phase${index}`);
  assert.equal(lifecycle.elapsed, step.elapsed, `elapsed${index}`);
  assert.equal(lifecycle.controller, step.controller, `controller${index}`);
  assert.equal(randomIndex, values.length, `rng${index}`);
  assert.equal(particle.emitter.fraction, step.fraction, `fraction${index}`);
  assert.equal(particle.emitter.burstEmitted, step.burst, `burst${index}`);
  assert.deepEqual([...particle.spaces[0].position, ...particle.spaces[0].orbitOffset], step.emitter);
  assert.deepEqual(particle.pool.particles, step.states, `particles${index}`);
}
console.log(`PASS: ${source.steps.length} original full type6 lifecycle/start/space/emission/particles/end states`);
