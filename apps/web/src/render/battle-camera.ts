import {ArcRotateCamera, Camera, Matrix, Vector3} from '@babylonjs/core';

/** Config/ClientRender.ini, ThirdPersonCamera; original45654d/456674. */
export const BATTLE_CAMERA_SOURCE = {
  distance: 174, altitude: Math.fround(0.17056541), azimuth: 0,
  offset: [0, 35, 60] as const, fovDegrees: 60, near: 10, far: 5000,
  degreesToRadians: Math.fround(0.01745),
};
const f = Math.fround;
type Vec3 = readonly [number, number, number];
interface CameraPose {
  eye: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
}
function createCameraPose(): CameraPose {
  return {eye: [0, 0, 0], target: [0, 0, 0], up: [0, 0, 0]};
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
  const pose = createCameraPose();
  writeOriginalBattleCameraPose(position, actorYawDegrees, pose);
  return pose;
}

function writeOriginalBattleCameraPose(position: Vec3, actorYawDegrees: number, pose: CameraPose): void {
  const source = BATTLE_CAMERA_SOURCE;
  const yaw = f(f(actorYawDegrees) * source.degreesToRadians);
  const azimuth = f(f(f(actorYawDegrees) + 180) * source.degreesToRadians + source.azimuth);
  const yawCos = f(Math.cos(yaw)), yawSin = f(Math.sin(yaw));
  const azimuthCos = f(Math.cos(azimuth)), azimuthSin = f(Math.sin(azimuth));
  const offsetX = f(source.offset[0] * yawCos + source.offset[2] * yawSin);
  const offsetZ = f(source.offset[2] * yawCos - source.offset[0] * yawSin);
  pose.target[0] = f(f(position[0]) + offsetX);
  pose.target[1] = f(f(position[1]) + source.offset[1]);
  pose.target[2] = f(f(position[2]) + offsetZ);
  const horizontalX = f(0 * azimuthCos + source.distance * azimuthSin);
  const horizontalZ = f(source.distance * azimuthCos - 0 * azimuthSin);
  const axisX = -horizontalZ, axisZ = horizontalX;
  const axisLength = f(Math.sqrt(axisX * axisX + 0 * 0 + axisZ * axisZ));
  const pitchAxisX = f(axisX / axisLength), pitchAxisZ = f(axisZ / axisLength);
  const c = f(Math.cos(source.altitude)), s = f(Math.sin(source.altitude));
  // Original57454b rotates the offset about cross(offset, world-up).
  const orbitX = f(horizontalX * c);
  const orbitY = f((pitchAxisZ * horizontalX - pitchAxisX * horizontalZ) * s);
  const orbitZ = f(horizontalZ * c);
  const forwardX = -orbitX, forwardY = -orbitY, forwardZ = -orbitZ;
  const forwardLength = f(Math.sqrt(forwardX * forwardX + forwardY * forwardY + forwardZ * forwardZ));
  const normalizedForwardX = f(forwardX / forwardLength);
  const normalizedForwardY = f(forwardY / forwardLength);
  const normalizedForwardZ = f(forwardZ / forwardLength);
  const rightX = f(1 * azimuthCos + 0 * azimuthSin);
  const rightZ = f(0 * azimuthCos - 1 * azimuthSin);
  const rightLength = f(Math.sqrt(rightX * rightX + 0 * 0 + rightZ * rightZ));
  const normalizedRightX = f(rightX / rightLength), normalizedRightY = f(0 / rightLength);
  const normalizedRightZ = f(rightZ / rightLength);
  const upX = f(normalizedRightY * normalizedForwardZ - normalizedRightZ * normalizedForwardY);
  const upY = f(normalizedRightZ * normalizedForwardX - normalizedRightX * normalizedForwardZ);
  const upZ = f(normalizedRightX * normalizedForwardY - normalizedRightY * normalizedForwardX);
  const upLength = f(Math.sqrt(upX * upX + upY * upY + upZ * upZ));
  pose.up[0] = f(upX / upLength);
  pose.up[1] = f(upY / upLength);
  pose.up[2] = f(upZ / upLength);
  pose.eye[0] = f(pose.target[0] + orbitX);
  pose.eye[1] = f(pose.target[1] + orbitY);
  pose.eye[2] = f(pose.target[2] + orbitZ);
}

