/** Type7 0x4749b5–0x474a90 texture-scroll and per-segment UV writes. */
export function advanceEffectStripUv(scroll: number, deltaSeconds: number, rate: number,
  frame: readonly [number, number, number, number], segments: number, textureLength: number):
  {scroll: number; uvs: [number, number, number, number][]} {
  let nextScroll = Math.fround(Math.fround(scroll) + Math.fround(deltaSeconds) * Math.fround(rate));
  if (nextScroll > 1) nextScroll = 0;
  const step = Math.fround((Math.fround(textureLength) / segments) * (frame[2] - frame[0]));
  const firstV = frame[1] + nextScroll;
  const whole = Math.trunc(firstV);
  const v0 = Math.fround(Math.fround(firstV) - whole);
  const v1 = Math.fround(frame[3] + nextScroll - whole);
  let u = frame[0];
  const uvs: [number, number, number, number][] = [];
  for (let index = 0; index < segments; ++index) {
    const u0 = Math.fround(u);
    u += step;
    uvs.push([u0, v0, Math.fround(u), v1]);
  }
  return {scroll: nextScroll, uvs};
}
