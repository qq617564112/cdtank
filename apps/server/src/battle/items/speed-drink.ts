import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface SpeedBoostState {
  skillId: number;
  expiresAt: number;
  moveBonus: number;
}

export interface SpeedDrinkParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  attributesReady: boolean;
  recoveredMovement?: {speed: number; turn: number};
  speedBoost?: SpeedBoostState;
}

/** Rebuilt self-target authority; source skill6 supplies duration and movement bonus. */
export function applySpeedDrink(roomId: string, player: SpeedDrinkParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || combatItems.get(item.itemTableId)?.runtime.use !== 'speed' || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(item.itemTableId);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 1) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  if (!player.attributesReady && !player.recoveredMovement) {
    reject('缺少移动属性，无法使用道具');
    return;
  }
  const slots = player.combat.record?.arrays.get(4);
  if (player.speedBoost || slots?.includes(skill.skillId)) {
    reject('速度提升效果已生效');
    return;
  }
  if (!slots || slots.length !== 16 || !slots.includes(0)) {
    reject('技能栏已满，无法使用道具');
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
  item.ownedQuantity -= 1;
  item.battleQuantity -= 1;
  player.combat.addSkill(skill.skillId);
  player.speedBoost = {skillId: skill.skillId, expiresAt: now + skill.functions[0].t * 1000,
    moveBonus: skill.attributes.ItemMove};
  recompute();
  events.push({roomId, type: 'itemUsed', itemName: combatItems.get(item.itemTableId)?.name, message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: skill.skillId,
    playSkillEffect: {skillId: skill.skillId, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Remove only the temporary skill installed by the speed drink. */
export function clearSpeedDrink(player: SpeedDrinkParticipant, recompute: () => void): void {
  if (!player.speedBoost) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(player.speedBoost.skillId) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.speedBoost;
  recompute();
}

export function advanceSpeedDrink(roomId: string, player: SpeedDrinkParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.speedBoost || (player.alive && now < player.speedBoost.expiresAt)) return;
  const skillId = player.speedBoost.skillId;
  const roleId = Number(player.id.slice(1));
  const expiredNaturally = player.alive && now >= player.speedBoost.expiresAt;
  clearSpeedDrink(player, recompute);
  events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId,
    stopSkillEffect: {skillId, roleId}});
  if (expiredNaturally) {
    events.push({roomId, type: 'drinkEndEffect', message: '', playerId: player.id,
      targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId,
      playSkillEffect: {skillId, effectIndex: 1, duration: 0, roleId, xBits: 0, zBits: 0}});
  }
}
