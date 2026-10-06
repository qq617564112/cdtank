/** Qualified original fields; composing and rounding shot damage is a Web rule. */
export function calculateQualifiedShotAttack(input: {
  attackBase: number;
  attackPercent: number;
  attackBonus: number;
}): number {
  return Math.round(Math.max(0, input.attackBase * input.attackPercent + input.attackBonus));
}
