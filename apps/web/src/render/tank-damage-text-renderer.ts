import type {Scene} from '@babylonjs/core';
import {SceneCastleDamageTextRenderer, type CastleDamageTextFont} from './scene-castle-damage-text-renderer';

/** Actor damage uses the numeric font with a separate wordmark for a zero result. */
export class TankDamageTextRenderer extends SceneCastleDamageTextRenderer {
  constructor(scene: Scene, font: CastleDamageTextFont) {
    super(scene, font, 'Damage', 0, {asset: 'ui/battle/dodge.webp', width: 52.35, height: 28});
  }
}

export type {CastleDamageTextFont as TankDamageTextFont} from './scene-castle-damage-text-renderer';
