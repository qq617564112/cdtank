import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyTrapSweep} from '../apps/server/src/battle/items/trap-sweep-use';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {GroundTrapSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

const rows: unknown[] = [];
for (const mode of ['success', 'noTarget', 'CASfalse', 'storageError', 'dead'] as const) {
  const combat = createRoleCombatState(); combat.setStatus(2);
  const item = {instanceId: 7, itemTableId: 12, ownedQuantity: 2, battleQuantity: 2,
    state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
  const restraint = {expiresAt: 6000, removedMovePermission: 1, skillId: 4001};
  const player = {id: 'P2', name: 'Sweeper', alive: mode !== 'dead', x: 0, y: 0, z: 0,
    combat, inventory: [item], hp: 655, trapRestraint: restraint};
  const trap = (id: string, x: number, team: number): GroundTrapSnapshot => ({id, x, y: 0, z: 0,
    ownerId: 'P1', team, itemTableId: 3003, modelId: 3003, expiresAt: 5000});
  const room = {roomId: 'scope', phase: 'PLAYING' as const,
    groundTraps: mode === 'noTarget' ? [] : [trap('near', 100, 0), trap('edge', 400, 1), trap('far', 401, 0)]};
  const initial = [...room.groundTraps], events: MsgRoomEvent[] = [];
  let commits = 0;
  applyTrapSweep(room, player, {kind: 'useItem', instanceId: 7}, 1000, (_id, instance, owned, table) => {
    commits++;
    assert.deepEqual([instance, owned, table], [7, 2, 12]);
    assert.deepEqual(room.groundTraps, initial);
    assert.equal(item.ownedQuantity, 2);
    if (mode === 'storageError') throw new Error('Storage fixture');
    return mode !== 'CASfalse';
  }, events);
  assert.equal(player.hp, 655);
  assert.equal(player.trapRestraint, restraint);
  if (mode === 'success') {
    assert.deepEqual(room.groundTraps.map(row => row.id), ['far']);
    assert.equal(item.ownedQuantity, 1); assert.equal(item.battleQuantity, 1);
    assert.equal(events[0].value, 2); assert.equal(events[0].playSkillEffect!.skillId, 12);
    applyTrapSweep(room, player, {kind: 'useItem', instanceId: 7}, 1000,
      () => assert.fail('Empty radius cannot consume'), events);
    assert.equal(item.ownedQuantity, 1); assert.equal(events.at(-1)!.type, 'itemRejected');
  } else {
    assert.deepEqual(room.groundTraps, initial); assert.equal(item.ownedQuantity, 2);
    if (mode !== 'dead') assert.equal(events[0].type, 'itemRejected');
  }
  assert.equal(commits, mode === 'noTarget' || mode === 'dead' ? 0 : 1);
  rows.push({mode, commits, remaining: item.ownedQuantity, ground: room.groundTraps, events});
}
writeFileSync('recovery/output/trap-sweep-authority.json', JSON.stringify({status: 'PASS_MODULE_ONLY', rows,
  scope: 'CAS-first current-room sweep, all teams within400 XZ, no-target/repeat rejection, storage failure atomicity, existing restraint and HP preserved.'
}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY: trap sweep authority');
