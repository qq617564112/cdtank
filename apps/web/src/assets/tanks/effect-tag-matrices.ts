import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {EffectTagWorldComposer, type EffectTagWorldPose} from './effect-tag-world';

export const EFFECT_PRIMARY_TAGS = ['tag_efcenter', 'tag_effront', 'tag_efback',
  'tag_efleft', 'tag_efright', 'tag_efsoot', 'tag_efattack'] as const;
export type EffectPrimaryTag = typeof EFFECT_PRIMARY_TAGS[number];

export interface EffectTagSource {
  read(part: 'M' | 'U', name: EffectPrimaryTag): EffectNativeMatrix | undefined;
}

/** Requested tag references remain stable and update with every original pose. */
export class EffectPrimaryTagMatrices {
  private readonly matrices = new Map<EffectPrimaryTag, number[]>();
  private readonly composer = new EffectTagWorldComposer();
  private source?: EffectTagSource;
  private pose?: EffectTagWorldPose;

  constructor(readonly fourPart: boolean) {}

  get(name: EffectPrimaryTag): EffectNativeMatrix {
    let matrix = this.matrices.get(name);
    if (!matrix) {
      matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      this.matrices.set(name, matrix);
      if (this.source && this.pose) this.updateMatrix(name, matrix, this.source, this.pose);
    }
    return matrix;
  }

  update(source: EffectTagSource, pose: EffectTagWorldPose): void {
    this.source = source;
    this.pose = pose;
    // Effects retain these arrays; every requested tag continues updating even
    // when its caller does not fetch the reference again.
    for (const [name, matrix] of this.matrices) this.updateMatrix(name, matrix, source, pose);
  }

  private updateMatrix(name: EffectPrimaryTag, matrix: number[],
    source: EffectTagSource, pose: EffectTagWorldPose): void {
    let local = source.read('M', name);
    if (local === undefined && this.fourPart) local = source.read('U', name);
    if (local === undefined) matrix.fill(0);
    else this.composer.composeToRef(local, pose, this.fourPart && name === 'tag_efattack', matrix);
  }
}
