import {clearTrapFireRestraint, type TrapFireRestraintState} from './trap-fire-restraint';
import {clearTrapTurnRestraint, type TrapTurnRestraintState} from './trap-turn-restraint';
import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';
import {clearAmmoBurn, type AmmoBurnState} from './ammo-burn';
import {clearAmmoSlow, type AmmoSlowState} from './ammo-slow';
import {clearTrapRestraint, type TrapRestraintState} from './trap-restraint';

export interface PetInjectionParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  burn?: AmmoBurnState;
  ammoSlow?: AmmoSlowState;
  trapRestraint?: TrapRestraintState;
  trapTurnRestraint?: TrapTurnRestraintState;
  trapFireRestraint?: TrapFireRestraintState;
}

/** Rebuilt self-use cures delivered negative states after durable consumption. */
export function applyPetInjection(roomId: string, player: PetInjectionParticipant,
  request: {kind: string; instanceId: number},
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[], recompute: () => void): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 3 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(3);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 3 || skill.triggerType !== 1 || skill.target !== 1
      || skill.functions[0]?.type !== 10) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  if (!player.burn && !player.ammoSlow && !player.trapRestraint && !player.trapTurnRestraint && !player.trapFireRestraint) {
    reject('没有需要解除的异常状态');
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
  clearAmmoBurn(player);
  clearAmmoSlow(player, recompute);
  const trap = clearTrapRestraint(player, {
    readMovePermissionCount: () => player.combat.record?.flags[9],
    writeMovePermissionCount: count => player.combat.writeMovePermissionCount(count),
  });
  if (trap?.kind === 'cleared') events.push({roomId, type: 'trapRestraintEnded', message: '',
    playerId: player.id, targetId: player.id, value: trap.movePermissionCount!,
    x: player.x, y: player.y, z: player.z, skillId: 4001});
  const turn = clearTrapTurnRestraint(player, {
    readTurnPermissionCount: () => player.combat.record?.flags[10],
    writeTurnPermissionCount: count => player.combat.writeTurnPermissionCount(count),
  });
  if (turn?.kind === 'cleared') events.push({roomId, type: 'trapRestraintEnded', message: '',
    playerId: player.id, targetId: player.id, value: turn.turnPermissionCount!,
    x: player.x, y: player.y, z: player.z, skillId: 4002});
  const fire = clearTrapFireRestraint(player, {
    readFirePermissionCount: () => player.combat.record?.flags[11],
    writeFirePermissionCount: count => player.combat.writeFirePermissionCount(count),
  });
  if (fire?.kind === 'cleared') events.push({roomId, type: 'trapRestraintEnded', message: '',
    playerId: player.id, targetId: player.id, value: fire.firePermissionCount!,
    x: player.x, y: player.y, z: player.z, skillId: 4003});
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: 3,
    playSkillEffect: {skillId: 3, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}
