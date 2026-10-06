/** Web critical amount; authority supplies qualified current rate and one roll. */
export function calculateQualifiedShotCritical(
  rawAttack: number,
  qualifiedRate: number | undefined,
  roll: number,
  multiplier: number,
): {attack: number; critical: boolean} {
  const critical = qualifiedRate !== undefined && qualifiedRate > 0 && qualifiedRate > roll;
  return {attack: critical ? rawAttack * multiplier : rawAttack, critical};
}
