import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {applyRoleAmmoChangeReloadNotification} from '../recovery/evidence/roles/reload';
import {applyRoleFireReloadNotification} from '../apps/server/src/battle/roles/reload';
interface State {seconds: number; deadline: number}
interface Event {kind: string; value?: number; state?: State}
const evidence: {rows: {present: boolean; selectionObserver: boolean; durationObserver: boolean;
  field0c: number; seconds: number; current: number; result: State; events: Event[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-change-native.json', 'utf8'));
for (const row of evidence.rows) {
  const role = createRoleCombatState();
  role.roleFloatFields.set(0x54, 9.25);
  role.nextAvailableSeconds = 7.25;
  const beforeRecord = [...role.record!.numericFields!];
  const events: Event[] = [];
  const state = (): State => ({seconds: role.roleFloatFields.get(0x54)!, deadline: role.nextAvailableSeconds});
  applyRoleAmmoChangeReloadNotification({field0c: row.field0c, seconds: row.seconds,
    currentSeconds: () => {events.push({kind: 'clock', state: state()}); return row.current;}},
  row.present ? role : undefined, {
    ammoChanged: row.selectionObserver ? value => events.push({kind: 'changed', value, state: state()}) : undefined,
    duration: row.durationObserver ? value => events.push({kind: 'duration', value, state: state()}) : undefined,
    missingRole: () => events.push({kind: 'log'}),
  });
  assert.deepEqual(state(), row.result);
  assert.deepEqual(events, row.events);
  assert.deepEqual([...role.record!.numericFields!], beforeRecord);
  if (row.present) {
    for (const count of [0, 1, 2, 0xffffffff]) {
      applyRoleFireReloadNotification({local: true, bulletCount: count, normalSeconds: .75,
        lastBulletSeconds: role.roleFloatFields.get(0x54)!, currentSeconds: () => .5}, role, {forwarded: () => {}});
      assert.equal(role.nextAvailableSeconds, Math.fround(.5 + (count === 1 ? row.seconds : .75)));
    }
  }
}
console.log(`PASS: ${evidence.rows.length} native ammo-confirmation overrides, observer ordering, record preservation and next-fire duration composition`);
