import assert from 'node:assert/strict';
import fs from 'node:fs';
import {advanceSpriteAppearance, initialSpriteAppearance, EffectSpriteAppearanceConfig} from '../apps/web/src/render/effects/sprites/appearance';
import {integrateSpriteMotion} from '../apps/web/src/render/effects/common/motion';

const config: EffectSpriteAppearanceConfig = {
  scale: [10, 20, 30], scaleRate: [15, -40, 0],
  angles: [0, 45, 90], angleRate: [360, -90, 0],
  color: [.75, .25, 0, 1], colorSubtractRate: [1, -1, 0, 4],
};
const state = initialSpriteAppearance(config);
assert.deepEqual(advanceSpriteAppearance(state, config, .25), {
  scale: [13.75, 10, 30], angles: [90, 22.5, 90], color: [.5, .5, 0, 0],
});
assert.deepEqual(advanceSpriteAppearance(state, config, 1).color, [0, 1, 0, 0]);
assert.deepEqual(state.scale, [10, 20, 30]);
assert.notEqual(state.scale, config.scale);
assert.deepEqual(advanceSpriteAppearance(state, config, 0), state);
assert.throws(() => advanceSpriteAppearance(state, config, -1));
assert.throws(() => integrateSpriteMotion({position: [0, 0, 0], velocity: [0, 0, 0]},
  [0, 0, 0], Infinity));

// Updated velocity drives position; no half-acceleration term or catch-up loop.
const moving = {position: [0, 0, 0] as [number, number, number],
  velocity: [0, 0, 0] as [number, number, number]};
assert.deepEqual(integrateSpriteMotion(moving, [0, 16, 0], .25), {
  position: [0, 1, 0], velocity: [0, 4, 0],
});
const halfStep = integrateSpriteMotion(moving, [0, 16, 0], .125);
assert.equal(integrateSpriteMotion(halfStep, [0, 16, 0], .125).position[1], .75);

// Exact binary inputs expose native Z spill versus X/Y extended product.
const delta = 1 + 2 ** -22, rate = 1 + 2 ** -23;
const precisionMotion = integrateSpriteMotion({position: [0, 0, 0], velocity: [-1, -1, -1]},
  [rate, rate, rate], delta);
assert.deepEqual(precisionMotion.velocity,
  [3 * 2 ** -23 + 2 ** -45, 3 * 2 ** -23 + 2 ** -45, 3 * 2 ** -23]);
// Scale/angle helpers spill all products; color keeps the product until subtraction.
const precisionConfig: EffectSpriteAppearanceConfig = {
  scale: [-1, -1, -1], scaleRate: [rate, rate, rate],
  angles: [-1, -1, -1], angleRate: [rate, rate, rate],
  color: [1, 1, 1, 1], colorSubtractRate: [rate, rate, rate, rate],
};
assert.deepEqual(advanceSpriteAppearance(initialSpriteAppearance(precisionConfig),
  precisionConfig, delta).scale, [3 * 2 ** -23, 3 * 2 ** -23, 3 * 2 ** -23]);
assert.deepEqual(advanceSpriteAppearance(initialSpriteAppearance(precisionConfig),
  precisionConfig, 1 - 2 ** -23).color, [2 ** -46, 2 ** -46, 2 ** -46, 2 ** -46]);

const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const explosion = library.spriteControls.find((c: {node: number}) => c.node === 2431);
assert.deepEqual(explosion.appearance, {
  scale: [10, 10, 10], scaleRate: [15, 15, 15], angles: [0, 0, 0],
  angleRate: [0, 0, 0], color: [1, 1, 0, 1], colorSubtractRate: [0, 0, 0, -5],
});
assert.deepEqual(explosion.motion, {position: [0, 2, 0], velocity: [0, 5, 0],
  acceleration: [0, 15, 0]});
assert.deepEqual(advanceSpriteAppearance(initialSpriteAppearance(explosion.appearance),
  explosion.appearance, .25), {
  scale: [13.75, 13.75, 13.75], angles: [0, 0, 0], color: [1, 1, 0, 1],
});
assert.deepEqual(integrateSpriteMotion(explosion.motion, explosion.motion.acceleration, .25), {
  position: [0, 4.1875, 0], velocity: [0, 8.75, 0],
});
for (const control of library.spriteControls) {
  const next = advanceSpriteAppearance(initialSpriteAppearance(control.appearance),
    control.appearance, .016);
  assert.ok([...next.scale, ...next.angles, ...next.color].every(Number.isFinite));
  assert.ok(next.color.every(v => v >= 0 && v <= 1));
}
const native = JSON.parse(fs.readFileSync('recovery/output/effect-sprite-native.json', 'utf8'));
assert.equal(native.exeSha256, library.exeSha256);
assert.equal(native.rows.length, library.spriteControls.length * 2 + 2);
for (const row of native.rows) {
  const control = library.spriteControls.find((c: {node: number; modifier: number}) =>
    c.node === row.node && c.modifier === row.modifier);
  assert.ok(control);
  assert.deepEqual(advanceSpriteAppearance(initialSpriteAppearance(control.appearance),
    control.appearance, row.delta), row.appearance,
  `original appearance ${row.node}/${row.modifier}/${row.precision}`);
  assert.deepEqual(integrateSpriteMotion(control.motion, control.motion.acceleration,
    row.delta), row.motion,
  `original motion ${row.node}/${row.modifier}/${row.precision}`);
}
console.log(`PASS: Web arithmetic matches ${native.rows.length} executed original x86 cases (53/64-bit x87)`);
console.log('PASS: native sprite scale/angles/RGBA, subtraction/clamp, semi-implicit motion, f32 spills, 1088 source controls');
