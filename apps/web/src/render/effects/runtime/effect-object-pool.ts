/** Original per-type active prefix and swap-on-release pool, 0x47f90a/0x47f1bc. */
export class EffectObjectPool<T> {
  readonly slots: T[] = [];
  activeCount = 0;

  constructor(private readonly create: () => T, private readonly unbind: (value: T) => void) {}

  take(): T {
    if (this.activeCount === this.slots.length) this.slots.push(this.create());
    return this.slots[this.activeCount++];
  }

  release(value: T): void {
    for (let index = 0; index < this.activeCount; ++index) {
      if (this.slots[index] !== value) continue;
      this.unbind(value);
      --this.activeCount;
      this.slots[index] = this.slots[this.activeCount];
      this.slots[this.activeCount] = value;
      return;
    }
  }
}
