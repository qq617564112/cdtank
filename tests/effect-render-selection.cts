import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectSpriteRenderScript} from '../apps/web/src/render/effects/common/effect-render-selection';

const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const native = JSON.parse(fs.readFileSync('recovery/output/effect-render-native.json', 'utf8'));
assert.equal(native.exeSha256, library.exeSha256);
assert.equal(native.cases.length, 520);
for (const row of [...native.cases, ...library.rendering.spriteSelections]) {
  assert.equal(selectSpriteRenderScript(row.flags, row.screenSpace), row.selector,
    `flags=${row.flags} screen=${row.screenSpace}`);
}
assert.equal(selectSpriteRenderScript(0, false), 0);
assert.equal(selectSpriteRenderScript(2, false), 2);
assert.equal(selectSpriteRenderScript(4, false), 1);
assert.equal(selectSpriteRenderScript(6, false), 3);
assert.equal(selectSpriteRenderScript(8, false), 8);
assert.equal(selectSpriteRenderScript(10, false), 9);
assert.equal(selectSpriteRenderScript(12, false), 6);
assert.equal(selectSpriteRenderScript(14, false), 7);
console.log('PASS: Web GBF selector matches 520 original x86 flag cases and 1088 source controls');
