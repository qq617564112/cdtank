import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialEffectStripGeometry, EffectStripGeometryConfig, EffectStripSegment} from '../apps/web/src/render/effects/strips/effect-strip-geometry';
import {EffectColor} from '../apps/web/src/render/effects/common/types';
interface Row {
  node: number;
  modifier: number;
  frames: [number, number, number, number][];
  config: EffectStripGeometryConfig;
  color: EffectColor;
  geometry: EffectStripSegment[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-strip-geometry-native.json', 'utf8')) as {rows: Row[]};
for (const row of native.rows) {
  const result = initialEffectStripGeometry(row.config, row.frames[0], row.color);
  assert.deepEqual(result, row.geometry, `node${row.node}/${row.modifier}`);
}
console.log(`PASS: ${native.rows.length} full original type7 strip geometries`);
