import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {dispatchRoleLifecycleNotification} from '../recovery/evidence/roles/role-respawn-notification';

const original = JSON.parse(readFileSync('recovery/output/respawn-rules-sol-native.json', 'utf8'));
const results: unknown[] = [];
for (const row of original.rows) {
  const flags = Uint8Array.from({length: 16}, (_, index) => index);
  const events: unknown[] = [];
  const role = new RoleCombatState(row.hasRecord ? {
    status: 1, flags, arrays: new Map(),
  } : undefined, index => events.push({kind: 'notify', index, state: snapshot()}));
  role.activeActionId = 77;
  role.specialFlag12 = 7;
  role.nextAvailableSeconds = 4.375;
  role.flag8Seconds = .125;
  function snapshot() {
    return {status: role.record?.status ?? null, flags: [...flags],
      action: role.activeActionId, special12: role.specialFlag12,
      deadline: role.nextAvailableSeconds, flag8Seconds: role.flag8Seconds,
      dirty: Number(role.dirty)};
  }
  const emit = (kind: string, args: number[]) => events.push({kind, arguments: args, state: snapshot()});
  const roleAddress = 0x2002000;
  const localRole = new RoleCombatState(undefined);
  dispatchRoleLifecycleNotification(row.hasRole ? role : undefined, row.status, {
    roleId: 71, localRole,
    statusChanged: row.callbacks & 1 ? (received, status) => {
      assert.equal(received, role); emit('status', [roleAddress, status]);
    } : undefined,
    death: row.callbacks & 1 ? received => {
      assert.equal(received, role); emit('death', [roleAddress]);
    } : undefined,
    respawn: row.callbacks & 1 ? received => {
      assert.equal(received, role); emit('respawn', [roleAddress]);
    } : undefined,
    localRelationChanged: row.callbacks & 2 ? value => emit('localRelation', [value]) : undefined,
    queryLocalRelation(received) {
      assert.equal(received, localRole);
      emit('queryLocalRelation', [roleAddress + 0x800]); return row.relation;
    },
    activateId: id => emit('activateId', [id]),
    activateRole: received => {assert.equal(received, role); emit('activateRole', [roleAddress]);},
    refreshRole: received => {assert.equal(received, role); emit('refreshRole', [roleAddress]);},
    deathFollowup: (received, argument) => {
      assert.equal(received, role); emit('deathFollowup', [roleAddress, argument]);
    },
  });
  assert.deepEqual(snapshot(), row.result);
  assert.deepEqual(events, row.events);
  results.push({hasRecord: row.hasRecord, hasRole: row.hasRole, status: row.status,
    callbacks: row.callbacks, relation: row.relation});
}
writeFileSync('recovery/output/respawn-rules-sol.json', JSON.stringify({status: 'PASS', cases: results.length,
  scope: 'Shared lifecycle notification dispatcher compared to original executable fixture snapshots and ordered observers/services. Independent module; no World integration or player acceptance.', results}, null, 2) + '\n');
console.log(`PASS: ${results.length} shared lifecycle notifications match original snapshots and call order`);
