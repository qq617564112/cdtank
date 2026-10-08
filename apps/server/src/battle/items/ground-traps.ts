import {itemTrapHandler} from '../../../../shared/content/catalog';
import {applyTrapFireRestraint, expireTrapFireRestraint, readTrapFireRestraintRule, resetTrapFireRestraint} from './trap-fire-restraint';
import {applyTrapTurnRestraint, expireTrapTurnRestraint, readTrapTurnRestraintRule, resetTrapTurnRestraint} from './trap-turn-restraint';
import type {GroundTrapSnapshot, MsgRoomEvent} from '../../../../shared/protocols';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import {combatItems} from '../catalog';
import {applyTrapRestraint, expireTrapRestraint, readTrapRestraintRule, resetTrapRestraint} from './trap-restraint';
import {readOldBombRule, oldBombWorldEffect} from './old-bomb';
import {readContactMineRule} from './contact-mine';
import {readGroupTrapRule} from './group-trap-rule';
import {readTeamFeedRule} from './team-feed-rule';
import {groundBlastWorldEffect, readGroundBlastRule} from './ground-blast';

export interface GroundTrapHealCallbacks {
  canHeal(target: PlayerState): boolean;
  heal(owner: PlayerState, target: PlayerState, amount: number): number;
}

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

const trapReaders: Record<string, (itemId: number) => ReturnType<typeof readOldBombRule> |
  ReturnType<typeof readContactMineRule> | ReturnType<typeof readTrapRestraintRule> |
  ReturnType<typeof readTrapTurnRestraintRule> | ReturnType<typeof readTrapFireRestraintRule> |
  ReturnType<typeof readGroupTrapRule> | ReturnType<typeof readTeamFeedRule> |
  ReturnType<typeof readGroundBlastRule>> = {
  timedBomb: readOldBombRule, contactMine: readContactMineRule,
  moveRestraint: readTrapRestraintRule, turnRestraint: readTrapTurnRestraintRule,
  fireRestraint: readTrapFireRestraintRule, groupRestraint: readGroupTrapRule,
  teamHeal: readTeamFeedRule, blast: readGroundBlastRule,
};
function trapRule(itemTableId: number | undefined) {
  const handler = itemTrapHandler(itemTableId);
  return handler ? trapReaders[handler]?.(itemTableId!) : undefined;
}

