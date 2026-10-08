import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import type {RoleDisguiseState} from './role-disguise';
import {combatItems, combatSkills} from '../catalog';

export interface OpticalCamouflageState {
  skillId: number;
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
  roleDisguise?: RoleDisguiseState;
}

/** Rebuilt self-target authority; source skill9 supplies the effect duration. */
export function applyOpticalCamouflage(roomId: string, player: OpticalCamouflageParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || combatItems.get(item.itemTableId)?.runtime.use !== 'camouflage' || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(item.itemTableId);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 7 || !Number.isFinite(skill.functions[0].t)
      || skill.functions[0].t <= 0) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  const slots = player.combat.record?.arrays.get(4);
  if (player.opticalCamouflage || player.roleDisguise || slots?.includes(skill.skillId)) {
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
  player.combat.addSkill(skill.skillId);
  player.opticalCamouflage = {skillId: skill.skillId, expiresAt: now + skill.functions[0].t * 1000};
  recompute();
  events.push({roomId, type: 'itemUsed', itemName: combatItems.get(item.itemTableId)?.name, message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: skill.skillId});
}

/** Remove only the temporary skill installed by the camouflage item. */
export function clearOpticalCamouflage(player: OpticalCamouflageParticipant, recompute: () => void,
  roomId?: string, events?: MsgRoomEvent[]): void {
  const state = player.opticalCamouflage;
  if (!state) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(state.skillId) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.opticalCamouflage;
  recompute();
  if (roomId !== undefined && events) {
    events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
      targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId: state.skillId});
  }
}

export function advanceOpticalCamouflage(roomId: string, player: OpticalCamouflageParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.opticalCamouflage || (player.alive && now < player.opticalCamouflage.expiresAt)) return;
  clearOpticalCamouflage(player, recompute, roomId, events);
}
