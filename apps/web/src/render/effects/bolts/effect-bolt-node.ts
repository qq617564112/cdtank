import {EffectBoltConfig, EffectBoltSegments, generateEffectBoltSegments, effectBoltWorldSegments} from './effect-bolt-segments';
import {EffectVec3} from '../common/types';
import {EffectNativeMatrix, transformEffectPosition} from '../common/effect-native-space';
import {EffectTargetBinding, EffectTargetProvider} from '../runtime/effect-target-provider';

/** Original type2 world start and single rebuild per update, retaining excess time. */
export class EffectBoltNodeState {
  remainder = 0;
  bolt: EffectBoltSegments = {start: [0, 0, 0], end: [0, 0, 0], segments: []};
  worldSegments: number[][] = [];
  private origin: EffectVec3 = [0, 0, 0];
  readonly target = new EffectTargetBinding();

  constructor(readonly config: EffectBoltConfig & {interval: number}, private readonly random: () => number,
    private readonly parentMatrix?: EffectNativeMatrix, target?: EffectTargetProvider) {this.target.bind(target);}

  start(origin: EffectVec3): void {
    this.origin = [...origin];
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
    if (this.parentMatrix?.every(value => Math.fround(value) === 0)) {
      this.bolt = {...this.bolt, segments: []};
      this.worldSegments = [];
      return;
    }
    let config = this.parentMatrix ? {...this.config,
      start: transformEffectPosition(this.parentMatrix, this.config.start),
      end: transformEffectPosition(this.parentMatrix, this.config.end)} : this.config;
    const position = this.target.position();
    let origin = this.parentMatrix ? [0, 0, 0] as EffectVec3 : this.origin;
    if (position) {
      const start = config.start.map((value, axis) => Math.fround(value + origin[axis])) as EffectVec3;
      config = {...config, start, end: [...position]};
      origin = [0, 0, 0];
    }
    this.bolt = generateEffectBoltSegments(config, origin, this.random);
    this.worldSegments = effectBoltWorldSegments(this.bolt);
  }
}
