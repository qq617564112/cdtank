import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyEffectTrailAlpha, packEffectColor, unpackEffectColor} from '../apps/web/src/render/effects/common/effect-color';

assert.equal(packEffectColor([.5, .25, .75, 1]), 0xff7f3fbf);
assert.equal(packEffectColor([1, 0, 0, 0]), 0x00ff0000);
assert.equal(packEffectColor([0, 0, 1, 1]), 0xff0000ff);
assert.deepEqual(unpackEffectColor(0x127f34ab), [127 / 255, 52 / 255, 171 / 255, 18 / 255]);
assert.equal(applyEffectTrailAlpha(0xffabcdef, 1, 2), 0x80abcdef);
assert.equal(applyEffectTrailAlpha(0x00abcdef, 1, 2), 0x81abcdef);
assert.throws(() => applyEffectTrailAlpha(0, 0, 0));
const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const native = JSON.parse(fs.readFileSync('recovery/output/effect-color-native.json', 'utf8'));
assert.equal(native.exeSha256, library.exeSha256);
assert.equal(native.rows.length, (library.spriteControls.length + 5) * 2);
assert.ok(native.trails.length > 100);
assert.deepEqual(library.colorPacking, {multiplier: 255, trailUnit: 1, trailMultiplier: -255});
for (const row of native.rows) {
  assert.equal(packEffectColor(row.color), row.packed, JSON.stringify(row));
  assert.equal(packEffectColor(unpackEffectColor(row.packed)), row.packed);
}
for (const row of native.trails) {
  assert.equal(applyEffectTrailAlpha(row.packed, row.index, row.count), row.result, JSON.stringify(row));
}
console.log('PASS: Web diffuse quantization and modulo trail alpha match executed native code');
