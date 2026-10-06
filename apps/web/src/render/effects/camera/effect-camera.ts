import {Camera, Matrix, Vector3} from '@babylonjs/core';
import {effectBillboardCorners} from './effect-billboard';
import type {EffectVec3} from '../common/types';

/**
 * Adapt native XYZ billboards to the current Web camera. Output remains native
 * world XYZ so EffectSpriteMesh performs the established X reflection once.
 * This adapts the Web camera; it does not recreate the old camera controller.
 */
export function effectCameraCorners(camera: Camera, nativeCenter: EffectVec3,
  halfSize: EffectVec3, angleDegrees: number): [EffectVec3, EffectVec3, EffectVec3, EffectVec3] {
  const view = camera.getViewMatrix();
  const inverse = Matrix.Invert(view);
  const webCenter = new Vector3(-nativeCenter[0], nativeCenter[1], nativeCenter[2]);
  const center = Vector3.TransformCoordinates(webCenter, view);
  const cameraCorners = effectBillboardCorners([-center.x, center.y, center.z], halfSize, angleDegrees);
  return cameraCorners.map(corner => {
    const world = Vector3.TransformCoordinates(new Vector3(-corner[0], corner[1], corner[2]), inverse);
    return [-world.x, world.y, world.z] as EffectVec3;
  }) as [EffectVec3, EffectVec3, EffectVec3, EffectVec3];
}
