import {resolveAttackCancellation} from './roles/reactive-armor-counter';

interface ShotCancellationParticipant {
  attributesReady?: boolean;
  attributes: {values?: {roleIntegers: Map<number, number>}};
  cancellationsSpent?: number;
}

/** Web per-life expenditure; original roleInteger+58 supplies current capacity. */
export function consumeShotCancellation(target: ShotCancellationParticipant): boolean {
  const maximum = target.attributesReady ? target.attributes.values?.roleIntegers.get(0x58) : undefined;
  const result = resolveAttackCancellation(maximum, target.cancellationsSpent ?? 0);
  target.cancellationsSpent = result.cancellationsSpent;
  return result.blocked;
}
