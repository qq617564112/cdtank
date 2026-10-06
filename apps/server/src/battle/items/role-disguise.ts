import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface RoleDisguiseState {
  skillId: 10 | 11;
  style: 1 | 2;
  startedAt: number;
  expiresAt: number;
  x: number;
  y: number;
  z: number;
}

export interface RoleDisguiseParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  opticalCamouflage?: {skillId: 9; expiresAt: number};
  roleDisguise?: RoleDisguiseState;
}

/** Rebuilt self-target authority; source skill10/11 supplies style, duration and display effect. */
export function applyRoleDisguise(roomId: string, player: RoleDisguiseParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const itemTableId = item.itemTableId;
  if (itemTableId !== 10 && itemTableId !== 11) return;
  const skillId = itemTableId;
  const style = itemTableId === 10 ? 1 : 2;
  const definition = combatItems.get(itemTableId);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  const func = skill?.functions[0];
  const funcStyle = func?.x;
  const durationSeconds = func?.t;
  if (!definition || definition.battleUseMax !== 5 || !skill || skill.skillId !== skillId
      || skill.target !== 1 || skill.triggerType !== 1 || skill.range !== 0
      || func?.type !== 8 || funcStyle !== style || durationSeconds !== 10
      || skill.effects[0]?.effectId !== 3 || skill.effects[0].sound !== 'GA16') return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  const slots = player.combat.record?.arrays.get(4);
  if (player.roleDisguise || player.opticalCamouflage
      || [9, 10, 11].some(id => slots?.includes(id))) {
    reject('伪装或隐身效果已生效');
    return;
  }
  if (!slots || slots.length !== 16 || !slots.includes(0)) {
    reject('技能栏已满，无法使用道具');
    return;
  }
  const durationMs = durationSeconds * 1000;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
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
  player.combat.addSkill(skillId);
  player.roleDisguise = {skillId, style, startedAt: now, expiresAt: now + durationMs,
    x: player.x, y: player.y, z: player.z};
  recompute();
  const roleId = Number(player.id.slice(1));
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId,
    playSkillEffect: {skillId, effectIndex: 0, duration: 0,
      roleId, xBits: 0, zBits: 0}});
  events.push({roomId, type: 'roleStyleChanged', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z,
    roleStyleChanged: {roleId, style}});
}

/** Remove only the temporary skill/state installed by the disguise item. */
export function clearRoleDisguise(player: RoleDisguiseParticipant, recompute: () => void,
  roomId?: string, events?: MsgRoomEvent[]): void {
  const state = player.roleDisguise;
  if (!state) return;
  const slots = player.combat.record?.arrays.get(4);
  if (slots) {
    const slot = slots.indexOf(state.skillId);
    if (slot !== -1) player.combat.removeSkillAt(slot);
  }
  delete player.roleDisguise;
  recompute();
  if (roomId === undefined || !events) return;
  events.push({roomId, type: 'roleStyleRestored', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z,
    roleStyleRestored: {roleId: Number(player.id.slice(1))}});
}

export function advanceRoleDisguise(roomId: string, player: RoleDisguiseParticipant,
  now: number, recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.roleDisguise || (player.alive && now < player.roleDisguise.expiresAt)) return;
  clearRoleDisguise(player, recompute, roomId, events);
}

/** An ordinary shot restores display only after ammo/reload/stock acceptance. */
export function restoreRoleDisguiseAfterAcceptedFire(roomId: string,
  player: RoleDisguiseParticipant, recompute: () => void, events: MsgRoomEvent[]): void {
  clearRoleDisguise(player, recompute, roomId, events);
}
