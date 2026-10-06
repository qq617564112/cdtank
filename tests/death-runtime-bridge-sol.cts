import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {
  advanceRoleDeathRuntime,
  resetRoleDeathRuntime,
  startRoleDeathRuntime,
  RoleDeathRuntimeServices,
} from '../recovery/evidence/combat/role-death-runtime-bridge';

interface Role {readonly id: number; readonly status: number;}
interface Row {
  readonly mode: number;
  readonly local: boolean;
  readonly matching: boolean;
  readonly status: number;
  readonly callback: boolean;
  readonly start: unknown[];
  readonly ticks: {countdown: number; events: unknown[]}[];
  readonly reset: unknown[];
  readonly absent: unknown[];
}
const original: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/death-runtime-bridge-sol-native.json', 'utf8'));
for (const row of original.rows) {
  const role: Role = {id: row.matching ? 71 : 72, status: 3};
  const local: Role = {id: 71, status: row.status};
  const events: unknown[] = [];
  const services: RoleDeathRuntimeServices<Role> = {
    accountRoleId: 71,
    roleId: value => value.id,
    roleStatus: value => value.status,
    currentStateType: () => row.mode,
    localRole: () => row.local ? local : undefined,
    schedule: (delay, countdown) => {events.push(['schedule', delay, countdown]);},
    cancel: () => {events.push(['cancel']);},
    countdownChanged: row.callback ? countdown => {events.push(['countdown', countdown]);} : undefined,
    reset: row.callback ? () => {events.push(['reset']);} : undefined,
    complete: row.callback ? () => {events.push(['complete']);} : undefined,
  };
  startRoleDeathRuntime(role, services);
  assert.deepEqual(events, row.start);
  for (const tick of row.ticks) {
    events.length = 0;
    advanceRoleDeathRuntime(tick.countdown, services);
    assert.deepEqual(events, tick.events);
  }
  events.length = 0;
  resetRoleDeathRuntime(role, services);
  assert.deepEqual(events, row.reset);
  events.length = 0;
  resetRoleDeathRuntime(undefined, services);
  assert.deepEqual(events, row.absent);
}
writeFileSync('recovery/output/death-runtime-bridge-sol.json', JSON.stringify({status: 'PASS', cases: original.rows.length,
  scope: 'Original4376bb death schedule,437626 callback and436464 revive cancellation ordered calls versus independent shared adapter; scheduling/cancellation remain supplied services.'}, null, 2) + '\n');
console.log(`PASS: ${original.rows.length} local death/countdown/revive service fixtures match original`);
