import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {markRolePropertyDirty} from '../apps/server/src/battle/roles/property-dirty';
import {applyRoleFireReloadNotification} from '../apps/server/src/battle/roles/reload';
const evidence: {rows: {present: boolean; dirty: number; previous: number; value: number;
  result: boolean; stored: number; getters: number[]; pending: number[];
  events: {index: number; count: number; dirty: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-bullet-count-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = createRoleCombatState().record!;
  record.numericFields!.set(0x44, row.previous);
  const events: typeof row.events = [], pending = new Uint32Array(8);
  const role = new RoleCombatState(row.present ? record : undefined, index => {
    events.push({index, count: role.bulletCount, dirty: Number(role.dirty)});
    markRolePropertyDirty(pending, index);
  });
  role.dirty = row.dirty !== 0;
  assert.equal(role.setBulletCount(row.value), row.result);
  assert.equal(record.numericFields!.get(0x44), row.stored);
  assert.equal(role.bulletCount, row.getters[0]);
  assert.deepEqual([...pending], row.pending);
  assert.deepEqual(events, row.events);
  assert.equal(role.dirty, row.dirty !== 0);
  const deadline = {nextAvailableSeconds: 0};
  applyRoleFireReloadNotification({local: true, bulletCount: role.bulletCount,
    normalSeconds: 1, lastBulletSeconds: 3, currentSeconds: () => .5}, deadline, {forwarded: () => {}});
  assert.equal(deadline.nextAvailableSeconds, row.getters[0] === 1 ? 3.5 : 1.5);
}
const incomplete = new RoleCombatState({status: 0, flags: new Uint8Array(16), arrays: new Map()});
assert.equal(incomplete.setBulletCount(1), false);
console.log(`PASS: ${evidence.rows.length} native bullet-count setters/getters/pending8, same-value notify, dirty unchanged and actual reload branch composition`);
