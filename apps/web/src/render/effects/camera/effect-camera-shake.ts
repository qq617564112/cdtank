import {EffectVec3} from '../common/types';

export interface EffectCameraPose {eye: EffectVec3; target: EffectVec3; right: EffectVec3; up: EffectVec3;}

/** Original camera 0x4556e2 activation and 0x4558f2–0x455a3c shake after base update. */
export class EffectCameraShakeState {
  active = false;
  elapsed = 0;
  parameter = 1;
  private duration = 0;
  private strength = 0;

  activate(parameter: number, duration: number, strength: number): void {
    this.clear();
    this.parameter = parameter === 0 ? 0 : 1;
    this.duration = Math.fround(duration);
    this.strength = Math.fround(strength);
    this.active = true;
  }

  update(deltaSeconds: number, pose: EffectCameraPose, random: () => number): EffectCameraPose {
    if (!this.active) return pose;
    const key = this.parameter === 0 ? 'target' : 'eye';
    const result = {...pose, [key]: [...pose[key]] as EffectVec3};
    this.updateToRef(deltaSeconds, pose, random, result);
    return result;
  }

  /** Keep the original samples and rounding while writing caller-owned vectors. */
  updateToRef(deltaSeconds: number, pose: EffectCameraPose, random: () => number,
    result: EffectCameraPose): void {
    if (!this.active) {
      for (let axis = 0; axis < 3; axis++) {
        result.eye[axis] = pose.eye[axis]; result.target[axis] = pose.target[axis];
        result.right[axis] = pose.right[axis]; result.up[axis] = pose.up[axis];
      }
      return;
    }
    const f = Math.fround;
    const elapsed = this.elapsed + f(deltaSeconds);
    this.elapsed = f(elapsed);
    if (elapsed > this.duration) {
      this.active = false;
      this.elapsed = 0;
    }
    const amplitude = f((1 - this.elapsed / this.duration) * this.strength);
    const horizontal = f(random() * 2 * f(3.0518509447574615e-5) - 1);
    const vertical = f(random() * 2 * f(3.0518509447574615e-5) - 1);
    const key = this.parameter === 0 ? 'target' : 'eye';
    for (let axis = 0; axis < 3; axis++) {
      const right = f(f(pose.right[axis]) * horizontal);
      const up = f(f(pose.up[axis]) * vertical);
      const offset = f((axis === 1 ? f(right + up) : right + up) * (amplitude * .5));
      result.eye[axis] = key === 'eye' ? f(pose.eye[axis] + offset) : pose.eye[axis];
      result.target[axis] = key === 'target' ? f(pose.target[axis] + offset) : pose.target[axis];
      result.right[axis] = pose.right[axis]; result.up[axis] = pose.up[axis];
    }
  }

  clear(): void {this.active = false; this.elapsed = 0;}
}
