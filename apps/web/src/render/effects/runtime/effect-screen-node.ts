export interface EffectScreenBackend {
  selectEffect(index: number, parameter: number): void;
  clearEffect(): void;
  shake(parameter: number, lifetime: number, strength: number): void;
}

export type EffectScreenConfig = {type: 10} | {type: 11; parameter: number; strength: number};

/** Original type10 effect selection and type11 camera activation. */
export class EffectScreenNodeState {
  constructor(readonly config: EffectScreenConfig, private readonly backend: EffectScreenBackend) {}

  activate(lifetime: number): void {
    if (this.config.type === 10) {
      this.backend.selectEffect(5, 0);
    } else if (lifetime > 0) {
      this.backend.shake(this.config.parameter, Math.fround(lifetime), this.config.strength);
    }
  }

  end(): void {
    if (this.config.type === 10) this.backend.clearEffect();
  }
}
