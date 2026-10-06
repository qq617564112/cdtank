import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface OpticalCamouflageState {
  skillId: 9;
  expiresAt: number;
}

export interface OpticalCamouflageParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  opticalCamouflage?: OpticalCamouflageState;
}

/** Rebuilt self-target authority; source skill9 supplies the effect duration. */
export function applyOpticalCamouflage(roomId: string, player: OpticalCamouflageParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 9 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(9);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 9 || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 7 || !Number.isFinite(skill.functions[0].t)
      || skill.functions[0].t <= 0) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  const slots = player.combat.record?.arrays.get(4);
  if (player.opticalCamouflage || slots?.includes(9)) {
    reject('隐身效果已生效');
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
  player.combat.addSkill(9);
  player.opticalCamouflage = {skillId: 9, expiresAt: now + skill.functions[0].t * 1000};
  recompute();
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: 9});
}

/** Remove only the temporary skill installed by the camouflage item. */
export function clearOpticalCamouflage(player: OpticalCamouflageParticipant, recompute: () => void): void {
  if (!player.opticalCamouflage) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(9) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.opticalCamouflage;
  recompute();
}

export function advanceOpticalCamouflage(roomId: string, player: OpticalCamouflageParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.opticalCamouflage || (player.alive && now < player.opticalCamouflage.expiresAt)) return;
  clearOpticalCamouflage(player, recompute);
  events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId: 9});
}
