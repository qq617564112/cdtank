export interface RoleFreeFireRequest {x: number; y: number; z: number; seconds: number}
export interface RoleFireVector {x: number; y: number; z: number}

/** Original4289e7–428a38 stores each product as float32 before adding position. */
export function createRoleFreeAim(position: RoleFireVector, direction: RoleFireVector,
  currentSeconds: number): RoleFreeFireRequest {
  const coordinate = (origin: number, component: number) =>
    Math.fround(Math.fround(origin) + Math.fround(Math.fround(component) * 1000));
  return {x: coordinate(position.x, direction.x), y: coordinate(position.y, direction.y),
    z: coordinate(position.z, direction.z), seconds: Math.fround(currentSeconds)};
}
