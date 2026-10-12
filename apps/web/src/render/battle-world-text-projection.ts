import {Camera, Matrix, Vector3, Viewport} from '@babylonjs/core';
import type {CastleDamageTextProjector} from '../assets/scenes/scene-castle-damage-text';

/** Reproject the captured Babylon world position using the current camera and viewport. */
export function createBattleWorldTextProjector(camera: Camera): CastleDamageTextProjector {
  return (origin, viewport) => {
    const position = new Vector3(...origin);
    const viewZ = Vector3.TransformCoordinates(position, camera.getViewMatrix()).z;
    const depth = camera.getScene().useRightHandedSystem ? -viewZ : viewZ;
    const point = Vector3.Project(position, Matrix.Identity(), camera.getTransformationMatrix(),
      new Viewport(0, 0, viewport.width, viewport.height));
    return {x: Math.trunc(point.x), y: Math.trunc(point.y), depth,
      visible: depth >= camera.minZ && depth <= camera.maxZ};
  };
}
