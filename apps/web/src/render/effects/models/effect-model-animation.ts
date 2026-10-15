import {EffectNativeMatrix} from '../common/effect-native-space';
import {ANIMATION_IDENTITY, AnimationTransformSampler, sampleAnimationVertices,
  type AnimationTrack} from '../../../../../shared/movement/animation-sampling';

export type EffectModelTrack = AnimationTrack;
export interface EffectModelAnimationNode {
  readonly position: EffectModelTrack;
  readonly rotation: EffectModelTrack;
  readonly scale: EffectModelTrack;
  readonly value: number;
}

/** gbGfxManager::GetDeltaTime preserves f64 delta below .5, otherwise returns .1. */
export function effectModelEngineDelta(deltaSeconds: number): number {
  return deltaSeconds < .5 ? deltaSeconds : .1;
}

/** Original gbGeomNode clock and source mode-3 CVD transform tracks. */
export class EffectModelAnimation {
  time = 0;
  loops = 0;
  rate = 1;
  readonly matrix: EffectNativeMatrix;
  private readonly sampledMatrix?: number[];
  private readonly sampler: AnimationTransformSampler;
  private sampledTime?: number;
  constructor(readonly node: EffectModelAnimationNode, readonly duration: number,
    sampler?: AnimationTransformSampler) {
    this.sampler = sampler ?? new AnimationTransformSampler(node);
    this.sampledMatrix = sampler ? [...ANIMATION_IDENTITY] : undefined;
    this.matrix = this.sampledMatrix ?? this.sampler.matrix;
  }

  setTime(time: number): void {this.time = Math.fround(time); this.loops = 0;}
  setRate(rate: number): void {this.rate = Math.fround(rate);}

  update(deltaSeconds: number): void {
    this.time += Math.fround(deltaSeconds * this.rate);
    if (this.duration > 0) {
      while (this.time > this.duration) {this.time -= this.duration; ++this.loops;}
    }
    const time = Math.fround(this.time);
    if (this.sampledTime === time) return;
    const sampled = this.sampler.sample(time);
    // Another instance may sample this source at a different time before draw.
    if (this.sampledMatrix) {
      for (let index = 0; index < 16; index++) this.sampledMatrix[index] = sampled[index];
    }
    this.sampledTime = time;
  }
}

/** gbAnimatedMesh interpolates XYZ and UV, and copies the next frame's normal. */
export function effectModelVertices(frames: readonly (readonly number[][])[], times: readonly number[], time: number): number[][] {
  return sampleAnimationVertices({frames, times}, Math.fround(time));
}
