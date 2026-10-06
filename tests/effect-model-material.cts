import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectModelAmbient} from '../apps/web/src/render/effects/models/effect-model-material';
const native = JSON.parse(readFileSync('recovery/output/effect-model-material-native.json', 'utf8')) as {rows: {
  properties: number[]; ambient: number[]; emissive: number; alpha: number; events: {kind: string; index?: number; values?: number[]}[];
}[]};
for (const row of native.rows) {
  const ambient = row.events.find(event => event.index === 4)!.values;
  assert.deepEqual(effectModelAmbient(row.properties, row.alpha, row), ambient);
  assert.deepEqual(row.events.map(event => event.kind), ['parameter', 'parameter', 'parameter', 'commit']);
}
console.log(`PASS: ${native.rows.length} original shader material parameters exact`);
