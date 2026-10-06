/** Original4376bb/437626: delay1, counts5..0. The visible observer4cc99e
 * displays positive counts; zero does not change visibility or text.
 * Snapshot PLAYING/local alive maps to the original client state/role gates.
 * This client schedule never authorizes a server respawn.
 */
export class LocalDeathCountdown {
  private context = '';
  private dead = false;
  private pending?: ReturnType<typeof setTimeout>;

  constructor(private readonly display: (count: number | undefined) => void) {}

  update(context: string, playing: boolean, alive: boolean | undefined): void {
    if (this.context !== context) {
      this.clear();
      this.context = context;
    }
    if (!playing || alive !== false) {
      if (this.dead) this.clear();
      this.context = context;
      return;
    }
    if (this.dead) return;
    this.dead = true;
    this.schedule(5);
  }

  private schedule(count: number): void {
    this.pending = setTimeout(() => {
      this.pending = undefined;
      if (!this.dead) return;
      if (count > 0) this.display(count);
      if (count > 0) this.schedule(count - 1);
    }, 1000);
  }

  clear(): void {
    if (this.pending !== undefined) clearTimeout(this.pending);
    this.pending = undefined;
    this.context = '';
    this.dead = false;
    this.display(undefined);
  }
}
