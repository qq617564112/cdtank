import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyTrapFireRestraint, clearTrapFireRestraint, expireTrapFireRestraint,
  readTrapFireRestraintRule, resetTrapFireRestraint,
  type TrapFireRestraintParticipant, type TrapFirePermissionProvider}
  from '../apps/server/src/battle/items/trap-fire-restraint';
import {isRoleFireReady} from '../apps/server/src/battle/roles/reload';

function fixture(initial: number | undefined) {
  let count = initial;
  const writes: number[] = [];
  const target: TrapFireRestraintParticipant & {hp: number; slots: number[]; moveCount: number; turnCount: number} = {
    alive: true, combat: {status: 2}, hp: 655, slots: [2001, 6], moveCount: 1, turnCount: 1};
  const provider: TrapFirePermissionProvider = {
    readFirePermissionCount: () => count,
    writeFirePermissionCount: value => {count = value; writes.push(value);}};
  return {target, provider, writes, setCount: (value: number | undefined) => {count = value;},
    role: {status: 2, getFlag: (index: number) => index === 9 ? target.moveCount : index === 10 ? target.turnCount : index === 11 ? count ?? 0 : 0}};
}
const rows: unknown[] = [];
const rule = readTrapFireRestraintRule();
assert.deepEqual(rule, {itemTableId: 3005, placementSkillId: 3005, effectSkillId: 4003,
  groundModelId: 3005, groundDurationMs: 30000, triggerRadius: 30, restraintDurationMs: 5000});
{
  const f = fixture(1);
  const applied = applyTrapFireRestraint(f.target, 1000, f.provider)!;
  assert.equal(applied.kind, 'applied'); assert.equal(applied.firePermissionCount, 0);
  assert.equal(applied.state.expiresAt, 6000);
  assert.equal(applyTrapFireRestraint(f.target, 2000, f.provider), undefined);
  assert.equal(f.target.trapFireRestraint!.expiresAt, 6000);
  const permission = isRoleFireReady(f.role.getFlag(11) !== 0, 6, 6);
  assert.equal(permission, false);
  assert.equal(f.role.getFlag(9), 1); assert.equal(f.role.getFlag(10), 1);
  assert.equal(expireTrapFireRestraint(f.target, 5999, f.provider), undefined);
  const expired = expireTrapFireRestraint(f.target, 6000, f.provider)!;
  assert.equal(expired.kind, 'expired'); assert.equal(expired.firePermissionCount, 1);
  assert.equal(isRoleFireReady(f.role.getFlag(11) !== 0, 6, 6), true);
  assert.equal(expireTrapFireRestraint(f.target, 7000, f.provider), undefined);
  assert.deepEqual(f.writes, [0, 1]);
  assert.equal(f.target.hp, 655); assert.deepEqual(f.target.slots, [2001, 6]);
  assert.equal(f.target.moveCount, 1);
  rows.push({case: 'single-no-refresh-exact-expiry-permission', applied, expired, permission, writes: f.writes});
}
for (const current of [0, 4, 255]) {
  const f = fixture(2); applyTrapFireRestraint(f.target, 1000, f.provider);
  f.setCount(current);
  const cleared = clearTrapFireRestraint(f.target, f.provider)!;
  assert.equal(cleared.kind, 'cleared'); assert.equal(cleared.firePermissionCount, (current + 1) & 255);
  assert.equal(clearTrapFireRestraint(f.target, f.provider), undefined);
  assert.equal(expireTrapFireRestraint(f.target, 6000, f.provider), undefined);
  assert.deepEqual(f.writes, [1, (current + 1) & 255]);
  rows.push({case: 'early-clear-current-count', current, cleared, writes: f.writes});
}
for (const initial of [0, undefined]) {
  const f = fixture(initial);
  assert.equal(applyTrapFireRestraint(f.target, 1000, f.provider), undefined);
  assert.equal(f.target.trapFireRestraint, undefined); assert.deepEqual(f.writes, []);
  rows.push({case: 'missing-or-zero-fire-source', initial, writes: f.writes});
}
for (const mode of ['dead', 'inactive', 'missing', 'reset'] as const) {
  const f = fixture(1); applyTrapFireRestraint(f.target, 1000, f.provider);
  if (mode === 'dead') f.target.alive = false;
  if (mode === 'inactive') f.target.combat = {status: 3};
  if (mode === 'missing') f.setCount(undefined);
  const result = mode === 'reset' ? resetTrapFireRestraint(f.target)
    : expireTrapFireRestraint(f.target, 6000, f.provider);
  assert.equal(result?.kind, 'reset'); assert.equal(result?.firePermissionChanged, false);
  assert.equal(f.target.trapFireRestraint, undefined); assert.deepEqual(f.writes, [0]);
  assert.equal(f.target.hp, 655); assert.deepEqual(f.target.slots, [2001, 6]);
  rows.push({case: mode, result, writes: f.writes});
}
for (const mode of ['dead', 'inactive'] as const) {
  const f = fixture(1);
  if (mode === 'dead') f.target.alive = false; else f.target.combat = {status: 1};
  assert.equal(applyTrapFireRestraint(f.target, 1000, f.provider), undefined);
  assert.deepEqual(f.writes, []); rows.push({case: 'apply-' + mode, writes: f.writes});
}
writeFileSync('recovery/output/trap-fire-restraint-rules.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', rule, rows,
  scope: 'New3005 fire contribution, original flag11 fire-deadline consumer, expiry/clear/reset only. No CAS/world/network/FX acceptance.'}, null, 2) + '\n');
console.log(`PASS: ${rows.length} new3005 pure fire-restraint cases`);
