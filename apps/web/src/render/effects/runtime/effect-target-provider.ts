import {EffectVec3} from '../common/types';

/** Original target virtual+1c supplies a world-space position reference. */
export class EffectTargetProvider {
  private readonly observers = new Set<() => void>();

  constructor(readonly position: () => EffectVec3) {}

  observe(invalidated: () => void): () => void {
    this.observers.add(invalidated);
    return () => {this.observers.delete(invalidated);};
  }

  /** Original provider observer destruction calls 474317 to clear each binding. */
  invalidate(): void {
    for (const observer of this.observers) observer();
    this.observers.clear();
  }

  get observerCount(): number {return this.observers.size;}
}

/** Original 474196 detaches the old observer before binding its replacement. */
export class EffectTargetBinding {
  private provider?: EffectTargetProvider;
  private detach?: () => void;

  bind(provider?: EffectTargetProvider): void {
    this.detach?.();
    this.detach = undefined;
    this.provider = provider;
    if (provider) this.detach = provider.observe(() => {
      this.provider = undefined;
      this.detach = undefined;
    });
  }

  get target(): EffectTargetProvider | undefined {return this.provider;}
  position(): EffectVec3 | undefined {return this.provider?.position();}
}
