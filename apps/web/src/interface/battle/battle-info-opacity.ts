/** Original GameMain +0x95c clock and picBattleInfoPanel alpha consumers. */
export class BattleInfoOpacity {
  private elapsed = 0;
  private opacity = 1;
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): number => this.opacity;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  reset(): void {
    this.elapsed = 0;
    this.publish(1);
  }

  advance(seconds: number): void {
    if (this.elapsed >= 8) return;
    // 4cae94 stores f32 without popping x87; the comparison uses the unrounded sum.
    const sum = this.elapsed + Math.fround(seconds);
    this.elapsed = Math.fround(sum);
    if (sum >= 8) this.publish(Math.fround(.2));
  }

  hover(entered: boolean): void {
    if (entered) this.publish(1);
    else if (this.elapsed >= 8) this.publish(Math.fround(.2));
  }

  private publish(opacity: number): void {
    if (opacity === this.opacity) return;
    this.opacity = opacity;
    for (const listener of this.listeners) listener();
  }
}
