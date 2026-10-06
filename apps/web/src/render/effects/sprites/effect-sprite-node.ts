import {effectOrbitOffset} from '../common/orbit';
import {advanceEffectFrame, EffectFrameConfig} from '../common/effect-frame-clock';
import {EffectNativeMatrix, rotateEffectVector, transformEffectPositionInPlace} from '../common/effect-native-space';
import {EffectSpriteState, resetEffectSprite} from './effect-sprite-reset';
import {advanceEffectSpriteSpace, EffectSpriteSpaceControl} from './effect-sprite-space';
import {advanceSpriteAppearance, EffectSpriteAppearanceConfig, initialSpriteAppearance} from './appearance';
import {EffectVec3} from '../common/types';
import {EffectPathClock} from '../common/effect-path-clock';
import {EffectTrailHistory} from './effect-trail';

export interface EffectSpriteController extends EffectSpriteSpaceControl, EffectFrameConfig {
  baseFlag: number;
  motion: {position: EffectVec3; velocity: EffectVec3; acceleration: EffectVec3};
  appearance: EffectSpriteAppearanceConfig;
  trailEnabled: boolean;
  trailLimit: number;
  trailInterval: number;
}

/** Original type1 state/frame/history composition; lifecycle stays external. */
export class EffectSpriteNodeState {
  controller = 0;
  frameRemainder = 0;
  origin: EffectVec3 = [0, 0, 0];
  history!: EffectTrailHistory<EffectSpriteState>;

  constructor(readonly controls: readonly EffectSpriteController[],
    private readonly random: () => number, readonly globalRotation: EffectNativeMatrix,
    readonly parentMatrix?: EffectNativeMatrix, readonly modelAligned = false, readonly path?: EffectPathClock) {}

  start(origin: EffectVec3): void {
    this.controller = 0;
    this.frameRemainder = 0;
    this.origin = (this.parentMatrix && this.modelAligned ? [0, 0, 0] : origin.map(Math.fround)) as EffectVec3;
    const control = this.controls[0];
    const frame = control.frameFlags & 2 ? control.frameCount - 1 :
      control.frameFlags & 4 ? this.random() % control.frameCount : 0;
    const initial: EffectSpriteState = {...initialSpriteAppearance(control.appearance),
      position: this.controlPosition(control), velocity: this.controlVelocity(control),
      orbitOffset: this.initialOrbit(control), frame};
    if (this.path) {
      this.path.reset();
      initial.position = this.pathPosition(0);
      initial.orbitOffset = [0, 0, 0];
    }
    const previousElapsed = control.trailEnabled ? 0 : this.history?.elapsed ?? 0;
    this.history = new EffectTrailHistory(initial, this.trailConfig(control), state => structuredClone(state));
    this.history.elapsed = previousElapsed;
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    this.history.entries[0] = resetEffectSprite(this.history.entries[0],
      {baseFlag: control.baseFlag, appearance: control.appearance, velocity: this.controlVelocity(control)},
      this.controlPosition(control), this.initialOrbit(control));
  }

  update(elapsed: number, deltaSeconds: number): void {
    const control = this.controls[this.controller];
    const previous = this.history.entries[0];
    const appearance = advanceSpriteAppearance(previous, control.appearance, deltaSeconds);
    const space = advanceEffectSpriteSpace(previous, control, elapsed, deltaSeconds,
      this.globalRotation, this.parentMatrix !== undefined, this.modelAligned);
    if (this.path) {
      space.position = this.pathPosition(deltaSeconds);
      space.orbitOffset = [0, 0, 0];
    }
    const frame = advanceEffectFrame({frame: previous.frame, remainder: this.frameRemainder},
      control, deltaSeconds, count => this.random() % count);
    this.frameRemainder = frame.remainder;
    this.history.update({...appearance, ...space, frame: frame.frame}, deltaSeconds, this.trailConfig(control));
  }

  private pathPosition(deltaSeconds: number): EffectVec3 {
    return this.path!.advance(deltaSeconds).map((value, axis) =>
      Math.fround(value + this.origin[axis])) as EffectVec3;
  }

  private controlPosition(control: EffectSpriteController): EffectVec3 {
    const local = this.parentMatrix ? control.motion.position :
      transformEffectPositionInPlace(this.globalRotation, control.motion.position);
    return local.map((value, axis) => Math.fround(value + this.origin[axis])) as EffectVec3;
  }

  private controlVelocity(control: EffectSpriteController): EffectVec3 {
    return this.parentMatrix ? [...control.motion.velocity] : rotateEffectVector(this.globalRotation, control.motion.velocity);
  }

  private initialOrbit(control: EffectSpriteController): EffectVec3 {
    return !this.modelAligned && control.orbit.angularRate !== 0 ?
      effectOrbitOffset(control.orbit, control.baseStart, control.baseStart) : [0, 0, 0];
  }

  private trailConfig(control: EffectSpriteController): {enabled: boolean; limit: number; interval: number} {
    return {enabled: control.trailEnabled, limit: control.trailLimit, interval: control.trailInterval};
  }
}
