import {effectOrbitOffsetToRef} from '../common/orbit';
import {advanceEffectFrame, EffectFrameConfig} from '../common/effect-frame-clock';
import {EffectNativeMatrix, rotateEffectVectorToRef, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';
import {EffectSpriteState, EffectSpriteResetConfig, resetEffectSpriteToRef} from './effect-sprite-reset';
import {advanceEffectSpriteSpaceToRef, EffectSpriteSpaceControl} from './effect-sprite-space';
import {advanceSpriteAppearanceToRef, EffectSpriteAppearanceConfig, initialSpriteAppearanceToRef} from './appearance';
import {EffectVec3} from '../common/types';
import {EffectPathClock} from '../common/effect-path-clock';
import {EffectTrailConfig, EffectTrailHistory} from './effect-trail';

function copySpriteState(state: EffectSpriteState): EffectSpriteState {
  return {position: [...state.position], velocity: [...state.velocity],
    orbitOffset: [...state.orbitOffset], scale: [...state.scale], angles: [...state.angles],
    color: [...state.color], frame: state.frame};
}

function copySpriteStateToRef(state: EffectSpriteState, result: EffectSpriteState): void {
  for (let axis = 0; axis < 3; axis++) {
    result.position[axis] = state.position[axis]; result.velocity[axis] = state.velocity[axis];
    result.orbitOffset[axis] = state.orbitOffset[axis]; result.scale[axis] = state.scale[axis];
    result.angles[axis] = state.angles[axis];
  }
  for (let channel = 0; channel < 4; channel++) result.color[channel] = state.color[channel];
  result.frame = state.frame;
}

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
  private readonly frameState = {frame: 0, frameRemainder: 0};
  private readonly randomFrame = (count: number): number => this.random() % count;
  private readonly updated: EffectSpriteState = {position: [0, 0, 0], velocity: [0, 0, 0],
    orbitOffset: [0, 0, 0], scale: [0, 0, 0], angles: [0, 0, 0], color: [0, 0, 0, 0], frame: 0};
  private readonly acceleration: EffectVec3 = [0, 0, 0];
  private readonly trailConfig: EffectTrailConfig = {enabled: false, limit: 0, interval: 0};
  private readonly resetConfig: EffectSpriteResetConfig;

  constructor(readonly controls: readonly EffectSpriteController[],
    private readonly random: () => number, readonly globalRotation: EffectNativeMatrix,
    readonly parentMatrix?: EffectNativeMatrix, readonly modelAligned = false, readonly path?: EffectPathClock,
    private readonly trailDensity = 1) {
    this.resetConfig = {baseFlag: 0, appearance: controls[0].appearance, velocity: this.updated.velocity};
  }

  start(origin: EffectVec3): void {
    this.controller = 0;
    this.frameRemainder = 0;
    for (let axis = 0; axis < 3; axis++) {
      this.origin[axis] = this.parentMatrix && this.modelAligned ? 0 : Math.fround(origin[axis]);
    }
    const control = this.controls[0];
    this.selectTrailConfig(control);
    const frame = control.frameFlags & 2 ? control.frameCount - 1 :
      control.frameFlags & 4 ? this.random() % control.frameCount : 0;
    const initial = this.updated;
    initialSpriteAppearanceToRef(control.appearance, initial);
    this.controlPositionToRef(control, initial.position);
    this.controlVelocityToRef(control, initial.velocity);
    this.initialOrbitToRef(control, initial.orbitOffset);
    initial.frame = frame;
    if (this.path) {
      this.path.reset();
      this.path.advanceToRef(0, initial.position);
      for (let axis = 0; axis < 3; axis++) {
        initial.position[axis] = Math.fround(initial.position[axis] + this.origin[axis]);
        initial.orbitOffset[axis] = 0;
      }
    }
    const previousElapsed = control.trailEnabled ? 0 : this.history?.elapsed ?? 0;
    this.history = new EffectTrailHistory(initial, this.trailConfig, copySpriteState, copySpriteStateToRef);
    this.history.elapsed = previousElapsed;
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    this.selectTrailConfig(control);
    const config = this.resetConfig;
    config.baseFlag = control.baseFlag;
    config.appearance = control.appearance;
    this.controlVelocityToRef(control, config.velocity);
    this.controlPositionToRef(control, this.updated.position);
    this.initialOrbitToRef(control, this.updated.orbitOffset);
    const current = this.history.entries[0];
    resetEffectSpriteToRef(current, config, this.updated.position, this.updated.orbitOffset, current);
  }

  update(elapsed: number, deltaSeconds: number): void {
    const control = this.controls[this.controller];
    const previous = this.history.entries[0];
    const updated = this.updated;
    advanceSpriteAppearanceToRef(previous, control.appearance, deltaSeconds, updated);
    advanceEffectSpriteSpaceToRef(previous, control, elapsed, deltaSeconds,
      this.globalRotation, this.parentMatrix !== undefined, this.modelAligned, updated, this.acceleration);
    if (this.path) {
      this.path.advanceToRef(deltaSeconds, updated.position);
      for (let axis = 0; axis < 3; axis++) {
        updated.position[axis] = Math.fround(updated.position[axis] + this.origin[axis]);
        updated.orbitOffset[axis] = 0;
      }
    }
    const frame = this.frameState;
    frame.frame = previous.frame; frame.frameRemainder = this.frameRemainder;
    advanceEffectFrame(frame, control, deltaSeconds, this.randomFrame);
    this.frameRemainder = frame.frameRemainder;
    updated.frame = frame.frame;
    this.history.update(updated, deltaSeconds, this.trailConfig);
  }

  private selectTrailConfig(control: EffectSpriteController): void {
    const fullDensity = this.trailDensity === 1 || !control.trailEnabled;
    this.trailConfig.enabled = control.trailEnabled;
    this.trailConfig.limit = fullDensity ? control.trailLimit :
      Math.max(1, Math.ceil(control.trailLimit * this.trailDensity));
    this.trailConfig.interval = fullDensity ? control.trailInterval : control.trailInterval / this.trailDensity;
  }

  private controlPositionToRef(control: EffectSpriteController, result: EffectVec3): void {
    if (this.parentMatrix) {
      for (let axis = 0; axis < 3; axis++) result[axis] = control.motion.position[axis];
    } else {
      transformEffectPositionInPlaceToRef(this.globalRotation, control.motion.position, result);
    }
    for (let axis = 0; axis < 3; axis++) result[axis] = Math.fround(result[axis] + this.origin[axis]);
  }

  private controlVelocityToRef(control: EffectSpriteController, result: EffectVec3): void {
    if (this.parentMatrix) {
      for (let axis = 0; axis < 3; axis++) result[axis] = control.motion.velocity[axis];
    } else {
      rotateEffectVectorToRef(this.globalRotation, control.motion.velocity, result);
    }
  }

  private initialOrbitToRef(control: EffectSpriteController, result: EffectVec3): void {
    if (!this.modelAligned && control.orbit.angularRate !== 0) {
      effectOrbitOffsetToRef(control.orbit, control.baseStart, control.baseStart, result);
    } else {
      for (let axis = 0; axis < 3; axis++) result[axis] = 0;
    }
  }
}