/** Natural server-time expiry plays the restored permission's second slot for the live holder. */
function restraintRelease(player: PlayerState, skillId: number) {
  if (!player.alive || player.hp <= 0 || player.combat.status !== 2) return undefined;
  return {skillId, effectIndex: 1, duration: 0,
    roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0};
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
    itemTableId: rule.itemTableId,
    modelId: 'groundModelId' in rule ? rule.groundModelId : rule.itemTableId,
    x: player.x, y: player.y, z: player.z,
    expiresAt: now + rule.groundDurationMs};
  room.groundTraps.push(trap);
  events.push({roomId: room.roomId, type: 'itemUsed', itemName: combatItems.get(item.itemTableId)?.name, message: `${player.name}使用${combatItems.get(rule.itemTableId)!.name}`,
    playerId: player.id, targetId: player.id, value: item.battleQuantity, x: trap.x, y: trap.y, z: trap.z, skillId: rule.placementSkillId});
  events.push({roomId: room.roomId, type: 'trapPlaced', message: '', playerId: player.id, targetId: trap.id,
    value: 0, x: trap.x, y: trap.y, z: trap.z, skillId: rule.placementSkillId,
    playSkillEffect: itemTrapHandler(item.itemTableId) === 'timedBomb' ? oldBombWorldEffect(rule.placementSkillId, trap.x, trap.z)
      : itemTrapHandler(item.itemTableId) === 'groupRestraint'
        || itemTrapHandler(item.itemTableId) === 'teamHeal' ? undefined
      : itemTrapHandler(item.itemTableId) === 'blast'
        ? groundBlastWorldEffect(rule.placementSkillId, trap.x, trap.z)
      : {skillId: rule.placementSkillId, effectIndex: 0, duration: 0, roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Ordinary ground contacts consume their object once; restraint bytes expire on server time. */
export function advanceGroundTraps(room: RoomState, now: number, events: MsgRoomEvent[],
  healAuthority: GroundTrapHealCallbacks): void {
  for (const player of room.players.values()) {
    const change = expireTrapRestraint(player, now, permission(player));
    if (change?.kind === 'expired') events.push({roomId: room.roomId, type: 'trapRestraintEnded', message: '',
      playerId: player.id, targetId: player.id, value: change.movePermissionCount!,
      x: player.x, y: player.y, z: player.z, skillId: change.state.skillId,
      playSkillEffect: restraintRelease(player, change.state.skillId)});
    const turn = expireTrapTurnRestraint(player, now, turnPermission(player));
    if (turn?.kind === 'expired') events.push({roomId: room.roomId, type: 'trapRestraintEnded', message: '',
      playerId: player.id, targetId: player.id, value: turn.turnPermissionCount!,
      x: player.x, y: player.y, z: player.z, skillId: turn.state.skillId,
      playSkillEffect: restraintRelease(player, turn.state.skillId)});
    const fire = expireTrapFireRestraint(player, now, firePermission(player));
    if (fire?.kind === 'expired') events.push({roomId: room.roomId, type: 'trapRestraintEnded', message: '',
      playerId: player.id, targetId: player.id, value: fire.firePermissionCount!,
      x: player.x, y: player.y, z: player.z, skillId: fire.state.skillId,
      playSkillEffect: restraintRelease(player, fire.state.skillId)});
  }
  room.groundTraps = room.groundTraps.filter(trap => {
    if (['timedBomb', 'contactMine'].includes(itemTrapHandler(trap.itemTableId) ?? '')) {
      return room.players.has(trap.ownerId);
    }
    const rule = trapRule(trap.itemTableId);
    if (!rule || itemTrapHandler(rule.itemTableId) === 'timedBomb') return false;
    if ('blastSkillId' in rule) return room.players.has(trap.ownerId);
    if (now >= trap.expiresAt || !room.players.has(trap.ownerId)) return false;
    if ('healAmount' in rule) {
      const owner = room.players.get(trap.ownerId)!;
      const isRealAlly = (target: PlayerState) =>
        target.id === trap.ownerId || ([1, 2, 3].includes(room.mode) && target.team === trap.team);
      const contact = [...room.players.values()].find(target => isRealAlly(target)
        && Math.hypot(target.x - trap.x, target.z - trap.z) <= rule.triggerRadius
        && healAuthority.canHeal(target));
      if (!contact) return true;
      const targets = [...room.players.values()].filter(target =>
        ([1, 2, 3].includes(room.mode) ? target.team === trap.team : target.id === trap.ownerId)
        && healAuthority.canHeal(target));
      events.push({roomId: room.roomId, type: 'trapTriggered', message: '', playerId: trap.ownerId,
        targetId: contact.id, value: rule.healAmount, x: contact.x, y: contact.y, z: contact.z,
        skillId: rule.placementSkillId});
      for (const target of targets) {
        const restored = healAuthority.heal(owner, target, rule.healAmount);
        if (restored <= 0) continue;
        events.push({roomId: room.roomId, type: 'playerHealed',
          message: `${owner.name}的精品饲料罐头为${target.name}恢复${restored}生命`,
          playerId: owner.id, targetId: target.id, value: restored,
          x: target.x, y: target.y, z: target.z, skillId: rule.placementSkillId,
          playSkillEffect: {skillId: rule.placementSkillId, effectIndex: 0, duration: 0,
            roleId: Number(target.id.slice(1)), xBits: 0, zBits: 0}});
      }
      return false;
    }
    if ('move' in rule) {
      if (!room.players.get(trap.ownerId)?.alive) return false;
      for (const target of room.players.values()) {
        if (target.id === trap.ownerId || !target.alive || target.combat.status !== 2
            || ([1, 2, 3].includes(room.mode) && target.team === trap.team)
            || Math.hypot(target.x - trap.x, target.z - trap.z) > rule.move.triggerRadius) continue;
        const targets = [...room.players.values()].filter(candidate =>
          candidate.id !== trap.ownerId && candidate.alive && candidate.combat.status === 2
          && ([1, 2, 3].includes(room.mode) ? candidate.team !== trap.team : true));
        for (const victim of targets) {
          const move = applyTrapRestraint(victim, now, permission(victim), trap.itemTableId);
          if (move?.kind === 'applied') events.push({roomId: room.roomId, type: 'trapTriggered',
            message: '', playerId: trap.ownerId, targetId: victim.id, value: move.movePermissionCount!,
            x: victim.x, y: victim.y, z: victim.z, skillId: rule.move.effectSkillId,
            playSkillEffect: victim.hp > 0 && !victim.combat.getFlag(6)
              ? {skillId: rule.move.effectSkillId, effectIndex: 0, duration: 0,
                roleId: Number(victim.id.slice(1)), xBits: 0, zBits: 0} : undefined});
          const turn = applyTrapTurnRestraint(victim, now, turnPermission(victim), trap.itemTableId);
          if (turn?.kind === 'applied') events.push({roomId: room.roomId, type: 'trapTriggered',
            message: '', playerId: trap.ownerId, targetId: victim.id, value: turn.turnPermissionCount!,
            x: victim.x, y: victim.y, z: victim.z, skillId: rule.turn.effectSkillId,
            playSkillEffect: victim.hp > 0
              ? {skillId: rule.turn.effectSkillId, effectIndex: 0, duration: 0,
                roleId: Number(victim.id.slice(1)), xBits: 0, zBits: 0} : undefined});
          const fire = applyTrapFireRestraint(victim, now, firePermission(victim), trap.itemTableId);
          if (fire?.kind === 'applied') events.push({roomId: room.roomId, type: 'trapTriggered',
            message: '', playerId: trap.ownerId, targetId: victim.id, value: fire.firePermissionCount!,
            x: victim.x, y: victim.y, z: victim.z, skillId: rule.fire.effectSkillId,
            playSkillEffect: victim.hp > 0
              ? {skillId: rule.fire.effectSkillId, effectIndex: 0, duration: 0,
                roleId: Number(victim.id.slice(1)), xBits: 0, zBits: 0} : undefined});
        }
        return false;
      }
      return true;
    }
    for (const target of room.players.values()) {
      if (target.id === trap.ownerId || ([1, 2, 3].includes(room.mode) && target.team === trap.team)
          || Math.hypot(target.x - trap.x, target.z - trap.z) > rule.triggerRadius) continue;
      const change = itemTrapHandler(trap.itemTableId) === 'fireRestraint'
        ? applyTrapFireRestraint(target, now, firePermission(target), trap.itemTableId)
        : itemTrapHandler(trap.itemTableId) === 'turnRestraint'
        ? applyTrapTurnRestraint(target, now, turnPermission(target), trap.itemTableId)
        : applyTrapRestraint(target, now, permission(target), trap.itemTableId);
      if (!change) continue;
      events.push({roomId: room.roomId, type: 'trapTriggered', message: '', playerId: trap.ownerId,
        targetId: target.id, value: ('firePermissionChanged' in change ? change.firePermissionCount
          : 'turnPermissionChanged' in change ? change.turnPermissionCount : change.movePermissionCount)!, x: target.x, y: target.y, z: target.z, skillId: rule.effectSkillId,
        playSkillEffect: target.hp > 0 && (itemTrapHandler(trap.itemTableId) !== 'moveRestraint' || !target.combat.getFlag(6))
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
