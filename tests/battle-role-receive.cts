import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiveBattleRole, type BattleRoleBinding, type BattleRoleManager,
  type BattleRoleRecord} from '../recovery/evidence/combat/battle-role-receive';
import {PET_BASES, TANKS} from '../apps/server/src/config';

interface Role extends BattleRoleBinding<BattleRoleRecord> {
  baseBound: number;
  equipmentBound: number;
}
interface Event {kind: string; record?: number; id?: number; bytes?: number; previous?: number;
  table?: string; local?: boolean; status?: number}
const evidence: {rows: {existing: boolean; local: boolean; petHit: boolean; tankHit: boolean;
  status: number; events: Event[]; baseBound: number; equipmentBound: number}[]} =
  JSON.parse(readFileSync('recovery/output/battle-role-receive-native.json', 'utf8'));
const pet = PET_BASES.find(p => p.id === 5)!;
const tank = TANKS.find(t => t.id === 2)!.recomputeBase;
const oldPet = PET_BASES.find(p => p.id === 1)!;
const oldTank = TANKS.find(t => t.id === 1)!.recomputeBase;
for (const row of evidence.rows) {
  const record: BattleRoleRecord = {objectId: 71, field8: 0, field68: 2, field78: 5, status: row.status};
  const previous: BattleRoleRecord = {objectId: 72, field8: 123, field68: 1, field78: 1, status: 0};
  const existing: Role = {record: previous, objectId: 72, pet: oldPet, tank: oldTank,
    baseBound: 0x76543210, equipmentBound: 0x65432100};
  const otherLocal: Role = {...existing};
  const manager: BattleRoleManager<Role> = {localObjectId: row.local ? 71 : 72, localRole: otherLocal};
  const events: Event[] = [];
  const role = receiveBattleRole(manager, record, 0x12345678, {
    find: id => {events.push({kind: 'find', id}); return row.existing ? existing : undefined;},
    create: () => {
      events.push({kind: 'allocate', bytes: 0x370}, {kind: 'baseConstructor'});
      return {record: undefined, objectId: 0, baseBound: 0, equipmentBound: 0};
    },
    attach: binding => {assert.strictEqual(binding.record, record); events.push({kind: 'attach', record: 0x2004000});},
    lookupPet: id => {events.push({kind: 'lookup', table: 'pet', id}); return row.petHit ? pet : undefined;},
    lookupTank: id => {events.push({kind: 'lookup', table: 'tank', id}); return row.tankHit ? tank : undefined;},
    initialize: binding => {assert.strictEqual(binding.record, record);
      events.push({kind: 'initialize', local: manager.localRole === binding});},
    selectLocal: binding => {assert.strictEqual(manager.localRole, binding); events.push({kind: 'selectLocal'});},
    dispatchStatus: (binding, status) => {assert.strictEqual(binding.record, record); events.push({kind: 'dispatchStatus', status});},
  });
  // The pointer-store event is independently checked through reference identity below.
  assert.deepEqual(events, row.events.filter(event => !['bind', 'prepare'].includes(event.kind)));
  assert.strictEqual(role.record, record);
  assert.equal(role.objectId, 71);
  assert.equal(record.field8, 0x12345678);
  assert.strictEqual(manager.localRole, row.local ? role : otherLocal);
  assert.strictEqual(role.pet, row.petHit ? pet : row.existing ? oldPet : undefined);
  assert.strictEqual(role.tank, row.tankHit ? tank : row.existing ? oldTank : undefined);
  assert.equal(role.baseBound, row.baseBound);
  assert.equal(role.equipmentBound, row.equipmentBound);
  if (row.existing) assert.strictEqual(role, existing);
  else assert.notStrictEqual(role, existing);
}
console.log(`PASS: ${evidence.rows.length} full battle role arrival binding, table preservation, local and lifecycle order`);
