import type {RoleCombatState} from './roles/combat-state';
import type {RoleHealthRecord} from './roles/health';

export interface HealthParticipant {
  hp: number;
  lastStand?: import('./last-stand').LastStandState;
  attributes: {record: RoleHealthRecord};
  combat: Pick<RoleCombatState, 'setHealth'>;
}

/** Rebuilt authority publishes one life value to all actual role consumers.
 * The maximum is supplied by the existing mode/source policy, not inferred here.
 */
export function setBattleHealth(player: HealthParticipant, value: number,
  maxHp = player.attributes.record.maxHp): void {
  if (player.lastStand && value > player.hp) return;
  player.attributes.record.maxHp = maxHp;
  player.combat.setHealth(player.attributes.record, value);
  player.hp = player.attributes.record.hp;
}