interface BattleCameraWorkspace {
  up: Vector3;
  target: Vector3;
  eye: Vector3;
  position: Vector3;
  transform: Matrix;
  sourcePosition: [number, number, number];
  sourcePose: CameraPose;
}
const cameraWorkspaces = new WeakMap<ArcRotateCamera, BattleCameraWorkspace>();
function cameraWorkspace(camera: ArcRotateCamera): BattleCameraWorkspace {
  let workspace = cameraWorkspaces.get(camera);
  if (!workspace) {
    workspace = {up: new Vector3(), target: new Vector3(), eye: new Vector3(),
      position: new Vector3(), transform: Matrix.Identity(),
      sourcePosition: [0, 0, 0], sourcePose: createCameraPose()};
    cameraWorkspaces.set(camera, workspace);
  }
  return workspace;
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
  const workspace = cameraWorkspace(camera);
  const actorDegrees = originalActorCameraHeading(turretYaw);
  const position = workspace.sourcePosition;
  position[0] = -webPosition.x; position[1] = webPosition.y; position[2] = webPosition.z;
  writeOriginalBattleCameraPose(position, actorDegrees, workspace.sourcePose);
  const pose = workspace.sourcePose;
  workspace.up.set(-pose.up[0], pose.up[1], pose.up[2]);
  camera.upVector = workspace.up;
  workspace.target.set(-pose.target[0], pose.target[1], pose.target[2]);
  camera.setTarget(workspace.target, false, true, true);
  workspace.eye.set(-pose.eye[0], pose.eye[1], pose.eye[2]);
  camera.setPosition(workspace.eye);
}

const turretCameraPose = originalBattleCameraPose([0, 0, 0], 0);
const turretCameraUp = new Vector3(-turretCameraPose.up[0], turretCameraPose.up[1], turretCameraPose.up[2]);
const turretCameraTarget = new Vector3(-turretCameraPose.target[0], turretCameraPose.target[1], turretCameraPose.target[2]);
const turretCameraEye = new Vector3(-turretCameraPose.eye[0], turretCameraPose.eye[1], turretCameraPose.eye[2]);

/** Follow the rendered turret pivot and orientation, including the hull's slope. */
export function followRenderedTurretCamera(camera: ArcRotateCamera, turretWorldMatrix: Matrix): void {
  const workspace = cameraWorkspace(camera);
  Vector3.TransformNormalToRef(turretCameraUp, turretWorldMatrix, workspace.up);
  workspace.up.normalize();
  camera.upVector = workspace.up;
  Vector3.TransformCoordinatesToRef(turretCameraTarget, turretWorldMatrix, workspace.target);
  camera.setTarget(workspace.target, false, true, true);
  Vector3.TransformCoordinatesToRef(turretCameraEye, turretWorldMatrix, workspace.eye);
  camera.setPosition(workspace.eye);
}

/** Mobile heading belongs to camera/turret input and does not inherit hull rotation. */
export function followMobileBattleCamera(camera: ArcRotateCamera, turretWorldMatrix: Matrix, yaw: number): void {
  const workspace = cameraWorkspace(camera);
  turretWorldMatrix.getTranslationToRef(workspace.position);
  Matrix.RotationYToRef(-yaw, workspace.transform);
  workspace.transform.setTranslation(workspace.position);
  followRenderedTurretCamera(camera, workspace.transform);
}

/** Circle the wreck at 30 degrees per second while the death action plays. */
export function orbitWreckCamera(camera: ArcRotateCamera, webPosition: Vector3,
  turretYaw: number, elapsedSeconds: number): void {
  const workspace = cameraWorkspace(camera);
  const heading = originalActorCameraHeading(turretYaw) + elapsedSeconds * 30;
  const position = workspace.sourcePosition;
  position[0] = -webPosition.x; position[1] = webPosition.y; position[2] = webPosition.z;
  writeOriginalBattleCameraPose(position, heading, workspace.sourcePose);
  const pose = workspace.sourcePose;
  workspace.up.set(-pose.up[0], pose.up[1], pose.up[2]);
  workspace.target.set(webPosition.x + 0, webPosition.y + BATTLE_CAMERA_SOURCE.offset[1], webPosition.z + 0);
  camera.upVector = workspace.up;
  camera.setTarget(workspace.target, false, true, true);
  workspace.eye.set(workspace.target.x + -(pose.eye[0] - pose.target[0]),
    workspace.target.y + (pose.eye[1] - pose.target[1]), workspace.target.z + (pose.eye[2] - pose.target[2]));
  camera.setPosition(workspace.eye);
}
