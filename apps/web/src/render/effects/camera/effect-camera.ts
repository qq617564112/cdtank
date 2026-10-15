import {Camera, Matrix, Vector3} from '@babylonjs/core';
import {effectBillboardCornersToRef} from './effect-billboard';
import type {EffectVec3} from '../common/types';

interface CameraBillboardSpace {
  viewUpdate: number;
  inverse: Matrix;
  input: Vector3;
  center: Vector3;
  world: Vector3;
  nativeCenter: EffectVec3;
}
const billboardSpaces = new WeakMap<Camera, CameraBillboardSpace>();
const BILLBOARD_ORIGIN: EffectVec3 = [0, 0, 0];

export function effectCameraCorners(camera: Camera, nativeCenter: EffectVec3,
  halfSize: EffectVec3, angleDegrees: number, upright = false): [EffectVec3, EffectVec3, EffectVec3, EffectVec3] {
  const result: [EffectVec3, EffectVec3, EffectVec3, EffectVec3] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  effectCameraCornersToRef(camera, nativeCenter, halfSize, angleDegrees, result, upright);
  return result;
}

/**
 * Adapt native XYZ billboards to the current Web camera. Output remains native
 * world XYZ so EffectSpriteMesh performs the established X reflection once.
 * This adapts the Web camera; it does not recreate the old camera controller.
 */
export function effectCameraCornersToRef(camera: Camera, nativeCenter: EffectVec3,
  halfSize: EffectVec3, angleDegrees: number,
  result: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3], upright = false): void {
  if (upright) {
    const eye = camera.globalPosition;
    // Native +Z faces away from the eye to retain the reflected quad winding.
    const yaw = Math.atan2(nativeCenter[0] + eye.x, nativeCenter[2] - eye.z);
    const cosine = Math.cos(yaw), sine = Math.sin(yaw);
    effectBillboardCornersToRef(BILLBOARD_ORIGIN, halfSize, angleDegrees, result);
    for (let index = 0; index < 4; index++) {
      const corner = result[index];
      const x = corner[0], y = corner[1];
      corner[0] = Math.fround(nativeCenter[0] + x * cosine);
      corner[1] = Math.fround(nativeCenter[1] + y);
      corner[2] = Math.fround(nativeCenter[2] - x * sine);
    }
    return;
  }
  const view = camera.getViewMatrix();
  let space = billboardSpaces.get(camera);
  if (!space) {
    space = {viewUpdate: -1, inverse: Matrix.Identity(), input: new Vector3(),
      center: new Vector3(), world: new Vector3(), nativeCenter: [0, 0, 0]};
    billboardSpaces.set(camera, space);
  }
  if (space.viewUpdate !== view.updateFlag) {
    view.invertToRef(space.inverse);
    space.viewUpdate = view.updateFlag;
  }
  space.input.set(-nativeCenter[0], nativeCenter[1], nativeCenter[2]);
  Vector3.TransformCoordinatesToRef(space.input, view, space.center);
  const center = space.center;
  space.nativeCenter[0] = -center.x; space.nativeCenter[1] = center.y; space.nativeCenter[2] = center.z;
  effectBillboardCornersToRef(space.nativeCenter, halfSize, angleDegrees, result);
  for (let index = 0; index < 4; index++) {
    const corner = result[index];
    space.input.set(-corner[0], corner[1], corner[2]);
    Vector3.TransformCoordinatesToRef(space.input, space.inverse, space.world);
    corner[0] = -space.world.x; corner[1] = space.world.y; corner[2] = space.world.z;
  }
}
