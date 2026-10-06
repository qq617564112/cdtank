import type {EffectVec3} from './types';

/** Original 0x475f56 path clock and interpolation with explicit trailing storage. */
export class EffectPathClock {
  frame = 0;
  remainder = 0;

  constructor(readonly vertices: readonly EffectVec3[], readonly rate: number,
    readonly mode: number, private readonly trailingVertex: EffectVec3) {}

  reset(): void {
    this.frame = 0;
    this.remainder = 0;
  }

  advance(deltaSeconds: number): EffectVec3 {
    const amount = Math.fround(deltaSeconds) * Math.fround(this.rate);
    let frames = Math.trunc(amount);
    const fraction = amount - frames + this.remainder;
    this.remainder = Math.fround(fraction);
    if (fraction >= 1) {
      ++frames;
      this.remainder = Math.fround(this.remainder - 1);
    }
    this.frame += frames;
    if (this.frame >= this.vertices.length) {
      if (this.mode === 0) this.frame = 0;
      else if (this.mode === 1) this.frame = this.vertices.length - 1;
    }
    const next = this.frame + 1 <= this.vertices.length ? this.frame + 1 : this.frame;
    const first = this.vertices[this.frame];
    const second = next === this.vertices.length ? this.trailingVertex : this.vertices[next];
    return first.map((value, index) => Math.fround(Math.fround(value) +
      Math.fround(Math.fround(Math.fround(second[index]) - Math.fround(value)) * this.remainder))) as EffectVec3;
  }
}
