import type {Camera} from '@babylonjs/core';
import {Vector3} from '@babylonjs/core';

interface Position {x: number; y: number; z: number;}
const poses = new WeakMap<AudioListener, number[]>();

/** Shared contexts receive one listener pose, without repeating unchanged audio writes. */
export function setSpatialListener(listener: AudioListener, position: Position, forward: Position, up: Position): void {
  const values = [position.x, position.y, position.z, forward.x, forward.y, forward.z, up.x, up.y, up.z];
  const previous = poses.get(listener);
  if (!previous || values.slice(0, 3).some((value, index) => value !== previous[index])) {
    listener.setPosition(position.x, position.y, position.z);
  }
  if (!previous || values.slice(3).some((value, index) => value !== previous[index + 3])) {
    listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
  poses.set(listener, values);
}

export function setCameraSpatialListener(listener: AudioListener, camera: Camera): void {
  const position = camera.globalPosition;
  const forward = camera.getForwardRay().direction;
  const up = camera.getDirection(Vector3.Up());
  setSpatialListener(listener, {x: -position.x, y: position.y, z: position.z},
    {x: -forward.x, y: forward.y, z: forward.z}, {x: -up.x, y: up.y, z: up.z});
}
