/** Original Breach visual lifecycle (EXE 45e7b0/45e6c4), independent of HP rules. */
export class SceneBreachState {
  private fading = false;
  private hidden = false;
  private alpha = 1;

  destroy(): boolean {
    if (this.fading) return false;
    this.fading = true;
    this.alpha = 1;
    return true;
  }

  /** Advance only while the current visual is the broken visual, as native code does. */
  update(deltaSeconds: number, hasBrokenVisual = true): void {
    if (!this.fading || this.hidden || !hasBrokenVisual) return;
    this.alpha = Math.fround(this.alpha - Math.fround(deltaSeconds) * 0.5);
    // Native fcom/test/parity branch is strictly below zero, not <= zero.
    if (this.alpha < 0) this.hidden = true;
  }

  reset(): void {
    this.fading = false;
    this.hidden = false;
    this.alpha = 1;
  }

  snapshot(): {fading: boolean; hidden: boolean; alpha: number} {
    return {fading: this.fading, hidden: this.hidden, alpha: this.alpha};
  }
}
