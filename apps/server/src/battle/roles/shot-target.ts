import {createRoleFreeAim, type RoleFireVector} from './free-aim';

export type ShotTarget = {kind: 'FREE'; point: RoleFireVector}
  | {kind: 'PLAYER'; targetId: string}
  | {kind: 'SCENE'; targetId: string; point: RoleFireVector};

/** Original423ff1 stores squared length as f32 before CRT sqrt. */
function roleDistance(position: RoleFireVector, target: RoleFireVector): number {
  const x = Math.fround(Math.fround(target.x) - Math.fround(position.x));
  const y = Math.fround(Math.fround(target.y) - Math.fround(position.y));
  const z = Math.fround(Math.fround(target.z) - Math.fround(position.z));
  const squared = Math.fround(x * x + y * y + z * z);
  const epsilon = Math.fround(0.0001);
  if (Math.abs(squared) < epsilon) return 0;
  if (Math.abs(Math.fround(squared - 1)) < epsilon) return 1;
  return Math.sqrt(squared);
}

/** Original4288fe chooses the scene on equal distance and displays its endpoint at Y25. */
export function selectShotTarget(position: RoleFireVector, look: RoleFireVector,
  player: {id: string; position: RoleFireVector} | undefined,
  scene: {id: string; distance: number} | undefined, range = 1000): ShotTarget {
  if (scene && (!player || roleDistance(position, player.position) >= Math.fround(scene.distance))) {
    const coordinate = (origin: number, direction: number) =>
      Math.fround(Math.fround(origin) + Math.fround(Math.fround(direction) * Math.fround(scene.distance)));
    return {kind: 'SCENE', targetId: scene.id,
      point: {x: coordinate(position.x, look.x), y: 25, z: coordinate(position.z, look.z)}};
  }
  if (player) return {kind: 'PLAYER', targetId: player.id};
  const rangeScale = Math.fround(range * 0.001);
  const queryLook = range === 1000 ? look : {x: Math.fround(look.x * rangeScale),
    y: Math.fround(look.y * rangeScale), z: Math.fround(look.z * rangeScale)};
  const {x, y, z} = createRoleFreeAim(position, queryLook, 0);
  return {kind: 'FREE', point: {x, y, z}};
}
