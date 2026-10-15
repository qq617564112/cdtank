import type {Camera} from '@babylonjs/core';
import {Ray, Vector3} from '@babylonjs/core';

interface Position {x: number; y: number; z: number;}
interface SpatialPose {position: Position; forward: Position; up: Position;}
interface CameraPose {ray: Ray; up: Vector3; position: Vector3; forward: Vector3;}
const poses = new WeakMap<AudioListener, number[]>();
const cameraPoses = new WeakMap<Camera, CameraPose>();

/** Shared contexts receive one listener pose, without repeating unchanged audio writes. */
export function setSpatialListener(listener: AudioListener, position: Position, forward: Position, up: Position): void {
  const previous = poses.get(listener);
  if (!previous || position.x !== previous[0] || position.y !== previous[1] || position.z !== previous[2]) {
    listener.setPosition(position.x, position.y, position.z);
  }
  if (!previous || forward.x !== previous[3] || forward.y !== previous[4] || forward.z !== previous[5]
      || up.x !== previous[6] || up.y !== previous[7] || up.z !== previous[8]) {
    listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
  const values = previous ?? [];
  values[0] = position.x; values[1] = position.y; values[2] = position.z;
  values[3] = forward.x; values[4] = forward.y; values[5] = forward.z;
  values[6] = up.x; values[7] = up.y; values[8] = up.z;
  if (!previous) poses.set(listener, values);
}

/** Borrowed native pose; consume synchronously before reading this camera again. */
export function cameraSpatialPose(camera: Camera): SpatialPose {
  const position = camera.globalPosition;
  let pose = cameraPoses.get(camera);
  if (!pose) {
    const ray = new Ray(Vector3.Zero(), Vector3.Zero());
    pose = {ray, up: Vector3.Zero(), position: Vector3.Zero(), forward: ray.direction};
    cameraPoses.set(camera, pose);
  }
  camera.getForwardRayToRef(pose.ray);
  camera.getDirectionToRef(Vector3.UpReadOnly, pose.up);
  pose.position.set(-position.x, position.y, position.z);
  pose.ray.direction.x = -pose.ray.direction.x;
  pose.up.x = -pose.up.x;
  return pose;
}

export function setCameraSpatialListener(listener: AudioListener, camera: Camera): void {
  const pose = cameraSpatialPose(camera);
  setSpatialListener(listener, pose.position, pose.forward, pose.up);
}
