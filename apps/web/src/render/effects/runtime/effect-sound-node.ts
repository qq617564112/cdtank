export interface EffectSoundBackend<T> {
  play(reference: string, parameter: number): T;
  finished(handle: T): boolean;
  stop(handle: T): void;
}

/** Shared original manager descriptor at 0x6d2800. */
export interface EffectSoundStore<T> {last?: T;}

/** Original type4 vtable methods 0x474008/0x474086/0x4740ed/0x474104. */
export class EffectSoundNodeState<T> {
  started = false;
  handle?: T;

  constructor(readonly reference: string, readonly parameter: number,
    readonly stopPrevious: boolean, readonly backend: EffectSoundBackend<T>,
    readonly shared: EffectSoundStore<T>) {}

  start(): void {this.started = false;}

  update(): void {
    if (this.started) return;
    if (this.stopPrevious && this.shared.last !== undefined && !this.backend.finished(this.shared.last)) {
      this.backend.stop(this.shared.last);
    }
    this.handle = this.backend.play(this.reference, this.parameter);
    this.shared.last = this.handle;
    this.started = true;
  }

  additionalEnd(lifetimeEnded: boolean): boolean {
    if (lifetimeEnded) {
      if (this.started) this.backend.stop(this.handle!);
      return true;
    }
    return this.started && this.backend.finished(this.handle!);
  }

  end(): void {
    if (this.started) this.backend.stop(this.handle!);
  }
}
