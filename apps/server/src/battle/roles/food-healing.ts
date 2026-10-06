/** Food restoration uses the qualified role percentage; rounding is Web authority policy. */
export function calculateFoodHealing(baseHP: number, qualifiedRate?: number): number {
  return Math.round(baseHP * (1 + (qualifiedRate ?? 0)));
}
