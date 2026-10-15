export interface EffectParticleLifetime {
  age: number;
  lifetime: number;
}

/** Native packed particle array (0x47fbb1, 0x480805 and 0x480857). */
export class EffectParticlePool<T extends EffectParticleLifetime> {
  readonly particles: T[] = [];
  private readonly spare: T[] = [];

  constructor(readonly capacity: number) {}

  emit(count: number, initialize: (recycled?: T) => T): number {
    let emitted = 0;
    const available = Math.min(count, this.capacity - this.particles.length);
    for (; emitted < available; ++emitted) {
      this.particles.push(initialize(this.spare.pop()));
    }
    return emitted;
  }

  /** Expiration moves the retained tail into the slot; the forward loop then skips it. */
  update(deltaSeconds: number, advance: (particle: T, delta: number) => T): void {
    const delta = Math.fround(deltaSeconds);
    for (let index = 0; index < this.particles.length; ++index) {
      const particle = this.particles[index];
      const age = Math.fround(particle.age) + delta;
      particle.age = Math.fround(age);
      if (age >= Math.fround(particle.lifetime)) {
        const last = this.particles.length - 1;
        if (last > 0) this.particles[index] = this.particles[last];
        this.particles.pop();
        this.spare.push(particle);
      } else {
        this.particles[index] = advance(particle, delta);
      }
    }
  }

  clear(): void {
    this.particles.length = 0;
    this.spare.length = 0;
  }
}
