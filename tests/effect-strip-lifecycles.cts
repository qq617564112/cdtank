import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectNodeLifecycle} from '../apps/web/src/render/effects/runtime/effect-lifecycle';
import {EffectStripNodeState, EffectStripController} from '../apps/web/src/render/effects/strips/effect-strip-node';
import {EffectSpriteState} from '../apps/web/src/render/effects/sprites/effect-sprite-reset';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
interface Fixture {
  node: number;
  timing: EffectTimelineConfig;
  controls: EffectStripController[];
  origin: EffectVec3;
  initialRandom: number[];
  frames: [number, number, number, number][];
  initial: EffectSpriteState & {frameRemainder: number};
  steps: {delta: number; randomValues: number[]; phase: number; elapsed: number;
    controller: number; scroll: number; uvs: [number,number,number,number][]; states: EffectSpriteState & {frameRemainder: number}}[];
}
const source = JSON.parse(readFileSync('recovery/output/effect-strip-lifecycles-native.json', 'utf8')) as {rows: Fixture[]};
const normalized = (states: EffectSpriteState[]): unknown => states.map(state =>
  Object.fromEntries(Object.entries(state).map(([key, value]) =>
    [key, Array.isArray(value) ? value.map(v => v === 0 ? 0 : v) : value])));
for (const row of source.rows) {
  let values = row.initialRandom, randomIndex = 0;
  const random = (): number => {
    assert.ok(randomIndex < values.length, `node${row.node} RNG`);
    return values[randomIndex++];
  };
  const sprite = new EffectStripNodeState(row.controls, row.frames, random,
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const lifecycle = new EffectNodeLifecycle(row.timing, {
    start: () => sprite.start(row.origin), activate: () => {},
    reset: (_, controller) => sprite.reset(controller),
    update: (node, delta) => sprite.update(node.elapsed, delta),
    end: () => {}, release: () => {}, additionalEnd: () => false,
  });
  lifecycle.start();
  assert.equal(randomIndex, values.length);
  assert.deepEqual(normalized([sprite.state]), normalized([row.initial]), `node${row.node} initial`);
  for (const [index, step] of row.steps.entries()) {
    values = step.randomValues;
    randomIndex = 0;
    lifecycle.tick(step.delta);
    const message = `node${row.node} tick${index}`;
    assert.equal(lifecycle.phase, step.phase, message);
    assert.equal(lifecycle.elapsed, step.elapsed, message);
    assert.equal(lifecycle.controller, step.controller, message);
    assert.equal(randomIndex, values.length, message);
    assert.equal(sprite.scroll, step.scroll, message);
    assert.deepEqual(sprite.geometry.map(segment => segment.uv), step.uvs, message);
    assert.deepEqual(normalized([sprite.state]), normalized([step.states]), message);
  }
}
console.log(`PASS: ${source.rows.length} complete original type7 source lifecycles`);
