export function readContactMineNumbers(durationSeconds: number, triggerRadius: number,
  hpDelta: number): {durationMs: number; triggerRadius: number; damage: number} {
  return {durationMs: durationSeconds * 1000, triggerRadius, damage: -hpDelta};
}
