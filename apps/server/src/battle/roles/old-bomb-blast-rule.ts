export function readOldBombBlastNumbers(delaySeconds: number, range: number,
  hpDelta: number): {delayMs: number; halfExtent: number; damage: number} {
  return {delayMs: delaySeconds * 1000, halfExtent: range / 2, damage: -hpDelta};
}

export function isInsideOldBombBlast(dx: number, dz: number, fullExtent: number): boolean {
  return Math.abs(dx) <= fullExtent / 2 && Math.abs(dz) <= fullExtent / 2;
}
