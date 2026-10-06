import {createRoleObbFromPose} from './movement-obb-prediction';
import {intersectsOriginalObb, type RoleObb} from './obb-intersection';
import type {RoleMovementPose} from './movement-math';

export interface TankBody {
  id: string | number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  bodyYaw?: number;
}

const direction = (yaw: number) => ({x: Math.fround(Math.sin(yaw)), y: 0, z: Math.fround(Math.cos(yaw))});

export function tankBodyPose(tank: Pick<TankBody, 'x' | 'y' | 'z' | 'yaw' | 'bodyYaw'>): RoleMovementPose {
  return {position: {x: tank.x, y: tank.y, z: tank.z},
    look: direction(tank.yaw), forward: direction(tank.bodyYaw ?? tank.yaw)};
}

/** Every living tank occupies its body, independently of its movement sources. */
export function tankObstacles(id: TankBody['id'], tanks: Iterable<TankBody>): RoleObb[] {
  return [...tanks].filter(tank => tank.alive && tank.id !== id)
    .map(tank => createRoleObbFromPose(tankBodyPose(tank)));
}

export function overlapsTankPose(pose: RoleMovementPose, obstacles: readonly RoleObb[]): boolean {
  const box = createRoleObbFromPose(pose);
  return obstacles.some(other => intersectsOriginalObb(box, other));
}

const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Sweep translation and body rotation, stopping at the last unoccupied pose. */
export function constrainTankPose(start: RoleMovementPose, end: RoleMovementPose,
  obstacles: readonly RoleObb[]): RoleMovementPose {
  if (!obstacles.length) return end;
  const firstBody = Math.atan2(start.forward.x, start.forward.z);
  const bodyTurn = angleDelta(firstBody, Math.atan2(end.forward.x, end.forward.z));
  const firstLook = Math.atan2(start.look.x, start.look.z);
  const lookTurn = angleDelta(firstLook, Math.atan2(end.look.x, end.look.z));
  const distance = Math.hypot(end.position.x - start.position.x,
    end.position.y - start.position.y, end.position.z - start.position.z);
  const steps = Math.max(1, Math.ceil(distance / 6), Math.ceil(Math.abs(bodyTurn) / (Math.PI / 36)));
  const at = (fraction: number): RoleMovementPose => ({
    position: {x: start.position.x + (end.position.x - start.position.x) * fraction,
      y: start.position.y + (end.position.y - start.position.y) * fraction,
      z: start.position.z + (end.position.z - start.position.z) * fraction},
    forward: direction(firstBody + bodyTurn * fraction),
    look: direction(firstLook + lookTurn * fraction),
  });
  let previous = 0;
  for (let step = 1; step <= steps; step++) {
    const fraction = step / steps;
    if (overlapsTankPose(at(fraction), obstacles)) {
      let low = previous, high = fraction;
      for (let iteration = 0; iteration < 10; iteration++) {
        const middle = (low + high) / 2;
        if (overlapsTankPose(at(middle), obstacles)) high = middle;
        else low = middle;
      }
      return low === 0 ? start : at(low);
    }
    previous = fraction;
  }
  return end;
}
