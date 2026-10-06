import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyTrapRestraint, expireTrapRestraint, resetTrapRestraint, readTrapRestraintRule,
  type TrapRestraintParticipant, type TrapMovePermissionProvider} from '../apps/server/src/battle/items/trap-restraint';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {isRoleMovementAllowed, roleMovementCommand} from '../apps/server/src/battle/roles/movement-permission';

const rule = readTrapRestraintRule(); assert(rule);
assert.deepEqual(rule, {itemTableId: 3003, placementSkillId: 3003, effectSkillId: 4001,
  groundModelId: 3003, groundDurationMs: 30000, triggerRadius: 30, restraintDurationMs: 5000});
function fixture(count: number | undefined) {
  const combat = createRoleCombatState(); combat.setStatus(2);
  if (count !== undefined) combat.record!.flags[9] = count;
  let available = count !== undefined;
  const writes: number[] = [];
  const target: TrapRestraintParticipant & {hp: number} = {alive: true, combat, hp: 655};
  const permission: TrapMovePermissionProvider = {
    readMovePermissionCount: () => available ? combat.record!.flags[9] : undefined,
    writeMovePermissionCount: value => {writes.push(value); combat.record!.flags[9] = value;},
  };
  return {target, combat, permission, writes, loseSource: () => {available = false;}};
}
const rows = [];
for (const initialCount of [1, 2, 255]) {
  const {target, combat, permission, writes} = fixture(initialCount);
  const beforeSlots = [...combat.record!.arrays.get(4)!];
  const change = applyTrapRestraint(target, 1000, permission)!;
  assert.equal(change.kind, 'applied'); assert.equal(change.state.expiresAt, 6000);
  assert.equal(combat.record!.flags[9], initialCount - 1);
  const gate = {
    forward: isRoleMovementAllowed(combat, roleMovementCommand(1, 0)),
    reverse: isRoleMovementAllowed(combat, roleMovementCommand(-1, 0)),
    forwardTurn: isRoleMovementAllowed(combat, roleMovementCommand(1, 1)),
    bodyOnly: isRoleMovementAllowed(combat, roleMovementCommand(0, 1)),
  };
  assert.equal(gate.forward, initialCount > 1); assert.equal(gate.reverse, initialCount > 1);
  assert.equal(gate.forwardTurn, initialCount > 1); assert.equal(gate.bodyOnly, true);
  const state = target.trapRestraint;
  assert.equal(applyTrapRestraint(target, 2000, permission), undefined);
  assert.equal(target.trapRestraint, state); assert.deepEqual(writes, [initialCount - 1]);
  assert.equal(expireTrapRestraint(target, 5999, permission), undefined);
  const expired = expireTrapRestraint(target, 6000, permission)!;
  assert.equal(expired.kind, 'expired'); assert.equal(combat.record!.flags[9], initialCount);
  assert.equal(target.trapRestraint, undefined); assert.equal(expireTrapRestraint(target, 6001, permission), undefined);
  assert.equal(target.hp, 655); assert.deepEqual([...combat.record!.arrays.get(4)!], beforeSlots);
  rows.push({initialCount, change, gate, expired, writes});
}
for (const scenario of ['dead', 'status', 'zero', 'missing'] as const) {
  const {target, permission, writes} = fixture(scenario === 'zero' ? 0 : scenario === 'missing' ? undefined : 1);
  if (scenario === 'dead') target.alive = false;
  if (scenario === 'status') (target.combat as ReturnType<typeof createRoleCombatState>).setStatus(3);
  assert.equal(applyTrapRestraint(target, 1000, permission), undefined);
  assert.equal(target.trapRestraint, undefined); assert.deepEqual(writes, []);
  rows.push({scenario, writes});
}
for (const resetReason of ['death', 'status', 'round', 'missing'] as const) {
  const {target, combat, permission, writes, loseSource} = fixture(1);
  applyTrapRestraint(target, 1000, permission);
  if (resetReason === 'death') target.alive = false;
  if (resetReason === 'status') combat.setStatus(3);
  if (resetReason === 'missing') loseSource();
  const change = resetReason === 'round' ? resetTrapRestraint(target)
    : expireTrapRestraint(target, resetReason === 'missing' ? 6000 : 1500, permission);
  assert.equal(change?.kind, 'reset'); assert.deepEqual(writes, [0]);
  assert.equal(target.trapRestraint, undefined);
  combat.setStatus(2);
  assert.equal(combat.record!.flags[9], 1, 'Life initialization owns fresh permission');
  assert.equal(expireTrapRestraint(target, 6000, permission), undefined);
  rows.push({resetReason, writes});
}
for (const otherCount of [4, 255]) {
  const {target, combat, permission, writes} = fixture(1); applyTrapRestraint(target, 1000, permission);
  combat.record!.flags[9] = otherCount;
  const change = expireTrapRestraint(target, 6000, permission)!;
  assert.equal(change.movePermissionCount, (otherCount + 1) & 255);
  assert.equal(combat.record!.flags[9], (otherCount + 1) & 255);
  rows.push({otherCount, change, writes});
}
writeFileSync('recovery/output/trap-restraint-rules.json', JSON.stringify({status: 'PASS_MODULE_ONLY', rule,
  scope: 'Rebuilt trap contribution/count/expiry/reset contract using original movement permission consumer; no actual ground placement/ownership/network claim.', rows}, null, 2) + '\n');
console.log('PASS: source-linked3003/4001, one-count contribution, no refresh, original move gates, exact expiry/reset and preservation of other contributions');
