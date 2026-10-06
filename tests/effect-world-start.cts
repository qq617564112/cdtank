import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startEffectInWorld, startUnboundEffect} from '../apps/web/src/render/effects/runtime/effect-world-start';

const evidence = JSON.parse(readFileSync('recovery/output/effect-world-start-native.json', 'utf8'));
for (const row of evidence.rows) {
  const events: unknown[] = [];
  const node = {};
  const hooks = {
    find(id: number) {
      events.push({event: 'find', id});
      return row.found ? node : undefined;
    },
    create(id: number) {
      events.push({event: 'create', id});
      return row.created ? node : undefined;
    },
    addActive() { events.push({event: 'addActive'}); },
    startWorld(_node: object, position: number[]) {
      events.push({event: 'startWorld', position});
    },
  };
  const result = row.origin ? startUnboundEffect(row.enabled, row.id, hooks) :
    startEffectInWorld(row.enabled, row.id, row.position, hooks);
  assert.equal(result === node, row.returned);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${evidence.rows.length} world/unbound starts match original manager dispatch`);
