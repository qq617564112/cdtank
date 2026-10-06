import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {clearTrapRestraint, type TrapRestraintParticipant,
  type TrapMovePermissionProvider} from '../apps/server/src/battle/items/trap-restraint';

function fixture(count: number | undefined) {
  const target: TrapRestraintParticipant & {hp: number; positiveBuff: number; slots: number[]} = {
    alive: true, combat: {status: 2}, hp: 655, positiveBuff: 6, slots: [2001, 4006],
    trapRestraint: {itemTableId: 3003, skillId: 4001, expiresAt: 6000, removedMovePermission: 1},
  };
  const writes: number[] = [];
  let reads = 0;
  const permission: TrapMovePermissionProvider = {
    readMovePermissionCount: () => {reads++; return count;},
    writeMovePermissionCount: value => {writes.push(value); count = value;},
  };
  return {target, writes, permission, readCalls: () => reads};
}

const rows: unknown[] = [];
for (const currentCount of [0, 4, 255]) {
  const f = fixture(currentCount), state = f.target.trapRestraint;
  const result = clearTrapRestraint(f.target, f.permission);
  assert.deepEqual(result, {kind: 'cleared', state, movePermissionChanged: true,
    movePermissionCount: (currentCount + 1) & 255});
  assert.deepEqual(f.writes, [(currentCount + 1) & 255]);
  assert.equal(f.target.trapRestraint, undefined);
  assert.equal(clearTrapRestraint(f.target, f.permission), undefined);
  assert.equal(f.readCalls(), 1);
  assert.equal(f.target.hp, 655); assert.equal(f.target.positiveBuff, 6);
  assert.deepEqual(f.target.slots, [2001, 4006]);
  rows.push({currentCount, result, writes: f.writes, repeatReadCalls: f.readCalls()});
}
for (const scenario of ['dead', 'inactive', 'missingPermission', 'noState'] as const) {
  const f = fixture(scenario === 'missingPermission' ? undefined : 0);
  if (scenario === 'dead') f.target.alive = false;
  if (scenario === 'inactive') f.target.combat = {status: 3};
  if (scenario === 'noState') delete f.target.trapRestraint;
  const result = clearTrapRestraint(f.target, f.permission);
  if (scenario === 'noState') assert.equal(result, undefined);
  else {assert.equal(result?.kind, 'reset'); assert.equal(result?.movePermissionChanged, false);}
  assert.deepEqual(f.writes, []); assert.equal(f.target.trapRestraint, undefined);
  assert.equal(f.readCalls(), scenario === 'missingPermission' ? 1 : 0);
  assert.equal(f.target.hp, 655); assert.equal(f.target.positiveBuff, 6);
  assert.deepEqual(f.target.slots, [2001, 4006]);
  rows.push({scenario, result, writes: f.writes, reads: f.readCalls()});
}
writeFileSync('recovery/output/trap-restraint-clear-rules.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', rows,
  scope: 'New rebuilt trap cure contribution, single uint8 write, reset and repeat only; no CAS, injection or normal network acceptance.',
}, null, 2) + '\n');
console.log('PASS: seven new trap-clear conditions, one contribution/current uint8, no duplicate write, inactive/missing-source reset and unrelated state preserved');
