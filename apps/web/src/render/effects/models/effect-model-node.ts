import {effectOrbitOffsetToRef} from '../common/orbit';
import {EffectNativeMatrix, rotateEffectVectorToRef, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';
import {integrateSpriteMotionToRef} from '../common/motion';

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
  private readonly origin: EffectVec3 = [0, 0, 0];
  private readonly acceleration: EffectVec3 = [0, 0, 0];

  constructor(readonly controls: readonly EffectModelControl[],
    private readonly globalRotation: EffectNativeMatrix, private readonly hasParent: boolean,
    private readonly backend: EffectModelBackend) {}

  start(origin: EffectVec3): void {
    this.controller = 0;
    for (let axis = 0; axis < 3; axis++) this.origin[axis] = origin[axis];
    const control = this.controls[0];
    this.initialize(control);
    this.initializeOrbit(control);
    this.alpha = control.alpha;
    this.backend.setTime(0);
    this.backend.setRate(control.animationRate);
    this.backend.update();
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    if (!control.baseFlag) this.initialize(control);
    this.initializeOrbit(control);
  }

  update(elapsed: number, deltaSeconds: number): void {
    const control = this.controls[this.controller];
    const delta = Math.fround(deltaSeconds);
    if (!this.hasParent) rotateEffectVectorToRef(this.globalRotation, control.motion.acceleration, this.acceleration);
    integrateSpriteMotionToRef(this, this.hasParent ? control.motion.acceleration : this.acceleration, delta, this);
    if (control.orbit.angularRate !== 0) {
      effectOrbitOffsetToRef(control.orbit, elapsed, control.baseStart, this.orbitOffset);
    }
    for (let axis = 0; axis < 3; axis++) {
      this.scale[axis] = Math.fround(this.scale[axis] + Math.fround(delta * control.scaleRate[axis]));
      this.angles[axis] = Math.fround(this.angles[axis] + Math.fround(delta * control.angleRate[axis]));
    }
    this.alpha = Math.max(0, Math.min(1, Math.fround(this.alpha + delta * control.alphaRate)));
    this.backend.update();
  }

  private initialize(control: EffectModelControl): void {
    if (!this.hasParent) {
      transformEffectPositionInPlaceToRef(this.globalRotation, control.motion.position, this.position);
      rotateEffectVectorToRef(this.globalRotation, control.motion.velocity, this.velocity);
    }
    for (let axis = 0; axis < 3; axis++) {
      const position = this.hasParent ? control.motion.position[axis] : this.position[axis];
      this.position[axis] = Math.fround(position + this.origin[axis]);
      if (this.hasParent) this.velocity[axis] = control.motion.velocity[axis];
      this.angles[axis] = control.angles[axis];
      this.scale[axis] = control.scale[axis];
    }
  }

  private initializeOrbit(control: EffectModelControl): void {
    if (control.orbit.angularRate === 0) {
      for (let axis = 0; axis < 3; axis++) this.orbitOffset[axis] = 0;
    } else {
      effectOrbitOffsetToRef(control.orbit, control.baseStart, control.baseStart, this.orbitOffset);
    }
  }
}
