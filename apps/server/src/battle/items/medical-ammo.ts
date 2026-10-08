import type {MsgRoomEvent} from '../../../../shared/protocols';
import {combatItems, combatSkills} from '../catalog';
import {setBattleHealth, type HealthParticipant} from '../health';
import {recordHealing, type RoundStatsCarrier} from '../round-statistics';



/** Source4007 supplies HP300; accepted-shot victim qualification is rebuilt. */
export function resolveMedicalAmmo(roomId: string, owner: RoundStatsCarrier & {id: string; name: string},
  target: HealthParticipant & {id: string; name: string; alive: boolean;
    x: number; y: number; z: number; combat: HealthParticipant['combat'] & {status: number}},
  ammoItemId: number | undefined, events: MsgRoomEvent[],
  healsAlly = false): boolean {
  if (ammoItemId === undefined || combatItems.get(ammoItemId)?.runtime.hit !== 'medical') return false;
  // Medical shots never fall through to ordinary damage, including invalid victims.
  if (!target.alive || target.combat.status !== 2 || target.lastStand) return true;
  const skill = combatSkills.get(combatItems.get(ammoItemId)!.runtime.skillRoles.secondary)!;
  const previous = target.hp;
  setBattleHealth(target, previous + skill.attributes.HP);
  const restored = target.hp - previous;
  if (healsAlly) recordHealing(owner, restored);
  events.push({roomId, type: 'playerHealed',
    message: `${owner.name}的${combatItems.get(ammoItemId)!.name}为${target.name}恢复${restored}生命`,
    playerId: owner.id, targetId: target.id, value: restored,
    x: target.x, y: target.y, z: target.z, skillId: skill.skillId,
    shotPlayerResult: {itemId: ammoItemId}});
  return true;
}
