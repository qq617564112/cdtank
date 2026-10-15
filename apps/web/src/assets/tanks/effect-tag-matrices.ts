import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {EffectTagWorldComposer, type EffectTagWorldPose} from './effect-tag-world';

export const EFFECT_PRIMARY_TAGS = ['tag_efcenter', 'tag_effront', 'tag_efback',
  'tag_efleft', 'tag_efright', 'tag_efsoot', 'tag_efattack'] as const;
export type EffectPrimaryTag = typeof EFFECT_PRIMARY_TAGS[number];

export interface EffectTagSource {
  read(part: 'M' | 'U', name: EffectPrimaryTag): EffectNativeMatrix | undefined;
}

/** Primary tag references remain stable while original per-frame values change. */
export class EffectPrimaryTagMatrices {
  private readonly matrices = new Map<EffectPrimaryTag, number[]>();
  private readonly composer = new EffectTagWorldComposer();

  constructor(readonly fourPart: boolean) {}

  get(name: EffectPrimaryTag): EffectNativeMatrix {
    let matrix = this.matrices.get(name);
    if (!matrix) {
      matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      this.matrices.set(name, matrix);
    }
    return matrix;
  }

  update(source: EffectTagSource, pose: EffectTagWorldPose): void {
    for (const name of EFFECT_PRIMARY_TAGS) {
      let local = source.read('M', name);
      if (local === undefined && this.fourPart) local = source.read('U', name);
      const matrix = this.get(name) as number[];
      if (local === undefined) matrix.fill(0);
      else this.composer.composeToRef(local, pose, this.fourPart && name === 'tag_efattack', matrix);
    }
  }
}
