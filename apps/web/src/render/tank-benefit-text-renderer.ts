import type {Scene} from '@babylonjs/core';
import {SceneCastleDamageTextRenderer} from './scene-castle-damage-text-renderer';
import type {CastleDamageTextFont} from './scene-castle-damage-text-renderer';

/** Original Benefit.font uses the same static-digit drawing provider with its own glyph owner. */
export class TankBenefitTextRenderer extends SceneCastleDamageTextRenderer {
  constructor(scene: Scene, font: CastleDamageTextFont) {
    super(scene, font, 'Benefit');
  }
}
export type {CastleDamageTextFont as TankBenefitTextFont} from './scene-castle-damage-text-renderer';
