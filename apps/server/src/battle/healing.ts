import {setBattleHealth, type HealthParticipant} from './health';
import type {MsgRoomEvent} from '../../../shared/protocols';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from './roles/combat-state';
import {combatItems, combatSkills} from './catalog';
import {calculateFoodHealing} from './roles/food-healing';

/** Source item/skill1 and2 HP amounts; self target and consumption remain rebuilt policies. */
export function applyHealingItem(roomId: string, player: HealthParticipant & {
  id: string; name: string; alive: boolean; hp: number; x: number; y: number; z: number;
  combat: RoleCombatState;
  attributesReady?: boolean;
  inventory: InventoryWireRecord[];
}, request: {kind: string; instanceId: number}, maxHp: () => number,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number, itemTableId: number) => boolean) | undefined,
  events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || (item.itemTableId !== 1 && item.itemTableId !== 2)
      || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(item.itemTableId);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 2 || skill.attributes.HP <= 0) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0, skillId: undefined});
  };
  if (player.lastStand) {
    reject('最后一搏期间无法恢复生命');
    return;
  }
  const maximum = maxHp();
  const healing = calculateFoodHealing(skill.attributes.HP,
    player.attributesReady ? player.combat.roleFloatFields.get(0x8c) : undefined);
  const hp = Math.min(maximum, player.hp + healing);
  if (hp <= player.hp) {
    reject('满血无需使用道具');
    return;
  }
  try {
    if (consumeItem && !consumeItem(player.id, item.instanceId, item.ownedQuantity, item.itemTableId)) {
      reject('物品数量已变化，请重新进入房间');
      return;
    }
  } catch {
    reject('物品保存失败，请稍后再试');
    return;
  }
  const restored = hp - player.hp;
  item.ownedQuantity -= 1;
  item.battleQuantity -= 1;
  setBattleHealth(player, hp, maximum);
  events.push({roomId, type: 'itemUsed',
    message: `${player.name}使用${definition!.name}，恢复${Math.round(restored)}生命`,
    playerId: player.id, targetId: player.id, value: restored,
    x: player.x, y: player.y, z: player.z, skillId: skill.skillId,
    playSkillEffect: {skillId: skill.skillId, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}
