/** Type-6 emission count from 0x480138; random draws remain caller-owned. */
export interface EffectEmitterConfig {
  countRange: [number, number];
  burst: boolean;
}

export class EffectEmitterClock {
  fraction = 0;
  burstEmitted = false;

  constructor(private readonly randomInclusive: (minimum: number, maximum: number) => number) {}

  advance(deltaSeconds: number, config: EffectEmitterConfig, density = 1): number {
    // The original draws even when a completed burst emits nothing this tick.
    const count = this.randomInclusive(...config.countRange);
    if (config.burst) {
      if (this.burstEmitted) return 0;
      this.burstEmitted = true;
      return Math.ceil(count * density);
    }
    const amount = count * density * Math.fround(deltaSeconds);
    let emitted = Math.trunc(amount);
    const fraction = amount - emitted + this.fraction;
    this.fraction = Math.fround(fraction);
    if (fraction >= 1) {
      ++emitted;
      this.fraction = Math.fround(this.fraction - 1);
    }
    return emitted;
  }
}
