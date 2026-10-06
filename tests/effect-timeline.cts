import assert from 'node:assert/strict';
import fs from 'node:fs';
import {effectHasStarted, effectLifetimeEnded, selectEffectController} from '../apps/web/src/render/effects/runtime/effect-timeline';

const config = {delay: .25, lifetime: 1, controllers: [
  {start: .125, end: .5, flag: 0},
  {start: .5, end: .75, flag: 0},
  {start: .75, end: 1, flag: 0},
]};
assert.equal(effectHasStarted(.249, .25), false);
assert.equal(effectHasStarted(.25, .25), true);
assert.equal(effectLifetimeEnded(1.249, .25, 1), false);
assert.equal(effectLifetimeEnded(1.25, .25, 1), true);
assert.equal(effectLifetimeEnded(100, 0, 0), false);
assert.equal(effectLifetimeEnded(100, 0, -1), false);
assert.deepEqual(selectEffectController(.3, config, 0), {index: -1, resetIndices: []});
// While pending, exact first-start equality stays pending; strictly later selects 0.
assert.deepEqual(selectEffectController(.375, config, -1), {index: -1, resetIndices: []});
assert.deepEqual(selectEffectController(.376, config, -1), {index: 0, resetIndices: []});
assert.deepEqual(selectEffectController(.75, config, 0), {index: 0, resetIndices: []});
assert.deepEqual(selectEffectController(.751, config, 0), {index: 1, resetIndices: [1]});
assert.deepEqual(selectEffectController(1.01, config, 0), {index: 2, resetIndices: [1, 2]});
assert.deepEqual(selectEffectController(99, config, 2), {index: 2, resetIndices: []});
const unbounded = {...config, controllers: [{start: 0, end: 0, flag: 0}, config.controllers[1]]};
assert.deepEqual(selectEffectController(99, unbounded, 0), {index: 0, resetIndices: []});
assert.deepEqual(selectEffectController(99, {...config, controllers: []}, -1), {index: -1, resetIndices: []});
assert.throws(() => selectEffectController(.5, config, 4));
assert.deepEqual(selectEffectController(99, unbounded, -1), {index: -1, resetIndices: []});
assert.throws(() => selectEffectController(.5, config, -2));
// First-start uses the unrounded subtraction; later end checks use stored f32.
const firstStart = Math.fround(.3);
const delayed = {delay: Math.fround(.1), lifetime: 1,
  controllers: [{start: firstStart, end: 1, flag: 0}]};
const firstElapsed = Math.fround(.4);
assert.ok(firstElapsed - delayed.delay < firstStart);
assert.equal(Math.fround(firstElapsed - delayed.delay), firstStart);
assert.equal(selectEffectController(firstElapsed, delayed, 0).index, -1);
// f32 inputs must be added before comparison: avoid rounding the sum prematurely.
const delay = Math.fround(.1), lifetime = Math.fround(.2);
const elapsed = Math.fround(delay + lifetime);
assert.equal(effectLifetimeEnded(elapsed, delay, lifetime), elapsed >= delay + lifetime);

const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
assert.equal(library.nodeTimings.length, 3118);
const explosion = library.nodeTimings.find((r: {node: number}) => r.node === 2431);
assert.equal(explosion.delay, 0);
assert.equal(explosion.lifetime, .5);
assert.equal(effectLifetimeEnded(.5, explosion.delay, explosion.lifetime), true);
assert.deepEqual(selectEffectController(.5, explosion, 0), {index: 0, resetIndices: []});
const smoke = library.nodeTimings.find((r: {node: number}) => r.node === 2430);
assert.equal(smoke.controllers[0].start, Math.fround(.1));
assert.equal(selectEffectController(.05, smoke, 0).index, -1);
assert.equal(selectEffectController(.11, smoke, -1).index, 0);
console.log('PASS: delayed start, strict controller boundaries, multi-transition reset order, nonpositive limits, original explosion/smoke timeline');
