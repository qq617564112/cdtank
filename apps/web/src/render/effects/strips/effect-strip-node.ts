import {effectOrbitOffset} from '../common/orbit';
import {EffectNativeMatrix, rotateEffectVector, transformEffectPositionInPlace} from '../common/effect-native-space';
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
  origin: EffectVec3 = [0, 0, 0];
  state!: EffectStripState;
  scroll = 0;
  readonly geometry: EffectStripSegment[];

  constructor(readonly controls: readonly EffectStripController[],
    readonly frames: readonly [number, number, number, number][],
    private readonly random: () => number, readonly globalRotation: EffectNativeMatrix,
    readonly parentMatrix?: EffectNativeMatrix) {
    this.geometry = initialEffectStripGeometry(controls[0].geometry, frames[0], controls[0].color);
  }

  start(origin: EffectVec3): void {
    this.controller = 0;
    this.origin = origin.map(Math.fround) as EffectVec3;
    const control = this.controls[0];
    this.state = {position: this.controlPosition(control), orbitOffset: this.initialOrbit(control),
      velocity: this.controlVelocity(control), angles: [...control.angles], scale: [...control.scale],
      color: [...control.color], frame: this.initialFrame(control), frameRemainder: 0};
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    const previous = this.state;
    this.state = {position: control.baseFlag ? previous.position : this.controlPosition(control),
      orbitOffset: this.initialOrbit(control),
      velocity: control.baseFlag ? previous.velocity : this.controlVelocity(control),
      angles: control.baseFlag ? previous.angles : [...control.angles],
      scale: control.baseFlag ? previous.scale : [...control.scale],
      color: [...control.color], frame: this.initialFrame(control), frameRemainder: 0};
  }

  update(elapsed: number, deltaSeconds: number): void {
    const control = this.controls[this.controller];
    this.state = advanceEffectStripState(this.state, control, elapsed, deltaSeconds,
      this.globalRotation, this.parentMatrix !== undefined, count => this.random() % count);
    const next = advanceEffectStripUv(this.scroll, deltaSeconds, control.scrollRate,
      this.frames[this.state.frame], control.geometry.segments, control.geometry.textureLength);
    this.scroll = next.scroll;
    next.uvs.forEach((uv, index) => {this.geometry[index].uv = uv;});
  }

  private controlPosition(control: EffectStripController): EffectVec3 {
    const local = this.parentMatrix ? control.motion.position :
      transformEffectPositionInPlace(this.globalRotation, control.motion.position);
    return local.map((value, axis) => Math.fround(value + this.origin[axis])) as EffectVec3;
  }
  private controlVelocity(control: EffectStripController): EffectVec3 {
    return this.parentMatrix ? [...control.motion.velocity] : rotateEffectVector(this.globalRotation, control.motion.velocity);
  }
  private initialOrbit(control: EffectStripController): EffectVec3 {
    return control.orbit.angularRate !== 0 ? effectOrbitOffset(control.orbit, control.baseStart, control.baseStart) : [0, 0, 0];
  }
  private initialFrame(control: EffectStripController): number {
    return control.frameFlags & 2 ? control.frameCount - 1 : control.frameFlags & 4 ? this.random() % control.frameCount : 0;
  }
}
