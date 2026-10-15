/** Type-1 history order and sampling from 0x482b24 and 0x483161. */
export interface EffectTrailConfig {
  enabled: boolean;
  limit: number;
  interval: number;
}

/** The caller supplies the complete native 80-byte state, including frame. */
export class EffectTrailHistory<T> {
  readonly entries: T[] = [];
  elapsed = 0;
  private readonly spare: T[] = [];

  constructor(initial: T, config: EffectTrailConfig,
    private readonly copy: (state: T) => T,
    private readonly copyTo?: (state: T, result: T) => void) {
    const count = config.enabled ? config.limit : 1;
    for (let index = 0; index < count; ++index) this.entries.push(copy(initial));
  }

  /** Only entry zero changes between samples; older entries remain snapshots. */
  update(current: T, deltaSeconds: number, config: EffectTrailConfig): boolean {
    let sampled = false;
    if (config.enabled) {
      // Compare the x87 sum before rounding the stored elapsed value.
      const sum = this.elapsed + Math.fround(deltaSeconds);
      this.elapsed = Math.fround(sum);
      if (sum >= Math.fround(config.interval)) {
        this.elapsed = Math.fround(sum - Math.fround(config.interval));
        if (this.copyTo) {
          // Recycle the oldest entry only when this sample will discard it.
          const next = this.entries.length >= config.limit ? this.entries.pop()! :
            this.spare.pop() ?? this.copy(this.entries[0]);
          this.entries.unshift(next);
        } else {
          this.entries.unshift(this.copy(this.entries[0]));
        }
        sampled = true;
      }
      this.writeCurrent(current);
      if (sampled) this.trim(Math.min(this.entries.length, config.limit));
    } else {
      if (this.entries.length > 1) this.trim(1);
      this.writeCurrent(current);
      this.elapsed = 0;
    }
    return sampled;
  }

  private writeCurrent(current: T): void {
    if (this.copyTo) this.copyTo(current, this.entries[0]);
    else this.entries[0] = this.copy(current);
  }

  private trim(count: number): void {
    if (this.copyTo) {
      while (this.entries.length > count) this.spare.push(this.entries.pop()!);
    } else {
      this.entries.length = count;
    }
  }
}
