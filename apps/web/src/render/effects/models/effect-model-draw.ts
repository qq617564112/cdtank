import {EffectNativeMatrix} from '../common/effect-native-space';
import {EffectModelNodeState} from './effect-model-node';
import {EFFECT_IDENTITY, effectRenderMatrix, multiplyEffectMatrices} from '../common/effect-render-transform';

export interface EffectModelDraw {
  matrix: EffectNativeMatrix;
  blend: 0 | 1;
  alpha: number;
  priority: 0 | -1 | -2;
}

/** Original type5 0x47e56a: parent, translation, XYZ rotation, scale, global. */
export function effectModelDraw(state: Pick<EffectModelNodeState, 'position' | 'orbitOffset' | 'angles' | 'scale' | 'alpha'>,
  parent?: EffectNativeMatrix, global: EffectNativeMatrix = EFFECT_IDENTITY): EffectModelDraw | undefined {
  if (parent?.every(value => value === 0)) return undefined;
  let matrix = effectRenderMatrix(state.position, state.orbitOffset, state.angles, state.scale, parent);
  if (!parent) matrix = multiplyEffectMatrices(matrix, global);
  const transparent = state.alpha < 1;
  return {matrix, blend: transparent ? 1 : 0, alpha: transparent ? state.alpha : 1,
    priority: transparent ? -2 : 0};
}
