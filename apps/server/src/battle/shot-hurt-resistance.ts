import {resolveQualifiedShotHurtSelector} from './roles/qualified-shot-hurt-resistance';

interface HurtResistanceParticipant {
  attributesReady?: boolean;
  combat: {roleFloatFields?: Map<number, number>};
}

/** Web anti-stagger policy reads the target's current qualified original +90 ratio. */
export function resolveShotHurtSelector(target: HurtResistanceParticipant,
  selector: number | undefined): number | undefined {
  return resolveQualifiedShotHurtSelector(selector,
    target.attributesReady ? target.combat.roleFloatFields?.get(0x90) : undefined);
}
