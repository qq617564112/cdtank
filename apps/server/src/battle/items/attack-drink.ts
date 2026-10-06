import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface AttackBoostState {
  skillId: 4;
  expiresAt: number;
  attackPercent: number;
  attackBonus: number;
}

export interface AttackDrinkParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  attackBoost?: AttackBoostState;
}

/** Rebuilt self-target authority; source skill4 supplies duration and attack values. */
export function applyAttackDrink(roomId: string, player: AttackDrinkParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 4 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(4);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 4 || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 1) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  const slots = player.combat.record?.arrays.get(4);
  if (player.attackBoost || slots?.includes(4)) {
    reject('攻击提升效果已生效');
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
  player.combat.addSkill(4);
  player.attackBoost = {skillId: 4, expiresAt: now + skill.functions[0].t * 1000,
    attackPercent: skill.attributes.Atk, attackBonus: skill.attributes.AtkBonus};
  recompute();
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: 4,
    playSkillEffect: {skillId: 4, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Remove only the temporary skill installed by the attack drink. */
export function clearAttackDrink(player: AttackDrinkParticipant, recompute: () => void): void {
  if (!player.attackBoost) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(4) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.attackBoost;
  recompute();
}

export function advanceAttackDrink(roomId: string, player: AttackDrinkParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.attackBoost || (player.alive && now < player.attackBoost.expiresAt)) return;
  clearAttackDrink(player, recompute);
  events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId: 4,
    stopSkillEffect: {skillId: 4, roleId: Number(player.id.slice(1))}});
}

/** Attack input to the existing rebuilt projectile formula, without changing tank data. */
export function prototypeAttack(tankAttack: number, attackBoost?: AttackBoostState): number {
  return attackBoost
    ? tankAttack * (1 + attackBoost.attackPercent / 100) + attackBoost.attackBonus
    : tankAttack;
}
