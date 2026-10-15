import {EffectNativeMatrix} from '../common/effect-native-space';
import {EffectModelNodeState} from './effect-model-node';
import {EFFECT_IDENTITY, EffectRenderTransform, multiplyEffectMatricesToRef} from '../common/effect-render-transform';

export interface EffectModelDraw {
  matrix: EffectNativeMatrix;
  blend: 0 | 1;
  alpha: number;
  priority: 0 | -1 | -2;
}

export function effectModelDraw(
  state: Pick<EffectModelNodeState, 'position' | 'orbitOffset' | 'angles' | 'scale' | 'alpha'>,
  parent?: EffectNativeMatrix, global: EffectNativeMatrix = EFFECT_IDENTITY): EffectModelDraw | undefined {
  return new EffectModelDrawState().update(state, parent, global);
}

/** Original type5 0x47e56a: parent, translation, XYZ rotation, scale, global. */
export class EffectModelDrawState {
  private readonly transform = new EffectRenderTransform();
  private readonly world = new Array<number>(16);
  private readonly result: EffectModelDraw = {matrix: EFFECT_IDENTITY, blend: 0, alpha: 1, priority: 0};

  /** The renderer consumes this instance-owned result before the next update. */
  update(state: Pick<EffectModelNodeState, 'position' | 'orbitOffset' | 'angles' | 'scale' | 'alpha'>,
    parent?: EffectNativeMatrix, global: EffectNativeMatrix = EFFECT_IDENTITY): EffectModelDraw | undefined {
    if (parent?.every(value => value === 0)) return undefined;
    let matrix = this.transform.update(state.position, state.orbitOffset, state.angles, state.scale, parent);
    if (!parent) {
      multiplyEffectMatricesToRef(matrix, global, this.world);
      matrix = this.world;
    }
    const transparent = state.alpha < 1;
    const result = this.result;
    result.matrix = matrix;
    result.blend = transparent ? 1 : 0;
    result.alpha = transparent ? state.alpha : 1;
    result.priority = transparent ? -2 : 0;
    return result;
  }
}
