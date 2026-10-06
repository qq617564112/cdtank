import {calculateQualifiedShotCritical} from './roles/qualified-shot-critical';

interface CriticalParticipant {
  alive: boolean;
  attributesReady?: boolean;
  combat: {roleFloatFields?: Map<number, number>};
}

/** Web authority: current qualified probability, one roll, twice raw shot damage. */
export function resolveShotCritical(attacker: CriticalParticipant, rawDamage: number):
    {attack: number; critical: boolean} {
  const rate = attacker.alive && attacker.attributesReady
    ? attacker.combat.roleFloatFields?.get(0x68) : undefined;
  if (rate === undefined || rate <= 0) return {attack: rawDamage, critical: false};
  return calculateQualifiedShotCritical(rawDamage, rate, Math.random(), 2);
}
