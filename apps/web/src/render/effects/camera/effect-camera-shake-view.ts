import {Camera, Matrix, Observer, TargetCamera, Vector3} from '@babylonjs/core';
import {EffectCameraPose, EffectCameraShakeState} from './effect-camera-shake';
import {EffectVec3} from '../common/types';

/** Apply original native eye/target offsets to the Web camera's current base view. */
export class EffectCameraShakeView {
  readonly state = new EffectCameraShakeState();
  private pose?: EffectCameraPose;
  private readonly observer: Observer<Camera>;

  constructor(private readonly camera: Camera, private readonly random: () => number) {
    this.observer = camera.onViewMatrixChangedObservable.add(() => {
      if (!this.pose) return;
      const web = (value: EffectVec3): Vector3 => new Vector3(-value[0], value[1], value[2]);
      const view = camera.getViewMatrix();
      const up = web(this.pose.up);
      if (camera.getScene().useRightHandedSystem) Matrix.LookAtRHToRef(web(this.pose.eye), web(this.pose.target), up, view);
      else Matrix.LookAtLHToRef(web(this.pose.eye), web(this.pose.target), up, view);
    });
  }

  activate(parameter: number, duration: number, strength: number): void {
    this.clear();
    this.state.activate(parameter, duration, strength);
  }

  /** Original camera update precedes effect-manager update, sharing its random stream. */
  update(deltaSeconds: number): void {
    this.pose = undefined;
    const base = this.camera.getViewMatrix(true);
    const inverse = Matrix.Invert(base).m;
    const native = (value: Vector3): EffectVec3 => [-value.x, value.y, value.z].map(Math.fround) as EffectVec3;
    const eye: EffectVec3 = [-inverse[12], inverse[13], inverse[14]].map(Math.fround) as EffectVec3;
    const target = this.camera instanceof TargetCamera ? native(this.camera.getTarget()) :
      native(this.camera.getForwardRay().origin.add(this.camera.getForwardRay().direction));
    const pose: EffectCameraPose = {eye, target,
      right: [-inverse[0], inverse[1], inverse[2]].map(Math.fround) as EffectVec3,
      up: [-inverse[4], inverse[5], inverse[6]].map(Math.fround) as EffectVec3};
    const result = this.state.update(deltaSeconds, pose, this.random);
    if (result !== pose) {
      this.pose = result;
      this.camera.getViewMatrix(true);
    }
  }

  clear(): void {
    this.state.clear();
    this.pose = undefined;
    this.camera.getViewMatrix(true);
  }

  dispose(): void {this.clear(); this.camera.onViewMatrixChangedObservable.remove(this.observer);}
}
