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
    const f = Math.fround;
    const elapsed = this.elapsed + f(deltaSeconds);
    this.elapsed = f(elapsed);
    if (elapsed > this.duration) {
      this.active = false;
      this.elapsed = 0;
    }
    const amplitude = f((1 - this.elapsed / this.duration) * this.strength);
    const sample = (): number => f(random() * 2 * f(3.0518509447574615e-5) - 1);
    const horizontal = sample(), vertical = sample();
    const right = pose.right.map(value => f(f(value) * horizontal));
    const up = pose.up.map(value => f(f(value) * vertical));
    const offset = right.map((value, axis) => f((axis === 1 ? f(value + up[axis]) : value + up[axis]) * (amplitude * .5)));
    const key = this.parameter === 0 ? 'target' : 'eye';
    return {...pose, [key]: pose[key].map((value, axis) => f(value + offset[axis])) as EffectVec3};
  }

  clear(): void {this.active = false; this.elapsed = 0;}
}
