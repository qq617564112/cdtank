import {Camera, Matrix, Observer, TargetCamera, Vector3} from '@babylonjs/core';
import {EffectCameraPose, EffectCameraShakeState} from './effect-camera-shake';

/** Apply original native eye/target offsets to the Web camera's current base view. */
export class EffectCameraShakeView {
  readonly state = new EffectCameraShakeState();
  private pose?: EffectCameraPose;
  private readonly observer: Observer<Camera>;
  private readonly inverse = Matrix.Identity();
  private readonly basePose: EffectCameraPose = {eye: [0, 0, 0], target: [0, 0, 0],
    right: [0, 0, 0], up: [0, 0, 0]};
  private readonly shakenPose: EffectCameraPose = {eye: [0, 0, 0], target: [0, 0, 0],
    right: [0, 0, 0], up: [0, 0, 0]};
  private readonly webEye = new Vector3();
  private readonly webTarget = new Vector3();
  private readonly webUp = new Vector3();

  constructor(private readonly camera: Camera, private readonly random: () => number) {
    this.observer = camera.onViewMatrixChangedObservable.add(() => {
      if (!this.pose) return;
      const view = camera.getViewMatrix();
      const pose = this.pose;
      this.webUp.set(-pose.up[0], pose.up[1], pose.up[2]);
      this.webEye.set(-pose.eye[0], pose.eye[1], pose.eye[2]);
      this.webTarget.set(-pose.target[0], pose.target[1], pose.target[2]);
      if (camera.getScene().useRightHandedSystem) Matrix.LookAtRHToRef(this.webEye, this.webTarget, this.webUp, view);
      else Matrix.LookAtLHToRef(this.webEye, this.webTarget, this.webUp, view);
    });
  }

  activate(parameter: number, duration: number, strength: number): void {
    this.clear();
    this.state.activate(parameter, duration, strength);
  }

  /** Original camera update precedes effect-manager update, sharing its random stream. */
  update(deltaSeconds: number): void {
    const force = this.state.active || this.pose !== undefined;
    this.pose = undefined;
    const base = this.camera.getViewMatrix(force);
    if (!this.state.active) return;
    base.invertToRef(this.inverse);
    const inverse = this.inverse.m;
    const pose = this.basePose;
    const target = this.camera instanceof TargetCamera ? this.camera.getTarget() :
      this.camera.getForwardRay().origin.add(this.camera.getForwardRay().direction);
    for (let axis = 0; axis < 3; axis++) {
      const sign = axis === 0 ? -1 : 1;
      pose.eye[axis] = Math.fround(sign * inverse[12 + axis]);
      pose.right[axis] = Math.fround(sign * inverse[axis]);
      pose.up[axis] = Math.fround(sign * inverse[4 + axis]);
    }
    pose.target[0] = Math.fround(-target.x);
    pose.target[1] = Math.fround(target.y);
    pose.target[2] = Math.fround(target.z);
    this.state.updateToRef(deltaSeconds, pose, this.random, this.shakenPose);
    this.pose = this.shakenPose;
    this.camera.getViewMatrix(true);
  }

  clear(): void {
    this.state.clear();
    this.pose = undefined;
    this.camera.getViewMatrix(true);
  }

  dispose(): void {this.clear(); this.camera.onViewMatrixChangedObservable.remove(this.observer);}
}
