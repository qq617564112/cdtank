import {EffectFrameClock, EffectFrameConfig} from '../common/effect-frame-clock';
import {EffectSpriteMesh} from '../common/effect-sprite-mesh';
import type {EffectVec3} from '../common/types';

/** Combines proven frame selection with native UV grids; no node lifecycle. */
export class EffectSpriteAtlas {
  readonly clock: EffectFrameClock;
  constructor(readonly sprite: EffectSpriteMesh, config: EffectFrameConfig,
    private readonly frames: readonly [number, number, number, number][],
    randomFrame: (count: number) => number) {
    if (frames.length !== config.frameCount) throw new Error('Original atlas frame count mismatch');
    this.clock = new EffectFrameClock(config, randomFrame);
  }

  update(deltaSeconds: number,
    corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3], color: number): number {
    const frame = this.clock.advance(deltaSeconds);
    this.sprite.update(corners, this.frames[frame], color);
    return frame;
  }

  reset(corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3], color: number): void {
    this.clock.reset();
    this.sprite.update(corners, this.frames[this.clock.frame], color);
  }
}
