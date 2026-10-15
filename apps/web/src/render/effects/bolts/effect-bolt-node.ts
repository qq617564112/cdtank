import {EffectBoltConfig, EffectBoltSegments, generateEffectBoltSegmentsToRef, effectBoltWorldSegmentsToRef} from './effect-bolt-segments';
import {EffectVec3} from '../common/types';
import {EffectNativeMatrix, transformEffectPositionToRef} from '../common/effect-native-space';
import {EffectTargetBinding, EffectTargetProvider} from '../runtime/effect-target-provider';

/** Original type2 world start and single rebuild per update, retaining excess time. */
export class EffectBoltNodeState {
  remainder = 0;
  bolt: EffectBoltSegments = {start: [0, 0, 0], end: [0, 0, 0], segments: []};
  worldSegments: number[][] = [];
  private readonly segmentCapacity: EffectVec3[] = [];
  private readonly worldCapacity: number[][] = [];
  private readonly origin: EffectVec3 = [0, 0, 0];
  private readonly zeroOrigin: EffectVec3 = [0, 0, 0];
  private readonly effectiveConfig: EffectBoltConfig;
  private readonly parentIsZero = (value: number): boolean => Math.fround(value) === 0;
  readonly target = new EffectTargetBinding();

  constructor(readonly config: EffectBoltConfig & {interval: number}, private readonly random: () => number,
    private readonly parentMatrix?: EffectNativeMatrix, target?: EffectTargetProvider) {
    this.effectiveConfig = {start: [0, 0, 0], end: [0, 0, 0], lengthRange: config.lengthRange, angleRange: config.angleRange};
    this.target.bind(target);
  }

  start(origin: EffectVec3): void {
    this.origin[0] = origin[0]; this.origin[1] = origin[1]; this.origin[2] = origin[2];
    this.remainder = 0;
    this.rebuild();
  }

  update(deltaSeconds: number): void {
    const remainder = this.remainder + Math.fround(deltaSeconds);
    this.remainder = Math.fround(remainder);
    if (remainder >= this.config.interval) {
      this.remainder = Math.fround(remainder - this.config.interval);
      this.rebuild();
    }
  }

  private rebuild(): void {
    if (this.parentMatrix?.every(this.parentIsZero)) {
      this.bolt.segments.length = 0;
      this.worldSegments.length = 0;
      return;
    }
    const config = this.effectiveConfig;
    // The source config stays live: target and parent transforms only write this workspace.
    config.lengthRange = this.config.lengthRange;
    config.angleRange = this.config.angleRange;
    if (this.parentMatrix) {
      transformEffectPositionToRef(this.parentMatrix, this.config.start, config.start);
      transformEffectPositionToRef(this.parentMatrix, this.config.end, config.end);
    } else {
      for (let axis = 0; axis < 3; axis++) {
        config.start[axis] = this.config.start[axis];
        config.end[axis] = this.config.end[axis];
      }
    }
    const position = this.target.position();
    let origin = this.parentMatrix ? this.zeroOrigin : this.origin;
    if (position) {
      for (let axis = 0; axis < 3; axis++) {
        config.start[axis] = Math.fround(config.start[axis] + origin[axis]);
        config.end[axis] = position[axis];
      }
      origin = this.zeroOrigin;
    }
    generateEffectBoltSegmentsToRef(config, origin, this.random, this.bolt, this.segmentCapacity);
    effectBoltWorldSegmentsToRef(this.bolt, this.worldSegments, this.worldCapacity);
  }
}
