/** Original level.dat 积分要求 for earned 阶级ID 1..20. */
export const LEVEL_THRESHOLDS = [0, 300, 1200, 3000, 6000, 10500, 16800, 25200, 36000, 49500,
  66000, 85800, 109200, 136500, 168000, 204000, 244800, 290700, 342000, 399000] as const;

export const MAX_EARNED_LEVEL = LEVEL_THRESHOLDS.length;

/** Largest earned tier whose original point requirement is met. */
export function levelFor(rankPoints: number): number {
  let level = 1;
  for (let index = 1; index < LEVEL_THRESHOLDS.length; index++) {
    if (rankPoints >= LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}

/** Progress within a displayed tier, including a boundary reached during settlement playback. */
export function expPercentAtLevel(rankPoints: number, level: number): number {
  if (level >= MAX_EARNED_LEVEL) return 100;
  const floor = LEVEL_THRESHOLDS[level - 1];
  const ceiling = LEVEL_THRESHOLDS[level];
  return Math.max(0, Math.min(100, (rankPoints - floor) / (ceiling - floor) * 100));
}

/** Account authority publishes the rounded percentage for its earned tier. */
export function expPercentFor(rankPoints: number): number {
  return Math.round(expPercentAtLevel(rankPoints, levelFor(rankPoints)));
}
