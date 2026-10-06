import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectNodeLifecycle} from '../apps/web/src/render/effects/runtime/effect-lifecycle';
import {EffectSpriteNodeState, EffectSpriteController} from '../apps/web/src/render/effects/sprites/effect-sprite-node';
import {EffectSpriteState} from '../apps/web/src/render/effects/sprites/effect-sprite-reset';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
interface Fixture {
  node: number;
  timing: EffectTimelineConfig;
  controls: EffectSpriteController[];
  origin: EffectVec3;
  initialRandom: number[];
  initial: EffectSpriteState[];
  steps: {delta: number; randomValues: number[]; phase: number; elapsed: number;
    controller: number; frameRemainder: number; trailElapsed: number; states: EffectSpriteState[]}[];
}
const source = JSON.parse(readFileSync('recovery/output/effect-sprite-lifecycles-native.json', 'utf8')) as {rows: Fixture[]};
const normalized = (states: EffectSpriteState[]): unknown => states.map(state =>
  Object.fromEntries(Object.entries(state).map(([key, value]) =>
    [key, Array.isArray(value) ? value.map(v => v === 0 ? 0 : v) : value])));
for (const row of source.rows) {
  let values = row.initialRandom, randomIndex = 0;
  const random = (): number => {
    assert.ok(randomIndex < values.length, `node${row.node} RNG`);
    return values[randomIndex++];
  };
  const sprite = new EffectSpriteNodeState(row.controls, random,
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const lifecycle = new EffectNodeLifecycle(row.timing, {
    start: () => sprite.start(row.origin), activate: () => {},
    reset: (_, controller) => sprite.reset(controller),
    update: (node, delta) => sprite.update(node.elapsed, delta),
    end: () => {}, release: () => {}, additionalEnd: () => false,
  });
  lifecycle.start();
  assert.equal(randomIndex, values.length);
  assert.deepEqual(normalized(sprite.history.entries), normalized(row.initial), `node${row.node} initial`);
  for (const [index, step] of row.steps.entries()) {
    values = step.randomValues;
    randomIndex = 0;
    lifecycle.tick(step.delta);
    const message = `node${row.node} tick${index}`;
    assert.equal(lifecycle.phase, step.phase, message);
    assert.equal(lifecycle.elapsed, step.elapsed, message);
    assert.equal(lifecycle.controller, step.controller, message);
    assert.equal(randomIndex, values.length, message);
    assert.equal(sprite.frameRemainder, step.frameRemainder, message);
    assert.equal(sprite.history.elapsed, step.trailElapsed, message);
    assert.deepEqual(normalized(sprite.history.entries), normalized(step.states), message);
  }
}
console.log(`PASS: ${source.rows.length} complete original type1 source non-path lifecycles`);
