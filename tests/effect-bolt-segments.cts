import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectBoltConfig, EffectBoltSegments, generateEffectBoltSegments, effectBoltWorldSegments} from '../apps/web/src/render/effects/bolts/effect-bolt-segments';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Row extends EffectBoltSegments {
  node: number;
  config: EffectBoltConfig;
  origin: EffectVec3;
  randomValues: number[];
  worldSegments: number[][];
}
const native = JSON.parse(readFileSync('recovery/output/effect-bolt-segments-native.json', 'utf8')) as {rows: Row[]};
for (const [index, row] of native.rows.entries()) {
  let randomIndex = 0;
  const actual = generateEffectBoltSegments(row.config, row.origin, () => {
    assert.ok(randomIndex < row.randomValues.length);
    return row.randomValues[randomIndex++];
  });
  assert.deepEqual(actual, {start: row.start, end: row.end, segments: row.segments}, `node${row.node} sample${index}`);
  assert.equal(randomIndex, row.randomValues.length);
  assert.deepEqual(effectBoltWorldSegments(actual), row.worldSegments, `world node${row.node} sample${index}`);
}
console.log(`PASS: ${native.rows.length} original lightning endpoint/random segment samples`);
