import {Camera, Matrix, Vector3, Viewport} from '@babylonjs/core';
import type {CastleDamageTextProjector} from '../assets/scenes/scene-castle-damage-text';

/** Reproject the captured Babylon world position using the current camera and viewport. */
export function createBattleWorldTextProjector(camera: Camera): CastleDamageTextProjector {
  const position = new Vector3(), viewPosition = new Vector3(), point = new Vector3();
  const identity = Matrix.Identity(), screen = new Viewport(0, 0, 0, 0);
  const result = {x: 0, y: 0, depth: 0, visible: false};
  return (origin, viewport) => {
    position.set(origin[0], origin[1], origin[2]);
    Vector3.TransformCoordinatesToRef(position, camera.getViewMatrix(), viewPosition);
    const viewZ = viewPosition.z;
    const depth = camera.getScene().useRightHandedSystem ? -viewZ : viewZ;
    screen.width = viewport.width; screen.height = viewport.height;
    Vector3.ProjectToRef(position, identity, camera.getTransformationMatrix(), screen, point);
    result.x = Math.trunc(point.x); result.y = Math.trunc(point.y); result.depth = depth;
    result.visible = depth >= camera.minZ && depth <= camera.maxZ;
    return result;
  };
}
