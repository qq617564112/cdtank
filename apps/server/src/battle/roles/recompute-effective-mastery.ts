/** Original433ad6–433c55: zero remaining minutes at owned+34 lowers mastery. */
export function applyRoleEffectiveMastery(values: number[], ownedField34: number,
    tankType: number): number | undefined {
  if ((ownedField34 | 0) === 0) {
    for (let index = 2; index < 6; index++) {
      values[index] = Math.max(1, (values[index]! - 1) | 0);
    }
  }
  if (tankType < 1 || tankType > 4) return undefined;
  return values[tankType + 1]!;
}
