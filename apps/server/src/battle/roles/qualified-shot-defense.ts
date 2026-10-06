/** Original defense fields; point composition and shot mitigation are Web rules. */
export function calculateQualifiedShotDamage(rawDamage: number, input: {
  defensePercent: number;
  defenseBonus: number;
}, defenseCorrection = 1): number {
  const defensePoints = Math.max(0, input.defensePercent * 100 + input.defenseBonus);
  return rawDamage * 100 / (100 + defensePoints * defenseCorrection);
}
