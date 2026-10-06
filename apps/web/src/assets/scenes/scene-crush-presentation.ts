import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';

/** Original45efb3 hides first and starts the optional retained051 on every call. */
export class SceneCrushPresentation {
  constructor(private readonly view: {hide(): void},
    private readonly runtime: Pick<EffectRuntime, 'startCrushEffect' | 'stopCrushEffect' | 'releaseSceneEffect'>,
    private effectHandle: number) {}

  crush(): void {
    this.view.hide();
    if (this.effectHandle) this.runtime.startCrushEffect(this.effectHandle);
  }

  /** Round reset stops the old retained051; the map owner restores source visibility. */
  reset(): void {
    if (this.effectHandle) this.runtime.stopCrushEffect(this.effectHandle);
  }

  dispose(): void {
    if (this.effectHandle) this.runtime.releaseSceneEffect(this.effectHandle);
    this.effectHandle = 0;
  }
}
