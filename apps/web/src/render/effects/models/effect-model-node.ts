import {effectOrbitOffset} from '../common/orbit';
import {EffectNativeMatrix, rotateEffectVector, transformEffectPositionInPlace} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';
import {integrateSpriteMotion} from '../common/motion';

export interface EffectModelControl {
  baseStart: number;
  baseFlag: number;
  motion: {position: EffectVec3; velocity: EffectVec3; acceleration: EffectVec3};
  orbit: {axis: EffectVec3; radius: number; angularRate: number};
  scale: EffectVec3;
  scaleRate: EffectVec3;
  angles: EffectVec3;
  angleRate: EffectVec3;
  alpha: number;
  alphaRate: number;
  animationRate: number;
}

export interface EffectModelBackend {
  setTime(time: number): void;
  setRate(rate: number): void;
  update(): void;
}

/** Original type5 non-path model state and supplied model animation interface. */
export class EffectModelNodeState {
  controller = 0;
  position: EffectVec3 = [0, 0, 0];
  velocity: EffectVec3 = [0, 0, 0];
  orbitOffset: EffectVec3 = [0, 0, 0];
  angles: EffectVec3 = [0, 0, 0];
  scale: EffectVec3 = [0, 0, 0];
  alpha = 0;
  private origin: EffectVec3 = [0, 0, 0];

  constructor(readonly controls: readonly EffectModelControl[],
    private readonly globalRotation: EffectNativeMatrix, private readonly hasParent: boolean,
    private readonly backend: EffectModelBackend) {}

  start(origin: EffectVec3): void {
    this.controller = 0;
    this.origin = [...origin];
    const control = this.controls[0];
    this.initialize(control);
    this.alpha = control.alpha;
    this.backend.setTime(0);
    this.backend.setRate(control.animationRate);
    this.backend.update();
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    if (!control.baseFlag) this.initialize(control);
    this.orbitOffset = control.orbit.angularRate === 0 ? [0, 0, 0] :
      effectOrbitOffset(control.orbit, control.baseStart, control.baseStart);
  }

  update(elapsed: number, deltaSeconds: number): void {
    const control = this.controls[this.controller];
    const delta = Math.fround(deltaSeconds);
    const acceleration = this.hasParent ? control.motion.acceleration :
      rotateEffectVector(this.globalRotation, control.motion.acceleration);
    const motion = integrateSpriteMotion(this, acceleration, delta);
    this.position = motion.position;
    this.velocity = motion.velocity;
    if (control.orbit.angularRate !== 0) {
      this.orbitOffset = effectOrbitOffset(control.orbit, elapsed, control.baseStart);
    }
    this.scale = this.scale.map((value, axis) =>
      Math.fround(value + Math.fround(delta * control.scaleRate[axis]))) as EffectVec3;
    this.angles = this.angles.map((value, axis) =>
      Math.fround(value + Math.fround(delta * control.angleRate[axis]))) as EffectVec3;
    this.alpha = Math.max(0, Math.min(1, Math.fround(this.alpha + delta * control.alphaRate)));
    this.backend.update();
  }

  private initialize(control: EffectModelControl): void {
    const position = this.hasParent ? control.motion.position :
      transformEffectPositionInPlace(this.globalRotation, control.motion.position);
    this.position = position.map((value, axis) => Math.fround(value + this.origin[axis])) as EffectVec3;
    this.velocity = this.hasParent ? [...control.motion.velocity] :
      rotateEffectVector(this.globalRotation, control.motion.velocity);
    this.angles = [...control.angles];
    this.scale = [...control.scale];
    this.orbitOffset = control.orbit.angularRate === 0 ? [0, 0, 0] :
      effectOrbitOffset(control.orbit, control.baseStart, control.baseStart);
  }
}
