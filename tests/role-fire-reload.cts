import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoleFireReloadNotification} from '../apps/server/src/battle/roles/reload';
const evidence: {rows: {local: boolean; bulletCount: number; normalSeconds: number;
  lastBulletSeconds: number; currentSeconds: number; durationObserver: boolean; completionObserver: boolean;
  deadline: number; events: {kind: string; value?: number; role?: boolean; argument?: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-fire-reload-native.json', 'utf8'));
for (const row of evidence.rows) {
  const state = {nextAvailableSeconds: 9.25};
  const events: typeof row.events = [];
  applyRoleFireReloadNotification({...row, currentSeconds: () => {events.push({kind: 'clock'}); return row.currentSeconds;}},
    state, {duration: row.durationObserver ? value => events.push({kind: 'duration', value}) : undefined,
      localComplete: row.completionObserver ? () => events.push({kind: 'localComplete'}) : undefined,
      forwarded: () => events.push({kind: 'forwarded', role: row.local, argument: 77})});
  assert.equal(state.nextAvailableSeconds, row.deadline);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${evidence.rows.length} original bullet-count reload selection, f32 deadline, clock/observer order and remote forwarding`);
