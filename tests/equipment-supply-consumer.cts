import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {advanceEquipmentSupply, resetEquipmentSupply} from '../apps/server/src/battle/items/equipment-supply';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {BattleRoleSources} from '../apps/server/src/battle-role-sources';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof resetEquipmentSupply>[0];
function fixture() {
  const combat = createRoleCombatState();
  combat.setArray(2, [17061, 0, 0, 0, 0]);
  const parts = [7, 0, 0, 0, 0];
  const record: InventoryWireRecord = {instanceId: 7, itemTableId: 17061, ownedQuantity: 1,
    battleQuantity: 0, state: 2, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
  const player: Participant = {id: 'P1', name: '守方', alive: true, x: 1, y: 2, z: 3,
    lifeReady: true, attributesReady: false, hp: 600,
    attributes: {record: {hp: 600, maxHp: 700}}, combat, inventory: [record],
    ownedRoles: {equipment: () => ({parts})} as unknown as BattleRoleSources};
  const events: MsgRoomEvent[] = [];
  const step = (now: number, phase = 'PLAYING') => advanceEquipmentSupply('supply', phase, player, now, 700, events);
  return {player, parts, record, events, step};
}
const first = fixture();
resetEquipmentSupply(first.player, 1000);
first.step(3999); assert.equal(first.player.hp, 600); assert.equal(first.events.length, 0);
first.step(4000); assert.equal(first.player.hp, 620);
assert.equal(first.player.attributes.record.hp, 620);
assert.deepEqual(first.events[0], {roomId: 'supply', type: 'playerHealed', message: '守方补给恢复20生命',
  playerId: 'P1', targetId: 'P1', value: 20, skillId: 13171, x: 1, y: 2, z: 3});
first.step(16000); assert.equal(first.player.hp, 640); assert.equal(first.events.length, 2);
assert.equal(first.player.equipmentSupply!.nextAt, 19000);
first.player.hp = 695; first.player.attributes.record.hp = 695;
first.step(19000); assert.equal(first.player.hp, 700); assert.equal(first.events.at(-1)!.value, 5);
first.step(22000); assert.equal(first.events.length, 3);
assert.equal(first.player.equipmentSupply!.nextAt, 25000);
assert.equal(first.record.ownedQuantity, 1); assert.equal(first.record.battleQuantity, 0);

const invalid = ['unowned', 'unequipped', 'wrongTable', 'sourceWithdrawn', 'dead', 'waiting', 'finished'] as const;
for (const reason of invalid) {
  const f = fixture(); resetEquipmentSupply(f.player, 0);
  if (reason === 'unowned') f.record.ownedQuantity = 0;
  if (reason === 'unequipped') f.record.state = 0;
  if (reason === 'wrongTable') f.player.combat.setArray(2, [14003, 0, 0, 0, 0]);
  if (reason === 'sourceWithdrawn') f.player.lifeReady = false;
  if (reason === 'dead') f.player.alive = false;
  f.step(3000, reason === 'waiting' ? 'WAITING' : reason === 'finished' ? 'FINISHED' : 'PLAYING');
  assert.equal(f.player.hp, 600, reason); assert.equal(f.events.length, 0, reason);
  assert.equal(f.player.equipmentSupply, undefined, reason);
}
const changed = fixture(); resetEquipmentSupply(changed.player, 0);
changed.record.instanceId = 8; changed.parts[0] = 8;
changed.step(3000); assert.equal(changed.player.hp, 600);
changed.step(6000); assert.equal(changed.player.hp, 620);
changed.player.alive = false; changed.step(6500);
changed.player.alive = true; changed.player.hp = 600; resetEquipmentSupply(changed.player, 7000);
changed.step(9999); assert.equal(changed.player.hp, 600);
changed.step(10000); assert.equal(changed.player.hp, 620);
resetEquipmentSupply(changed.player, 12000);
changed.step(14999); assert.equal(changed.player.hp, 620);
changed.step(15000); assert.equal(changed.player.hp, 640);
const multiple = fixture();
multiple.parts[1] = 9; multiple.player.inventory.push({...multiple.record, instanceId: 9});
multiple.player.combat.setArray(2, [17061, 17061, 0, 0, 0]);
resetEquipmentSupply(multiple.player, 0); multiple.step(3000); assert.equal(multiple.player.hp, 620);
writeFileSync('recovery/output/equipment-supply-consumer.json', JSON.stringify({
  status: 'PASS_EQUIPPED_SUPPLY_SOURCE_PERIOD_AMOUNT_CLAMP_WITHDRAWAL_LIFECYCLE_NO_CATCHUP_SCOPE',
  periodMilliseconds: 3000, baseHealing: 20, actualEvents: first.events, invalid, lifecycleReset: true,
  multipleDevicesSinglePeriod: true, inventoryUnchanged: true,
}, null, 2));
console.log('PASS equipment supply source, cycle, actual clamped healing, withdrawal and lifecycle reset');
