import {applyTrapFireRestraint, expireTrapFireRestraint, readTrapFireRestraintRule, resetTrapFireRestraint} from './trap-fire-restraint';
import {applyTrapTurnRestraint, expireTrapTurnRestraint, readTrapTurnRestraintRule, resetTrapTurnRestraint} from './trap-turn-restraint';
import type {GroundTrapSnapshot, MsgRoomEvent} from '../../../../shared/protocols';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import {combatItems} from '../catalog';
import {applyTrapRestraint, expireTrapRestraint, readTrapRestraintRule, resetTrapRestraint} from './trap-restraint';
import {readOldBombRule, oldBombWorldEffect} from './old-bomb';
import {readContactMineRule} from './contact-mine';

function permission(player: PlayerState) {
  return {
    readMovePermissionCount: () => player.combat.record?.flags[9],
    writeMovePermissionCount: (count: number) => {player.combat.writeMovePermissionCount(count);},
  };
}

function turnPermission(player: PlayerState) {
  return {
    readTurnPermissionCount: () => player.combat.record?.flags[10],
    writeTurnPermissionCount: (count: number) => {player.combat.writeTurnPermissionCount(count);},
  };
}

function firePermission(player: PlayerState) {
  return {
    readFirePermissionCount: () => player.combat.record?.flags[11],
    writeFirePermissionCount: (count: number) => {player.combat.writeFirePermissionCount(count);},
  };
}

function trapRule(itemTableId: number | undefined) {
  return itemTableId === 3001 ? readOldBombRule()
    : itemTableId === 3002 ? readContactMineRule()
    : itemTableId === 3005 ? readTrapFireRestraintRule()
    : itemTableId === 3004 ? readTrapTurnRestraintRule() : readTrapRestraintRule();
}

/** Durable placement authority, after the original shortcut request gates. */
export function placeGroundTrap(room: RoomState, player: PlayerState,
  request: {kind: string; instanceId: number}, now: number, allocateId: () => string,
  consume: (playerId: string, instanceId: number, expectedOwned: number, itemTableId: number) => boolean,
  events: MsgRoomEvent[]): void {
  if (request.kind !== 'placeTrap' || room.phase !== 'PLAYING' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  const rule = trapRule(item?.itemTableId);
  if (!rule || !item || item.itemTableId !== rule.itemTableId || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const reject = (message: string) => events.push({roomId: room.roomId, type: 'itemRejected', message,
    playerId: player.id, targetId: '', value: 0, x: player.x, y: player.y, z: player.z});
  try {
    if (!consume(player.id, item.instanceId, item.ownedQuantity, item.itemTableId)) {
      reject('物品数量已变化，请重新进入房间'); return;
    }
  } catch {reject('物品保存失败，请稍后再试'); return;}
  item.ownedQuantity--;
  item.battleQuantity--;
  const trap: GroundTrapSnapshot = {id: allocateId(), ownerId: player.id, team: player.team,
    itemTableId: rule.itemTableId, modelId: rule.itemTableId, x: player.x, y: player.y, z: player.z,
    expiresAt: now + rule.groundDurationMs};
  room.groundTraps.push(trap);
  events.push({roomId: room.roomId, type: 'itemUsed', message: `${player.name}使用${combatItems.get(rule.itemTableId)!.name}`,
    playerId: player.id, targetId: player.id, value: item.battleQuantity, x: trap.x, y: trap.y, z: trap.z, skillId: rule.placementSkillId});
  events.push({roomId: room.roomId, type: 'trapPlaced', message: '', playerId: player.id, targetId: trap.id,
    value: 0, x: trap.x, y: trap.y, z: trap.z, skillId: rule.placementSkillId,
    playSkillEffect: item.itemTableId === 3001 ? oldBombWorldEffect(rule.placementSkillId, trap.x, trap.z)
      : {skillId: rule.placementSkillId, effectIndex: 0, duration: 0, roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Single enemy contact consumes the object; one byte contribution expires on server time. */
export function advanceGroundTraps(room: RoomState, now: number, events: MsgRoomEvent[]): void {
  for (const player of room.players.values()) {
    const change = expireTrapRestraint(player, now, permission(player));
    if (change?.kind === 'expired') events.push({roomId: room.roomId, type: 'trapRestraintEnded', message: '',
      playerId: player.id, targetId: player.id, value: change.movePermissionCount!,
      x: player.x, y: player.y, z: player.z, skillId: 4001});
    const turn = expireTrapTurnRestraint(player, now, turnPermission(player));
    if (turn?.kind === 'expired') events.push({roomId: room.roomId, type: 'trapRestraintEnded', message: '',
      playerId: player.id, targetId: player.id, value: turn.turnPermissionCount!,
      x: player.x, y: player.y, z: player.z, skillId: 4002});
    const fire = expireTrapFireRestraint(player, now, firePermission(player));
    if (fire?.kind === 'expired') events.push({roomId: room.roomId, type: 'trapRestraintEnded', message: '',
      playerId: player.id, targetId: player.id, value: fire.firePermissionCount!,
      x: player.x, y: player.y, z: player.z, skillId: 4003});
  }
  room.groundTraps = room.groundTraps.filter(trap => {
    if (trap.itemTableId === 3001 || trap.itemTableId === 3002) return room.players.has(trap.ownerId);
    const rule = trapRule(trap.itemTableId);
    if (!rule || rule.itemTableId === 3001) return false;
    if (now >= trap.expiresAt || !room.players.has(trap.ownerId)) return false;
    for (const target of room.players.values()) {
      if (target.id === trap.ownerId || ([1, 2, 3].includes(room.mode) && target.team === trap.team)
          || Math.hypot(target.x - trap.x, target.z - trap.z) > rule.triggerRadius) continue;
      const change = trap.itemTableId === 3005
        ? applyTrapFireRestraint(target, now, firePermission(target))
        : trap.itemTableId === 3004
        ? applyTrapTurnRestraint(target, now, turnPermission(target))
        : applyTrapRestraint(target, now, permission(target));
      if (!change) continue;
      events.push({roomId: room.roomId, type: 'trapTriggered', message: '', playerId: trap.ownerId,
        targetId: target.id, value: ('firePermissionChanged' in change ? change.firePermissionCount
          : 'turnPermissionChanged' in change ? change.turnPermissionCount : change.movePermissionCount)!, x: target.x, y: target.y, z: target.z, skillId: rule.effectSkillId,
        playSkillEffect: target.hp > 0 && (trap.itemTableId !== 3003 || !target.combat.getFlag(6))
          ? {skillId: rule.effectSkillId, effectIndex: 0, duration: 0, roleId: Number(target.id.slice(1)), xBits: 0, zBits: 0} : undefined});
      return false;
    }
    return true;
  });
}

/** Life/round initialization owns permission bytes; discarded traps never refund stock. */
export function clearGroundTraps(room: RoomState): void {
  room.groundTraps = [];
  for (const player of room.players.values()) {
    resetTrapRestraint(player);
    resetTrapTurnRestraint(player);
    resetTrapFireRestraint(player);
  }
}
