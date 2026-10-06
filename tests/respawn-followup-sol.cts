import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {setRoleHp} from '../apps/server/src/battle/roles/health';
import {applyRoleDeathFollowup} from '../recovery/evidence/combat/role-death-followup';

const original = JSON.parse(readFileSync('recovery/output/respawn-followup-sol-native.json', 'utf8'));
for (const row of original.rows) {
  const record = row.hasRecord ? {hp: row.initial.life, maxHp: 350} : undefined;
  const events: unknown[] = [];
  const state = () => ({life: record?.hp ?? null, status: 3, dirty: 0});
  const emit = (kind: string, args: number[]) => events.push({kind, arguments: args, state: state()});
  const role = {petType: row.petType, get id() {return row.hasRecord ? 71 : 0;},
    get life() {return record?.hp ?? 0;},
    setLife(value: 0) {
      setRoleHp(record, value, index => emit('notify', [index]));
    }};
  applyRoleDeathFollowup(row.hasRole ? role : undefined, {
    lifeChanged: row.callback ? (id, value) => emit('lifeCallback', [id, value]) : undefined,
    renderAction(received, action, category, option, enabled) {
      assert.equal(received, role); emit('renderAction', [action, category, option, enabled]);
    },
    worldDeath(received, argument) {
      assert.equal(received, role); emit('worldDeath', [0x2002000, argument]);
    },
    deactivateId: id => emit('deactivateId', [id]),
  });
  assert.deepEqual(state(), row.result);
  assert.deepEqual(events, row.events);
}
writeFileSync('recovery/output/respawn-followup-sol.json', JSON.stringify({status: 'PASS',
  cases: original.rows.length, scope: 'Independent shared423157 death followup orchestration versus real executable ordered events and state. Life storage supplied through original setter-shaped adapter; no production World or browser acceptance.'}, null, 2) + '\n');
console.log(`PASS: ${original.rows.length} death followups match original setter and downstream order`);
