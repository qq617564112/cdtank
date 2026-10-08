/** Web luck policy: the qualified percentage is one hostile ammunition evasion probability. */
export function evadeShotWithLuck(target: {
  alive: boolean;
  attributesReady?: boolean;
  combat: {roleFloatFields?: ReadonlyMap<number, number>};
}): boolean {
  const rate = target.alive && target.attributesReady
    ? target.combat.roleFloatFields?.get(0x6c) ?? 0 : 0;
  return rate > 0 && Math.random() < Math.min(1, rate);
}
