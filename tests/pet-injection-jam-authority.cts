import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyPetInjection, type PetInjectionParticipant} from '../apps/server/src/battle/items/pet-injection';
import {applyTrapTurnRestraint, expireTrapTurnRestraint, type TrapTurnRestraintState} from '../apps/server/src/battle/items/trap-turn-restraint';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const rows: unknown[] = [];
for (const mode of ['clear1', 'clear2', 'CASfalse', 'storageError'] as const) {
  const combat = createRoleCombatState();
  combat.setStatus(2);
  combat.writeTurnPermissionCount(mode === 'clear2' ? 2 : 1);
  const player: PetInjectionParticipant & {trapTurnRestraint?: TrapTurnRestraintState; hp: number; positive: object} = {
    id: 'P2', name: 'Target', alive: true, x: 10, y: 0, z: 20, combat, hp: 700,
    positive: {skillId: 6}, inventory: [{instanceId: 9, itemTableId: 3,
      ownedQuantity: 2, battleQuantity: 2, state: 0, field8: 0,
      float24Bits: 0, float28Bits: 0, float2cBits: 0}],
  };
  const provider = {readTurnPermissionCount: () => combat.record?.flags[10],
    writeTurnPermissionCount: (count: number) => combat.writeTurnPermissionCount(count)};
  assert(applyTrapTurnRestraint(player, 1000, provider));
  const state = player.trapTurnRestraint;
  const beforeCount = combat.record!.flags[10];
  const positive = player.positive;
  const inventory = structuredClone(player.inventory);
  const events: MsgRoomEvent[] = [];
  let commits = 0;
  applyPetInjection('room', player, {kind: 'useItem', instanceId: 9}, () => {
    commits++;
    assert.equal(player.trapTurnRestraint, state, 'Durable consumption precedes permission restoration');
    assert.equal(combat.record!.flags[10], beforeCount);
    assert.deepEqual(player.inventory, inventory);
    if (mode === 'storageError') throw new Error('Storage fixture');
    return mode !== 'CASfalse';
  }, events, () => assert.fail('Trap cure does not change movement attributes'));
  assert.equal(commits, 1);
  assert.equal(player.hp, 700);
  assert.equal(player.positive, positive);
  if (mode === 'CASfalse' || mode === 'storageError') {
    assert.equal(player.trapTurnRestraint, state);
    assert.equal(combat.record!.flags[10], beforeCount);
    assert.deepEqual(player.inventory, inventory);
    assert.equal(events[0].type, 'itemRejected');
  } else {
    assert.equal(player.trapTurnRestraint, undefined);
    assert.equal(combat.record!.flags[10], beforeCount + 1);
    assert.equal(player.inventory[0].ownedQuantity, 1);
    assert.equal(player.inventory[0].battleQuantity, 1);
    assert.equal(events.filter(e => e.type === 'trapRestraintEnded').length, 1);
    assert.equal(events.filter(e => e.type === 'itemUsed' && e.skillId === 3).length, 1);
    assert.equal(expireTrapTurnRestraint(player, 6000, provider), undefined, 'Old deadline cannot restore twice');
    applyPetInjection('room', player, {kind: 'useItem', instanceId: 9}, () => assert.fail('No abnormal cannot consume'),
      events, () => assert.fail('No abnormal cannot recompute'));
    assert.equal(events.at(-1)!.type, 'itemRejected');
    assert.equal(player.inventory[0].ownedQuantity, 1);
  }
  rows.push({mode, count: combat.record!.flags[10], remaining: player.inventory[0].ownedQuantity, events});
}
writeFileSync('recovery/output/pet-injection-jam-authority.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', scope: 'Trap injection CAS-first restoration, preserving other count contributions/HP/positive state, rejection atomicity, old-deadline and duplicate-use idempotence.', rows,
}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY: trap injection authority');
