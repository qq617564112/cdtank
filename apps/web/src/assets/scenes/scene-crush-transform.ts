import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {effectRenderMatrix} from '../../render/effects/common/effect-render-transform';
import type {EffectVec3} from '../../render/effects/common/types';

/** Base44de02 builds the object transform from position and XYZ angles. */
export function sceneCrushTransform(position: EffectVec3, rotation: EffectVec3): EffectNativeMatrix {
  return effectRenderMatrix(position, [0, 0, 0], rotation, [1, 1, 1]);
}
