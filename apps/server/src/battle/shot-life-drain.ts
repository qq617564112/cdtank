import {setBattleHealth, type HealthParticipant} from './health';
import {calculateShotLifeDrain} from './roles/shot-life-drain-amount';
import type {MsgRoomEvent} from '../../../shared/protocols';

export interface ShotLifeDrainParticipant extends HealthParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  attributesReady?: boolean;
  combat: HealthParticipant['combat'] & {roleFloatFields?: Map<number, number>};
}

/** Web shot authority supplies actual hostile HP loss; original +94 supplies the ratio. */
export function applyShotLifeDrain(roomId: string, attacker: ShotLifeDrainParticipant,
  actualHpRemoved: number, events: MsgRoomEvent[]): void {
  if (!attacker.alive || !attacker.attributesReady) return;
  const healing = calculateShotLifeDrain(actualHpRemoved, attacker.combat.roleFloatFields?.get(0x94));
  if (healing <= 0 || attacker.hp >= attacker.attributes.record.maxHp) return;
  const previous = attacker.hp;
  setBattleHealth(attacker, previous + healing);
  const restored = attacker.hp - previous;
  if (restored <= 0) return;
  events.push({roomId, type: 'playerHealed', message: `${attacker.name}吸收${restored}生命`,
    playerId: attacker.id, targetId: attacker.id, value: restored,
    x: attacker.x, y: attacker.y, z: attacker.z});
}
