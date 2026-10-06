export interface EffectParticleLifetime {
  age: number;
  lifetime: number;
}

/** Native packed particle array (0x47fbb1, 0x480805 and 0x480857). */
export class EffectParticlePool<T extends EffectParticleLifetime> {
  readonly particles: T[] = [];

  constructor(readonly capacity: number, private readonly copy: (particle: T) => T) {}

  emit(count: number, initialize: () => T): number {
    let emitted = 0;
    for (let attempt = 0; attempt < count; ++attempt) {
      if (this.particles.length < this.capacity) {
        this.particles.push(initialize());
        ++emitted;
      }
    }
    return emitted;
  }

  /** Expiration copies the tail into the slot; the forward loop then skips it. */
  update(deltaSeconds: number, advance: (particle: T, delta: number) => T): void {
    const delta = Math.fround(deltaSeconds);
    for (let index = 0; index < this.particles.length; ++index) {
      const particle = this.particles[index];
      const age = Math.fround(particle.age) + delta;
      particle.age = Math.fround(age);
      if (age >= Math.fround(particle.lifetime)) {
        const last = this.particles.length - 1;
        if (last > 0) this.particles[index] = this.copy(this.particles[last]);
        this.particles.pop();
      } else {
        this.particles[index] = advance(particle, delta);
      }
    }
  }

  clear(): void {
    this.particles.length = 0;
  }
}
