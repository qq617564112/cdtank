import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {TankView} from './tank-view';

/** Original423157 dispatches pet-type death feedback through actor467a08. */
export class TankPetDeathPresentation {
  constructor(private readonly runtime: Pick<EffectRuntime, 'spawnAttachedEffect'>) {}

  /** The formal death owner supplies PetTable+2c; the runtime owns expiry and actor release. */
  show(view: TankView, petType: number, localView?: TankView): number {
    const effectId = petType === 1 ? 119 : petType === 2 ? 120 : undefined;
    if (effectId === undefined) return 0;
    return this.runtime.spawnAttachedEffect(view, effectId, 0, true, localView);
  }
}
