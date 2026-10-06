/** Breach playback followed by the original fade rate, independent of HP rules. */
export class SceneBreachState {
  private fading = false;
  private hidden = false;
  private alpha = 1;
  private playbackRemaining = 0;

  constructor(private readonly animationDurationSeconds = 0) {}

  destroy(): boolean {
    if (this.fading) return false;
    this.fading = true;
    this.alpha = 1;
    this.playbackRemaining = this.animationDurationSeconds;
    return true;
  }

  /** Advance only while the current visual is the broken visual, as native code does. */
  update(deltaSeconds: number, hasBrokenVisual = true): void {
    if (!this.fading || this.hidden || !hasBrokenVisual) return;
    const elapsed = Math.fround(deltaSeconds);
    const fadeElapsed = Math.max(0, elapsed - this.playbackRemaining);
    this.playbackRemaining = Math.max(0, this.playbackRemaining - elapsed);
    this.alpha = Math.fround(this.alpha - Math.fround(fadeElapsed) * 0.5);
    // Native fcom/test/parity branch is strictly below zero, not <= zero.
    if (this.alpha < 0) this.hidden = true;
  }

  reset(): void {
    this.fading = false;
    this.hidden = false;
    this.alpha = 1;
    this.playbackRemaining = 0;
  }

  snapshot(): {fading: boolean; hidden: boolean; alpha: number} {
    return {fading: this.fading, hidden: this.hidden, alpha: this.alpha};
  }
}
