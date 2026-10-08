import {gameContent} from '../content/catalog';
/** Three-part tanks151–158 have no separate turret and fire along the hull. */
export function hasFixedTurret(tankId: number | undefined): boolean {
  return tankId !== undefined && (gameContent().tanks.get(tankId)?.runtime.fixedTurret ?? false);
}

export function tankTurretYaw(tankId: number | undefined, pose: {
  yaw: number; bodyYaw?: number; aim: number;
}): number {
  return hasFixedTurret(tankId) ? pose.bodyYaw ?? pose.yaw : pose.yaw + pose.aim;
}
