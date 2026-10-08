/** Reload feedback follows the server deadline without an extra visual delay. */
export class ReloadProgress {
  private total = 0;
  private remaining = 0;
  private shot = 0;

  update(state: {duration: number; remaining?: number; startedAt: number},
    serverTime: number, serverNow: number): number {
    if (state.startedAt === 0) return 1;
    // Preparation snapshots can carry the deferred shot's future reload start.
    if (serverNow < state.startedAt) return 0;
    if (state.startedAt !== this.shot) {
      this.shot = state.startedAt;
      this.total = Math.fround(state.duration);
    }
    const remaining = state.remaining ?? Math.max(0,
      this.total - Math.max(0, serverTime - state.startedAt) / 1000);
    this.remaining = Math.max(0, remaining - Math.max(0, serverNow - serverTime) / 1000);
    return this.total > 0 ? Math.max(0, Math.min(1,
      Math.fround((this.total - this.remaining) / this.total))) : 1;
  }

  reset(): void {this.total = 0; this.remaining = 0; this.shot = 0;}
}
