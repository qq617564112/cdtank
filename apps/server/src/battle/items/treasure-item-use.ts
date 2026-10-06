import {setBattleHealth, type HealthParticipant} from '../health';
import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';
import {calculateFoodHealing} from '../roles/food-healing';
import {isTreasureItem} from '../../../../shared/combat/treasure-items';

/** ItemSkill2 of the two Func20 treasures; the real HP effect for ordinary self-use. */
const TREASURE_HEAL_SKILL = 30005;

interface TreasureUseParticipant extends HealthParticipant {
  id: string; name: string; alive: boolean; hp: number; x: number; y: number; z: number;
  combat: RoleCombatState;
  attributesReady?: boolean;
  inventory: InventoryWireRecord[];
}

/** Adopted ordinary-use entry for item20001/20002 only.
 *
 * Func20 (ItemSkill1) stays the ground-pickup quantity writer; the ordinary use consumes
 * one owned unit and applies ItemSkill2 skill30005 through the existing HP path. The
 * recovered category1/2 predicate and every other item keep their current behavior.
 */
export function applyTreasureItemUse(roomId: string, player: TreasureUseParticipant,
  request: {kind: string; instanceId: number}, maxHp: () => number,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || !isTreasureItem(item.itemTableId)
      || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(item.itemTableId);
  const skill = combatSkills.get(TREASURE_HEAL_SKILL);
  if (!definition || !definition.skillIds.includes(TREASURE_HEAL_SKILL)
      || !skill || skill.skillId !== TREASURE_HEAL_SKILL
      || skill.target !== 1 || skill.triggerType !== 1
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
    message: `${player.name}使用${definition.name}，恢复${Math.round(restored)}生命`,
    playerId: player.id, targetId: player.id, value: restored,
    x: player.x, y: player.y, z: player.z, skillId: skill.skillId,
    playSkillEffect: {skillId: skill.skillId, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Adopted ordinary-use request for the two Func20 treasures only. The recovered
 * category1/2 predicate stays untouched; this entry admits item20001/20002 through
 * the same accepted shortcut path once the record is assigned and usable. */
export function requestTreasureItemUse(role: RoleCombatState | undefined,
  record: {instanceId: number; itemTableId: number; battleQuantity: number} | undefined,
  send: (instanceId: number) => void): boolean {
  if (!role || role.status !== 2 || !record || !isTreasureItem(record.itemTableId)) return false;
  if ((record.battleQuantity >>> 0) === 0) return false;
  send(record.instanceId >>> 0);
  return true;
}
