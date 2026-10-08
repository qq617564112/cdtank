import {itemForHandler, itemTrapHandler} from '../../../../shared/content/catalog';
import {combatItems, combatSkills} from '../catalog';
import {readContactMineNumbers} from '../roles/contact-mine-numbers';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import type {MsgRoomEvent} from '../../../../shared/protocols';

/** Original 3002→4023 fields; lifetime and contact geometry follow the Web policy. */
export function readContactMineRule(itemId = itemForHandler('trap', 'contactMine').id) {
  const item = combatItems.get(itemId);
  const placement = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = placement?.functions[0];
  const effect = create ? combatSkills.get(create.y) : undefined;
  if (!item || item.itemType !== 4 || !placement || create?.type !== 12
      || !effect || effect.functions[0]?.type !== 2) return;
  const numbers = readContactMineNumbers(create.t, create.x, effect.attributes.HP);
  return {itemTableId: item.itemTableId, placementSkillId: placement.skillId,
    effectSkillId: effect.skillId, groundDurationMs: numbers.durationMs,
    triggerRadius: numbers.triggerRadius, damage: numbers.damage};
}

/** Remove before life settlement; a lethal contact can finish and clear the room. */
export function advanceContactMines(room: RoomState, now: number, events: MsgRoomEvent[],
  hit: (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => void): void {
  if (room.phase !== 'PLAYING') return;
  for (const mine of [...room.groundTraps]) {
    if (room.phase !== 'PLAYING') break;
    if (itemTrapHandler(mine.itemTableId) !== 'contactMine') continue;
    const rule = readContactMineRule(mine.itemTableId);
    if (!rule) continue;
    if (mine.itemTableId !== rule.itemTableId) continue;
    const owner = room.players.get(mine.ownerId);
    if (!owner || now >= mine.expiresAt) {
      room.groundTraps = room.groundTraps.filter(trap => trap.id !== mine.id);
      continue;
    }
    for (const target of room.players.values()) {
      if (target.id === owner.id || !target.alive || target.hp <= 0 ||
          target.combat.status !== 2 || (room.mode <= 3 && target.team === mine.team) ||
          (target.invincibility && now < target.invincibility.expiresAt) ||
          Math.hypot(target.x - mine.x, target.z - mine.z) > rule.triggerRadius) continue;
      room.groundTraps = room.groundTraps.filter(trap => trap.id !== mine.id);
      events.push({roomId: room.roomId, type: 'trapTriggered', message: '',
        playerId: owner.id, targetId: target.id, value: 0,
        x: target.x, y: target.y, z: target.z, skillId: rule.effectSkillId,
        playSkillEffect: {skillId: rule.effectSkillId, effectIndex: 0, duration: 0,
          roleId: Number(target.id.slice(1)), xBits: 0, zBits: 0}});
      hit(owner, target, rule.damage, rule.effectSkillId);
      break;
    }
  }
}
