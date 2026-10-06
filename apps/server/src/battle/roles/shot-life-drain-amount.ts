/** Actual integer HP loss supplies the amount; rounding is Web authority policy. */
export function calculateShotLifeDrain(actualHpRemoved: number, qualifiedRate?: number): number {
  if (qualifiedRate === undefined) return 0;
  return Math.round(Math.max(0, actualHpRemoved * qualifiedRate));
}
