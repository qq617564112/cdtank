import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mv3Ambient} from '../apps/web/src/render/materials/mv3-material';

const native = JSON.parse(readFileSync('recovery/output/mv3-normal-d3d-state-sol-native.json', 'utf8'));
for (const row of native.rows) {
  const expected = row.events.find((event: {handle?: number}) => event.handle === 104).values;
  assert.deepEqual(mv3Ambient(row.properties, row.nodeOpacity, row.graphics.slice(0, 3), row.graphics[4]), expected);
}
console.log(`PASS: ${native.rows.length} MV3 ambient parameters match original RenderInfo/material execution`);
