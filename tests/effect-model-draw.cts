import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectModelDraw} from '../apps/web/src/render/effects/models/effect-model-draw';
import {EffectModelNodeState} from '../apps/web/src/render/effects/models/effect-model-node';
interface Row {
  node: number;
  sample: number;
  state: EffectModelNodeState;
  parent: number[] | null;
  globalMatrix: number[];
  blend: number;
  alpha: number;
  priority: number;
  events: {kind: string; matrix?: number[]}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-model-draw-native.json', 'utf8')) as {threshold: number; rows: Row[]};
assert.equal(native.threshold, 1);
let maximumError = 0;
for (const row of native.rows) {
  const draw = effectModelDraw(row.state, row.parent ?? undefined, row.globalMatrix);
  const attachment = row.events.find(event => event.kind === 'attach');
  assert.deepEqual(row.events.map(event => event.kind), attachment ? ['push', 'attach', 'pop'] : ['push', 'pop']);
  assert.equal(!!draw, !!attachment);
  if (!draw) continue;
  assert.equal(draw.blend, row.blend);
  assert.equal(draw.alpha, row.alpha);
  assert.equal(draw.priority, row.priority);
  draw.matrix.forEach((value, axis) => {
    const error = Math.abs(value - attachment!.matrix![axis]);
    maximumError = Math.max(maximumError, error);
    assert.ok(error <= .000030517578125, `node${row.node} sample${row.sample} matrix${axis}: ${error}`);
  });
}
console.log(`PASS: ${native.rows.length} complete original type5 draws, maximum matrix error ${maximumError}`);
