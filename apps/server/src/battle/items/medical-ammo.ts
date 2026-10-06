import type {MsgRoomEvent} from '../../../../shared/protocols';
import {combatSkills} from '../catalog';
import {setBattleHealth, type HealthParticipant} from '../health';
import {recordHealing, type RoundStatsCarrier} from '../round-statistics';

export const MEDICAL_AMMO_ID = 2009;

/** Source4007 supplies HP300; accepted-shot victim qualification is rebuilt. */
export function resolveMedicalAmmo(roomId: string, owner: {id: string; name: string} & RoundStatsCarrier,
  target: HealthParticipant & {id: string; name: string; alive: boolean;
    x: number; y: number; z: number; combat: HealthParticipant['combat'] & {status: number}},
  ammoItemId: number | undefined, events: MsgRoomEvent[],
  healsAlly = false): boolean {
  if (ammoItemId !== MEDICAL_AMMO_ID) return false;
  // Medical shots never fall through to ordinary damage, including invalid victims.
  if (!target.alive || target.combat.status !== 2 || target.lastStand) return true;
  const skill = combatSkills.get(4007)!;
  const previous = target.hp;
  setBattleHealth(target, previous + skill.attributes.HP);
  const restored = target.hp - previous;
  if (healsAlly) recordHealing(owner, restored);
  events.push({roomId, type: 'playerHealed',
    message: `${owner.name}的医疗弹为${target.name}恢复${restored}生命`,
    playerId: owner.id, targetId: target.id, value: restored,
    x: target.x, y: target.y, z: target.z, skillId: skill.skillId,
    shotPlayerResult: {itemId: MEDICAL_AMMO_ID}});
  return true;
}
