import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoleCombatState, createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {observeRoleAmmoProperty} from '../recovery/evidence/roles/role-ammo-observer';
import {encodeRoleNumericProperty, receiveRoleNumericProperties} from '../recovery/evidence/roles/role-numeric-property';

interface Event {kind: string; objectId?: number; count?: number; maximum?: number}
const evidence: {rows: {stage: number; present: boolean; local: boolean; observer: boolean;
  index: number; count: number; maximum: number; events: Event[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-observer-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = createRoleCombatState().record!;
  record.numericFields!.set(0x44, row.count);
  record.numericFields!.set(0x38, row.maximum);
  const role = new RoleCombatState(record, () => assert.fail('ammo observer emitted pending notification'));
  role.dirty = (row.count & 1) !== 0;
  const beforeFields = [...record.numericFields!];
  const events: Event[] = [];
  observeRoleAmmoProperty(row.index, {
    stage: () => {events.push({kind: 'stage'}); return row.stage;},
    findRole: () => {events.push({kind: 'lookup', objectId: 73}); return row.present ? role : undefined;},
    isLocal: () => row.local,
    updated: row.observer ? (count, maximum) => events.push({kind: 'updated', count, maximum}) : undefined,
  });
  assert.deepEqual(events, row.events);
  assert.deepEqual([...record.numericFields!], beforeFields);
  assert.equal(role.dirty, (row.count & 1) !== 0);
}
// Actual property reception forwards to the business observer after each write.
const role = createRoleCombatState();
role.record!.numericFields!.set(0x38, 3);
role.dirty = false;
const events: {count: number; maximum: number}[] = [];
assert(receiveRoleNumericProperties(role.record!.numericFields!, [encodeRoleNumericProperty(8, 2), encodeRoleNumericProperty(5, 5), encodeRoleNumericProperty(8, 1)], 73,
  index => observeRoleAmmoProperty(index, {stage: () => 3, findRole: () => role,
    isLocal: () => true, updated: (count, maximum) => events.push({count, maximum})})));
assert.deepEqual(events, [{count: 2, maximum: 3}, {count: 2, maximum: 5}, {count: 1, maximum: 5}]);
assert.equal(role.dirty, false);
assert.equal(new RoleCombatState(undefined).maxBulletCount, 0);
console.log(`PASS: ${evidence.rows.length} original ammo observer gates/getters/order and property-receive business forwarding`);
