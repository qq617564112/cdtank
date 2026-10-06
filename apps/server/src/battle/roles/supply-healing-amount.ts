export function calculateSupplyHealingAmount(hp: number, maxHp: number, baseHealing: number): number {
  return Math.max(0, Math.min(baseHealing, maxHp - hp));
}
