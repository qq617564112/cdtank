import type {EffectVec3} from '../../render/effects/common/types';

/** Original +0x368 pivot compensation, 0x46cb49–0x46cc19. Native degrees/XYZ. */
export function effectTurretPivotCorrection(pivot: readonly [number, number], yaw: number,
  turretYaw: number, up: EffectVec3): EffectVec3 {
  const result: EffectVec3 = [0, 0, 0];
  effectTurretPivotCorrectionToRef(pivot, yaw, turretYaw, up, result);
  return result;
}

export function effectTurretPivotCorrectionToRef(pivot: readonly [number, number], yaw: number,
  turretYaw: number, up: EffectVec3, result: EffectVec3): void {
  const relative = Math.fround(Math.fround(turretYaw) - Math.fround(yaw));
  const halfAngle = relative * Math.fround(.01745329238474369) * .5;
  const qy = Math.fround(Math.sin(Math.fround(halfAngle)));
  const qw = Math.fround(Math.cos(halfAngle));
  const cosine = Math.fround(1 - Math.fround(2 * qy * qy));
  const sine = Math.fround(2 * qy * qw);
  const px = Math.fround(pivot[0]), pz = Math.fround(pivot[1]);
  const x = -Math.fround(Math.fround(px * cosine + pz * sine) - px);
  const z = -Math.fround(Math.fround(-px * sine + pz * cosine) - pz);
  // EXE axis rotation uses 0.01745, distinct from gbengine's degree constant.
  const radians = Math.fround(Math.fround(yaw) * Math.fround(.01744999922811985));
  const c = Math.fround(Math.cos(radians)), s = Math.fround(Math.sin(radians));
  const ax = Math.fround(up[0]), ay = Math.fround(up[1]), az = Math.fround(up[2]);
  const t = 1 - c;
  const xy = Math.fround(t * ay * ax), sz = Math.fround(s * az);
  const tz = t * az, xz = tz * ax, sy = s * ay;
  const yz = tz * ay, sx = s * ax;
  result[0] = Math.fround((t * ax * ax + c) * x + (xz + sy) * z);
  result[1] = Math.fround((sz + xy) * x + (yz - sx) * z);
  result[2] = Math.fround((xz - sy) * x + (t * az * az + c) * z);
}
