import {itemForHandler, itemTrapHandler} from '../../../../shared/content/catalog';
import {combatItems, combatSkills} from '../catalog';
import {isInsideOldBombBlast, readOldBombBlastNumbers} from '../roles/old-bomb-blast-rule';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';

/** Original 3001→3009→3012 fields; delay and square geometry follow the Web policy. */
export function readOldBombRule(itemId = itemForHandler('trap', 'timedBomb').id) {
  const item = combatItems.get(itemId);
  const placement = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = placement?.functions[0];
  const explosion = create ? combatSkills.get(create.y) : undefined;
  const area = explosion?.functions[0];
  const terminal = area ? combatSkills.get(area.y) : undefined;
  if (!item || item.itemType !== 4 || !placement || create?.type !== 13
      || !explosion || area?.type !== 15 || !terminal || terminal.functions[0]?.type !== 2) return;
  const numbers = readOldBombBlastNumbers(create.t, explosion.range, terminal.attributes.HP);
  return {itemTableId: item.itemTableId, placementSkillId: placement.skillId,
    explosionSkillId: explosion.skillId, effectSkillId: explosion.skillId, triggerRadius: 0, damageSkillId: terminal.skillId,
    groundDurationMs: numbers.delayMs, range: explosion.range, damage: numbers.damage};
}

function floatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

export function oldBombWorldEffect(skillId: number, x: number, z: number): PlaySkillEffectMessage {
  return {skillId, effectIndex: 0, duration: 0, roleId: 0, xBits: floatBits(x), zBits: floatBits(z)};
}

/** Remove before resolving targets: a mode finish may clear the entire object collection. */
export function advanceOldBombs(room: RoomState, now: number, events: MsgRoomEvent[],
  hit: (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => void): void {
  if (room.phase !== 'PLAYING') return;
  for (const bomb of [...room.groundTraps]) {
    if (room.phase !== 'PLAYING') break;
    if (itemTrapHandler(bomb.itemTableId) !== 'timedBomb') continue;
    const rule = readOldBombRule(bomb.itemTableId);
    if (!rule) continue;
    if (bomb.itemTableId !== rule.itemTableId || now < bomb.expiresAt) continue;
    room.groundTraps = room.groundTraps.filter(trap => trap.id !== bomb.id);
    const owner = room.players.get(bomb.ownerId);
    if (!owner) continue;
    events.push({roomId: room.roomId, type: 'trapTriggered', message: '',
      playerId: owner.id, targetId: bomb.id, value: 0, x: bomb.x, y: bomb.y, z: bomb.z,
      skillId: rule.explosionSkillId,
      playSkillEffect: oldBombWorldEffect(rule.explosionSkillId, bomb.x, bomb.z)});
    for (const target of room.players.values()) {
      if (room.phase !== 'PLAYING') break;
      if (target.id === owner.id || !target.alive || target.combat.status !== 2 ||
          (room.mode <= 3 && target.team === bomb.team) ||
          !isInsideOldBombBlast(target.x - bomb.x, target.z - bomb.z, rule.range)) continue;
      hit(owner, target, rule.damage, rule.damageSkillId);
    }
  }
}
