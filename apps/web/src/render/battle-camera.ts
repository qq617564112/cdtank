import {ArcRotateCamera, Camera, Vector3} from '@babylonjs/core';

/** Config/ClientRender.ini, ThirdPersonCamera; original45654d/456674. */
export const BATTLE_CAMERA_SOURCE = {
  distance: 174, altitude: Math.fround(0.17056541), azimuth: 0,
  offset: [0, 35, 60] as const, fovDegrees: 60, near: 10, far: 5000,
  degreesToRadians: Math.fround(0.01745),
};
const f = Math.fround;
type Vec3 = readonly [number, number, number];
function rotateY(v: Vec3, angle: number): Vec3 {
  const c = f(Math.cos(angle)), s = f(Math.sin(angle));
  return [f(v[0] * c + v[2] * s), v[1], f(v[2] * c - v[0] * s)];
}
function normalize(v: Vec3): Vec3 {
  const length = f(Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]));
  return v.map(value => f(value / length)) as unknown as Vec3;
}
/** Original46903d..469100 derives camera heading from actor forward, not turret aim. */
export function originalActorCameraHeading(bodyYaw: number): number {
  const x = f(Math.sin(bodyYaw)), z = f(Math.cos(bodyYaw));
  let angle = f(Math.acos(Math.max(-1, Math.min(1, z))));
  if (x < 0) angle = f(f(6.28318) - angle);
  return f(angle * f(57.295780181884766));
}
/** Actor virtual+14 supplies degrees; +1c supplies the rendered world position. */
export function originalBattleCameraPose(position: Vec3, actorYawDegrees: number): {
  eye: Vec3; target: Vec3; up: Vec3;
} {
  const source = BATTLE_CAMERA_SOURCE;
  const yaw = f(f(actorYawDegrees) * source.degreesToRadians);
  const azimuth = f(f(f(actorYawDegrees) + 180) * source.degreesToRadians + source.azimuth);
  const offset = rotateY(source.offset, yaw);
  const target = position.map((value, index) => f(f(value) + offset[index])) as unknown as Vec3;
  const horizontal = rotateY([0, 0, source.distance], azimuth);
  const pitchAxis = normalize([-horizontal[2], 0, horizontal[0]]);
  const c = f(Math.cos(source.altitude)), s = f(Math.sin(source.altitude));
  // Original57454b rotates the offset about cross(offset, world-up).
  const orbit: Vec3 = [f(horizontal[0] * c),
    f((pitchAxis[2] * horizontal[0] - pitchAxis[0] * horizontal[2]) * s), f(horizontal[2] * c)];
  const forward = normalize(orbit.map(value => -value) as unknown as Vec3);
  const right = normalize(rotateY([1, 0, 0], azimuth));
  const up = normalize([f(right[1] * forward[2] - right[2] * forward[1]),
    f(right[2] * forward[0] - right[0] * forward[2]), f(right[0] * forward[1] - right[1] * forward[0])]);
  const eye = target.map((value, index) => f(value + orbit[index])) as unknown as Vec3;
  return {eye, target, up};
}

/** The battle camera follows the role; no Babylon pointer/keyboard orbit inputs. */
export function configureBattleCamera(camera: ArcRotateCamera): void {
  camera.detachControl();
  camera.inputs.clear();
  camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
  camera.inertialPanningX = camera.inertialPanningY = 0;
  camera.lowerRadiusLimit = camera.upperRadiusLimit = null;
  camera.lowerAlphaLimit = camera.upperAlphaLimit = null;
  camera.lowerBetaLimit = camera.upperBetaLimit = null;
  camera.minZ = BATTLE_CAMERA_SOURCE.near;
  camera.maxZ = BATTLE_CAMERA_SOURCE.far;
  camera.fov = BATTLE_CAMERA_SOURCE.fovDegrees * Math.PI / 180;
  camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
}

export function followBattleCamera(camera: ArcRotateCamera, webPosition: Vector3, turretYaw: number): void {
  const actorDegrees = originalActorCameraHeading(turretYaw);
  const pose = originalBattleCameraPose([-webPosition.x, webPosition.y, webPosition.z], actorDegrees);
  camera.upVector = new Vector3(-pose.up[0], pose.up[1], pose.up[2]);
  camera.setTarget(new Vector3(-pose.target[0], pose.target[1], pose.target[2]), false, true, true);
  camera.setPosition(new Vector3(-pose.eye[0], pose.eye[1], pose.eye[2]));
}

/** Circle the wreck at 30 degrees per second while the death action plays. */
export function orbitWreckCamera(camera: ArcRotateCamera, webPosition: Vector3,
  turretYaw: number, elapsedSeconds: number): void {
  const heading = originalActorCameraHeading(turretYaw) + elapsedSeconds * 30;
  const pose = originalBattleCameraPose([-webPosition.x, webPosition.y, webPosition.z], heading);
  const target = webPosition.add(new Vector3(0, BATTLE_CAMERA_SOURCE.offset[1], 0));
  camera.upVector = new Vector3(-pose.up[0], pose.up[1], pose.up[2]);
  camera.setTarget(target, false, true, true);
  camera.setPosition(target.add(new Vector3(
    -(pose.eye[0] - pose.target[0]), pose.eye[1] - pose.target[1], pose.eye[2] - pose.target[2])));
}
