/** MV3 actor clocks advance 4800 native units per second; converted GLB keys use units/1000. */
export function castleAnimationTime(elapsedSeconds: number, duration: number, stopAtEnd: boolean): number {
  const ticks = Math.trunc(Math.max(0, elapsedSeconds) * 4800);
  return (stopAtEnd && ticks >= duration ? duration - 100 : ticks % duration) / 1000;
}

/** Shared placement phase substitutes the original per-process rand15 provider. */
export function plantSwayParameter(id: string, height: number, elapsedSeconds: number): number {
  const phase = Math.fround((Number(id) % 32768) * 120 * Math.fround(1 / 32767));
  const current = Math.fround((phase + Math.fround(elapsedSeconds) * 2) % Math.fround(6.28318));
  return Math.fround(Math.cos(current) / height * Math.fround(.15));
}

export function plantSwayDisplacement(parameter: number, y: number): number {
  return Math.fround(Math.fround(parameter * y) * y);
}
