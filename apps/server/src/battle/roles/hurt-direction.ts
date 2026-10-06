export interface HurtLook {x: number; y: number; z: number;}

/** Original435745 compares victim and attacking role look vectors (+274), not projectile travel. */
export function roleHurtSelector(victim: HurtLook, attacker: HurtLook): number | undefined {
  const vx = Math.fround(victim.x), vz = Math.fround(victim.z);
  const ax = Math.fround(attacker.x), az = Math.fround(attacker.z);
  //4059de uses x87 double products and CRT acos, with no intermediate float stores.
  const dot = vx * ax + vz * az;
  // The original CRT error path below -1 has not been recovered in the Web runtime.
  if (dot < -1) return undefined;
  const angle = dot > 1 ? 0 : Math.acos(dot);
  if (angle < 0.7853981852531433) return 2;
  if (angle < 2.356194496154785) return vx * az - ax * vz > 0 ? 3 : 4;
  return 1;
}
