import {effectOrbitOffsetToRef} from '../common/orbit';
import {EffectNativeMatrix, rotateEffectVectorToRef, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';
import {EffectStripGeometryConfig, EffectStripSegment, initialEffectStripGeometry} from './effect-strip-geometry';
import {advanceEffectStripState, EffectStripControl, EffectStripState} from './effect-strip-state';
import {advanceEffectStripUv} from './effect-strip-uv';
import {EffectColor, EffectVec3} from '../common/types';

export interface EffectStripController extends EffectStripControl {
  baseFlag: number;
  motion: {position: EffectVec3; velocity: EffectVec3; acceleration: EffectVec3};
  angles: EffectVec3;
  color: EffectColor;
  scrollRate: number;
  geometry: EffectStripGeometryConfig;
}

/** Original type7 state, static strip geometry and frame/UV composition. */
export class EffectStripNodeState {
  controller = 0;
  readonly origin: EffectVec3 = [0, 0, 0];
  state!: EffectStripState;
  scroll = 0;
  readonly geometry: EffectStripSegment[];
  private readonly randomFrame = (count: number): number => this.random() % count;

  constructor(readonly controls: readonly EffectStripController[],
    readonly frames: readonly [number, number, number, number][],
    private readonly random: () => number, readonly globalRotation: EffectNativeMatrix,
    readonly parentMatrix?: EffectNativeMatrix) {
    this.geometry = initialEffectStripGeometry(controls[0].geometry, frames[0], controls[0].color);
  }

  start(origin: EffectVec3): void {
    this.controller = 0;
    for (let axis = 0; axis < 3; axis++) this.origin[axis] = Math.fround(origin[axis]);
    const control = this.controls[0];
    this.state ??= {position: [0, 0, 0], orbitOffset: [0, 0, 0], velocity: [0, 0, 0],
      angles: [0, 0, 0], scale: [0, 0, 0], color: [0, 0, 0, 0], frame: 0, frameRemainder: 0};
    this.initializeMotion(control);
    this.initializeAppearance(control);
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    if (!control.baseFlag) this.initializeMotion(control);
    this.initializeAppearance(control);
  }

  update(elapsed: number, deltaSeconds: number): void {
    const control = this.controls[this.controller];
    this.state = advanceEffectStripState(this.state, control, elapsed, deltaSeconds,
      this.globalRotation, this.parentMatrix !== undefined, this.randomFrame);
    this.scroll = advanceEffectStripUv(this.scroll, deltaSeconds, control.scrollRate,
      this.frames[this.state.frame], control.geometry.segments, control.geometry.textureLength, this.geometry);
  }

  private initializeMotion(control: EffectStripController): void {
    const state = this.state;
    if (!this.parentMatrix) {
      transformEffectPositionInPlaceToRef(this.globalRotation, control.motion.position, state.position);
      rotateEffectVectorToRef(this.globalRotation, control.motion.velocity, state.velocity);
    }
    for (let axis = 0; axis < 3; axis++) {
      const position = this.parentMatrix ? control.motion.position[axis] : state.position[axis];
      state.position[axis] = Math.fround(position + this.origin[axis]);
      if (this.parentMatrix) state.velocity[axis] = control.motion.velocity[axis];
      state.angles[axis] = control.angles[axis];
      state.scale[axis] = control.scale[axis];
    }
  }
  private initializeAppearance(control: EffectStripController): void {
    const state = this.state;
    if (control.orbit.angularRate !== 0) {
      effectOrbitOffsetToRef(control.orbit, control.baseStart, control.baseStart, state.orbitOffset);
    } else {
      for (let axis = 0; axis < 3; axis++) state.orbitOffset[axis] = 0;
    }
    for (let axis = 0; axis < 4; axis++) state.color[axis] = control.color[axis];
    state.frame = this.initialFrame(control);
    state.frameRemainder = 0;
  }
  private initialFrame(control: EffectStripController): number {
    return control.frameFlags & 2 ? control.frameCount - 1 : control.frameFlags & 4 ? this.random() % control.frameCount : 0;
  }
}
