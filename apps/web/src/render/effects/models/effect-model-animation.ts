import {EffectNativeMatrix} from '../common/effect-native-space';
import {EFFECT_IDENTITY} from '../common/effect-render-transform';
import {animationMatrix, sampleAnimationVertices} from '../../../../../shared/movement/animation-sampling';

export interface EffectModelTrack {mode: number; keys: number[][];}
export interface EffectModelAnimationNode {
  position: EffectModelTrack;
  rotation: EffectModelTrack;
  scale: EffectModelTrack;
  value: number;
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
  matrix: EffectNativeMatrix = [...EFFECT_IDENTITY];
  constructor(readonly node: EffectModelAnimationNode, readonly duration: number) {}

  setTime(time: number): void {this.time = Math.fround(time); this.loops = 0;}
  setRate(rate: number): void {this.rate = Math.fround(rate);}

  update(deltaSeconds: number): void {
    this.time += Math.fround(deltaSeconds * this.rate);
    if (this.duration > 0) {
      while (this.time > this.duration) {this.time -= this.duration; ++this.loops;}
    }
    const time = Math.fround(this.time);
    this.matrix = animationMatrix(this.node, time) as EffectNativeMatrix;
  }
}

/** gbAnimatedMesh interpolates XYZ and UV, and copies the next frame's normal. */
export function effectModelVertices(frames: readonly (readonly number[][])[], times: readonly number[], time: number): number[][] {
  return sampleAnimationVertices({frames, times}, Math.fround(time));
}
