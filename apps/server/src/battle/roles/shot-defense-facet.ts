/** Web armor sectors use the real incoming bearing relative to body heading. */
export function resolveShotDefenseFacet(
    bodyYaw: number,
    bearing: {x: number; z: number},
): 'FRONT' | 'SIDE' | 'BACK' {
  const difference = Math.atan2(bearing.x, bearing.z) - bodyYaw;
  const angle = Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)));
  if (angle <= Math.PI / 4) return 'FRONT';
  if (angle >= 3 * Math.PI / 4) return 'BACK';
  return 'SIDE';
}
