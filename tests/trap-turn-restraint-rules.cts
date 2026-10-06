import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyTrapTurnRestraint, clearTrapTurnRestraint, expireTrapTurnRestraint,
  readTrapTurnRestraintRule, resetTrapTurnRestraint,
  type TrapTurnRestraintParticipant, type TrapTurnPermissionProvider}
  from '../apps/server/src/battle/items/trap-turn-restraint';
import {isRoleMovementAllowed} from '../apps/server/src/battle/roles/movement-permission';

function fixture(initial: number | undefined) {
  let count = initial;
  const writes: number[] = [];
  const target: TrapTurnRestraintParticipant & {hp: number; slots: number[]; moveCount: number} = {
    alive: true, combat: {status: 2}, hp: 655, slots: [2001, 6], moveCount: 1};
  const provider: TrapTurnPermissionProvider = {
    readTurnPermissionCount: () => count,
    writeTurnPermissionCount: value => {count = value; writes.push(value);}};
  return {target, provider, writes, setCount: (value: number | undefined) => {count = value;},
    role: {status: 2, getFlag: (index: number) => index === 9 ? target.moveCount : index === 10 ? count ?? 0 : 0}};
}
const rows: unknown[] = [];
const rule = readTrapTurnRestraintRule();
assert.deepEqual(rule, {itemTableId: 3004, placementSkillId: 3004, effectSkillId: 4002,
  groundModelId: 3004, groundDurationMs: 30000, triggerRadius: 30, restraintDurationMs: 5000});
{
  const f = fixture(1);
  const applied = applyTrapTurnRestraint(f.target, 1000, f.provider)!;
  assert.equal(applied.kind, 'applied'); assert.equal(applied.turnPermissionCount, 0);
  assert.equal(applied.state.expiresAt, 6000);
  assert.equal(applyTrapTurnRestraint(f.target, 2000, f.provider), undefined);
  assert.equal(f.target.trapTurnRestraint!.expiresAt, 6000);
  const permission = Array.from({length: 8}, (_, i) => isRoleMovementAllowed(f.role, i + 1));
  assert.deepEqual(permission, [true, true, false, false, false, false, false, false]);
  assert.equal(expireTrapTurnRestraint(f.target, 5999, f.provider), undefined);
  const expired = expireTrapTurnRestraint(f.target, 6000, f.provider)!;
  assert.equal(expired.kind, 'expired'); assert.equal(expired.turnPermissionCount, 1);
  assert.equal(expireTrapTurnRestraint(f.target, 7000, f.provider), undefined);
  assert.deepEqual(f.writes, [0, 1]);
  assert.equal(f.target.hp, 655); assert.deepEqual(f.target.slots, [2001, 6]);
  assert.equal(f.target.moveCount, 1);
  rows.push({case: 'single-no-refresh-exact-expiry-permission', applied, expired, permission, writes: f.writes});
}
for (const current of [0, 4, 255]) {
  const f = fixture(2); applyTrapTurnRestraint(f.target, 1000, f.provider);
  f.setCount(current);
  const cleared = clearTrapTurnRestraint(f.target, f.provider)!;
  assert.equal(cleared.kind, 'cleared'); assert.equal(cleared.turnPermissionCount, (current + 1) & 255);
  assert.equal(clearTrapTurnRestraint(f.target, f.provider), undefined);
  assert.equal(expireTrapTurnRestraint(f.target, 6000, f.provider), undefined);
  assert.deepEqual(f.writes, [1, (current + 1) & 255]);
  rows.push({case: 'early-clear-current-count', current, cleared, writes: f.writes});
}
for (const initial of [0, undefined]) {
  const f = fixture(initial);
  assert.equal(applyTrapTurnRestraint(f.target, 1000, f.provider), undefined);
  assert.equal(f.target.trapTurnRestraint, undefined); assert.deepEqual(f.writes, []);
  rows.push({case: 'missing-or-zero-turn-source', initial, writes: f.writes});
}
for (const mode of ['dead', 'inactive', 'missing', 'reset'] as const) {
  const f = fixture(1); applyTrapTurnRestraint(f.target, 1000, f.provider);
  if (mode === 'dead') f.target.alive = false;
  if (mode === 'inactive') f.target.combat = {status: 3};
  if (mode === 'missing') f.setCount(undefined);
  const result = mode === 'reset' ? resetTrapTurnRestraint(f.target)
    : expireTrapTurnRestraint(f.target, 6000, f.provider);
  assert.equal(result?.kind, 'reset'); assert.equal(result?.turnPermissionChanged, false);
  assert.equal(f.target.trapTurnRestraint, undefined); assert.deepEqual(f.writes, [0]);
  assert.equal(f.target.hp, 655); assert.deepEqual(f.target.slots, [2001, 6]);
  rows.push({case: mode, result, writes: f.writes});
}
for (const mode of ['dead', 'inactive'] as const) {
  const f = fixture(1);
  if (mode === 'dead') f.target.alive = false; else f.target.combat = {status: 1};
  assert.equal(applyTrapTurnRestraint(f.target, 1000, f.provider), undefined);
  assert.deepEqual(f.writes, []); rows.push({case: 'apply-' + mode, writes: f.writes});
}
writeFileSync('recovery/output/trap-turn-restraint-rules.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', rule, rows,
  scope: 'New3004 turn contribution, original flag10 permission consumer, expiry/clear/reset only. No CAS/world/network/FX acceptance.'}, null, 2) + '\n');
console.log(`PASS: ${rows.length} new3004 pure turn-restraint cases`);
