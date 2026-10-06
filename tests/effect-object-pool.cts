import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectObjectPool} from '../apps/web/src/render/effects/runtime/effect-object-pool';
const rows = JSON.parse(readFileSync('recovery/output/effect-object-pool-native.json', 'utf8')) as {
  operation: string; node: number; slots: number[]; activeCount: number; events: object[]; result?: number;
}[];
let nextNode = 0, events: object[] = [];
const pool = new EffectObjectPool(() => {
  const node = nextNode++; events.push({kind: 'create', node}); return node;
}, node => events.push({kind: 'unbind', node}));
for (const row of rows) {
  events = [];
  if (row.operation === 'take') assert.equal(pool.take(), row.result);
  else pool.release(row.node);
  assert.deepEqual(pool.slots, row.slots);
  assert.equal(pool.activeCount, row.activeCount);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${rows.length} original pool allocation/reuse/unbind/swap operations`);
