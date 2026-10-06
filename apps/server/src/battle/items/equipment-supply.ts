import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import type {BattleRoleSources} from '../../battle-role-sources';
import {combatItems, combatSkills} from '../catalog';
import {setBattleHealth, type HealthParticipant} from '../health';
import {calculateSupplyHealingAmount} from '../roles/supply-healing-amount';

export interface EquipmentSupplyState {sourceIds: number[]; nextAt: number;}
interface SupplyParticipant extends HealthParticipant {
  id: string; name: string; alive: boolean; x: number; y: number; z: number;
  lifeReady?: boolean; attributesReady: boolean;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  ownedRoles: BattleRoleSources;
  equipmentSupply?: EquipmentSupplyState;
}

/** Source skill fields determine the amount; its recurring schedule is Web policy. */
function supplyDefinition() {
  const skill = combatSkills.get(13171);
  const recurring = skill?.functions.find(fn => fn.type === 2 && fn.t === 999);
  return skill?.target === 1 && skill.triggerType === 0 && recurring && recurring.x > 0
    && skill.attributes.HP > 0 && combatItems.get(17061)?.skillIds.includes(skill.skillId)
    ? {amount: skill.attributes.HP, period: recurring.x * 1000} : undefined;
}

function supplySources(player: SupplyParticipant): number[] {
  if (!player.alive || player.lastStand || !(player.lifeReady || player.attributesReady)) return [];
  const tables = player.combat.record?.arrays.get(2);
  return player.ownedRoles.equipment().parts.filter((instanceId, slot) => {
    const item = player.inventory.find(record => record.instanceId === instanceId);
    return instanceId !== 0 && tables?.[slot] === 17061 && item?.itemTableId === 17061
      && item.state === 2 && item.ownedQuantity > 0;
  });
}

export function resetEquipmentSupply(player: SupplyParticipant, now: number): void {
  const sourceIds = supplySources(player), definition = supplyDefinition();
  player.equipmentSupply = sourceIds.length && definition ? {sourceIds, nextAt: now + definition.period} : undefined;
}

/** One confirmed device schedule per participant, without catch-up or inventory consumption. */
export function advanceEquipmentSupply(roomId: string, phase: string, player: SupplyParticipant,
  now: number, maxHp: number, events: MsgRoomEvent[]): void {
  const sourceIds = phase === 'PLAYING' ? supplySources(player) : [];
  const definition = supplyDefinition();
  if (!sourceIds.length || !definition) {player.equipmentSupply = undefined; return;}
  const state = player.equipmentSupply;
  if (!state || sourceIds.length !== state.sourceIds.length
      || sourceIds.some((id, slot) => id !== state.sourceIds[slot])) {
    player.equipmentSupply = {sourceIds, nextAt: now + definition.period};
    return;
  }
  if (now < state.nextAt) return;
  state.nextAt = now + definition.period;
  const amount = calculateSupplyHealingAmount(player.hp, maxHp, definition.amount);
  if (amount <= 0) return;
  const before = player.hp;
  setBattleHealth(player, before + amount, maxHp);
  const restored = player.hp - before;
  if (restored <= 0) return;
  events.push({roomId, type: 'playerHealed', message: `${player.name}补给恢复${restored}生命`,
    playerId: player.id, targetId: player.id, value: restored, skillId: 13171,
    x: player.x, y: player.y, z: player.z});
}
