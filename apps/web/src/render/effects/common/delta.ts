export function spriteDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new Error('Invalid original sprite update delta');
  }
  return Math.fround(deltaSeconds);
}
