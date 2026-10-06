/** Original4cb670 starts f32(duration+.5);4ca9d7 decrements stored f32 each frame. */
export class ReloadProgress {
  private total = 0;
  private remaining = 0;
  private shot = 0;

  update(state: {duration: number; startedAt: number}, serverTime: number, delta: number): number {
    // Preparation snapshots can carry the deferred shot's future reload start.
    if (serverTime < state.startedAt) return 0;
    if (state.startedAt !== this.shot) {
      this.shot = state.startedAt;
      this.total = Math.fround(state.duration + .5);
      this.remaining = Math.max(0, Math.fround(this.total - Math.max(0, serverTime - state.startedAt) / 1000));
    } else {
      this.remaining = Math.max(0, Math.fround(this.remaining - Math.fround(delta)));
    }
    return this.total > 0 ? Math.fround((this.total - this.remaining) / this.total) : 1;
  }

  reset(): void {this.total = 0; this.remaining = 0; this.shot = 0;}
}
