import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface InvincibilityState {
  skillId: 8;
  expiresAt: number;
}

export interface InvincibilityParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  invincibility?: InvincibilityState;
}

/** Rebuilt self-target authority; source skill8 supplies the effect duration. */
export function applyInvincibility(roomId: string, player: InvincibilityParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 8 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(8);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 8 || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 6) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  const slots = player.combat.record?.arrays.get(4);
  if (player.invincibility || slots?.includes(8)) {
    reject('无敌效果已生效');
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
  player.combat.addSkill(8);
  player.invincibility = {skillId: 8, expiresAt: now + skill.functions[0].t * 1000};
  recompute();
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: 8,
    playSkillEffect: {skillId: 8, effectIndex: 0, duration: skill.functions[0].t,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Remove only the temporary skill installed by the invincibility item. */
export function clearInvincibility(player: InvincibilityParticipant, recompute: () => void): void {
  if (!player.invincibility) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(8) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.invincibility;
  recompute();
}

export function advanceInvincibility(roomId: string, player: InvincibilityParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.invincibility || (player.alive && now < player.invincibility.expiresAt)) return;
  clearInvincibility(player, recompute);
  events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId: 8,
    stopSkillEffect: {skillId: 8, roleId: Number(player.id.slice(1))}});
}
