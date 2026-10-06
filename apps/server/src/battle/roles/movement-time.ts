/** Original433190 rejects nonpositive elapsed, then435088 caps at f32(.2). */
export function roleMovementElapsed(seconds: number): number {
  const elapsed = Math.fround(seconds);
  return elapsed > 0 ? Math.min(elapsed, Math.fround(.2)) : 0;
}
