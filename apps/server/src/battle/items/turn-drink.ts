import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface TurnBoostState {
  skillId: 7;
  expiresAt: number;
  turnBonus: number;
}

export interface TurnDrinkParticipant {
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
  turnBoost?: TurnBoostState;
}

/** Rebuilt self-target authority; source skill7 supplies duration and turn bonus. */
export function applyTurnDrink(roomId: string, player: TurnDrinkParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 7 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(7);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 7 || skill.target !== 1 || skill.triggerType !== 1
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
  if (player.turnBoost || slots?.includes(7)) {
    reject('回旋提升效果已生效');
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
  player.combat.addSkill(7);
  player.turnBoost = {skillId: 7, expiresAt: now + skill.functions[0].t * 1000,
    turnBonus: skill.attributes.ItemTurn};
  recompute();
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: 7,
    playSkillEffect: {skillId: 7, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Remove only the temporary skill installed by the turn drink. */
export function clearTurnDrink(player: TurnDrinkParticipant, recompute: () => void): void {
  if (!player.turnBoost) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(7) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.turnBoost;
  recompute();
}

export function advanceTurnDrink(roomId: string, player: TurnDrinkParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.turnBoost || (player.alive && now < player.turnBoost.expiresAt)) return;
  clearTurnDrink(player, recompute);
  events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId: 7,
    stopSkillEffect: {skillId: 7, roleId: Number(player.id.slice(1))}});
}
