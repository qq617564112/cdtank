import {readPetSkills} from './pet-skill-rules';
import {setBattleHealth, type HealthParticipant} from './health';
import type {PlayerState} from './player-state';
import type {MsgRoomEvent} from '../../../shared/protocols';

type KillParticipant = Pick<PlayerState,
  'id' | 'name' | 'team' | 'alive' | 'hp' | 'x' | 'y' | 'z' | 'attributesReady' |
  'ownedRoles' | 'lastStand'> & HealthParticipant & {
    combat: HealthParticipant['combat'] & Pick<PlayerState['combat'], 'status'>;
  };

/** Selected learned kill-healing skill restores life after an authoritative hostile final kill. */
export function healPetAfterKill(roomId: string, attacker: KillParticipant,
  target: Pick<KillParticipant, 'id' | 'team' | 'alive'>, mode: number,
  events: MsgRoomEvent[]): number {
  if (target.alive || !attacker.alive || attacker.combat.status !== 2 ||
      !attacker.attributesReady || attacker.id === target.id ||
      (mode <= 3 && attacker.team === target.team)) return 0;
  const skill = readPetSkills({ownedRoles: attacker.ownedRoles}, false).find(source => source.rule.event === 'kill'
    && source.rule.handler === 'heal' && source.rule.target === 'self')?.skill;
  if (skill?.triggerType !== 4 || skill.target !== 1 ||
      skill.functions[0]?.type !== 2 || skill.functions[0].t !== 0) return 0;
  const previous = attacker.hp;
  setBattleHealth(attacker, previous + skill.attributes.HP);
  const restored = attacker.hp - previous;
  if (restored > 0) {
    events.push({roomId, type: 'playerHealed', message: `${attacker.name}恢复${restored}生命`,
      playerId: attacker.id, targetId: attacker.id, value: restored,
      x: attacker.x, y: attacker.y, z: attacker.z, skillId: skill.skillId});
  }
  return restored;
}
