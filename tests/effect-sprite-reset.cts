import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resetEffectSprite, EffectSpriteState} from '../apps/web/src/render/effects/sprites/effect-sprite-reset';
import {EffectSpriteAppearanceConfig} from '../apps/web/src/render/effects/sprites/appearance';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface ResetRow {
  flag: number;
  origin: EffectVec3;
  position: EffectVec3;
  velocity: EffectVec3;
  appearance: EffectSpriteAppearanceConfig;
  state: EffectSpriteState;
  result: EffectSpriteState;
}
const native: {rows: ResetRow[]} = JSON.parse(readFileSync('recovery/output/effect-reset-native.json', 'utf8'));
for (const row of native.rows) {
  const resolved = row.position.map((value, index) => Math.fround(value + row.origin[index])) as EffectVec3;
  assert.deepEqual(resetEffectSprite(row.state, {
    baseFlag: row.flag, appearance: row.appearance, velocity: row.velocity,
  }, resolved, [0, 0, 0]), row.result);
}
console.log(`PASS: ${native.rows.length} complete native reset cases, preserve/full-reset flags and frame retention`);
