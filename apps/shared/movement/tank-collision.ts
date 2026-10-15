import {createRoleObbFromPose, createRoleObbFromPoseToRef} from './movement-obb-prediction';
import {intersectsOriginalObb, type MutableRoleObb, type RoleObb} from './obb-intersection';
import type {RoleMovementPose} from './movement-math';
import type {NavigationGrid} from './navigation';

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
  const obstacles: RoleObb[] = [];
  for (const tank of tanks) {
    if (tank.alive && tank.id !== id) obstacles.push(createRoleObbFromPose(tankBodyPose(tank)));
  }
  return obstacles;
}

/** Read rewrites all live body poses; the result is borrowed until the next read or clear. */
export class TankObstacleWorkspace {
  private readonly boxes: MutableRoleObb[] = [];
  private readonly pose: RoleMovementPose = {position: {x: 0, y: 0, z: 0},
    look: {x: 0, y: 0, z: 0}, forward: {x: 0, y: 0, z: 0}};

  read(id: TankBody['id'], tanks: Iterable<TankBody>): readonly RoleObb[] {
    let count = 0;
    for (const tank of tanks) {
      if (!tank.alive || tank.id === id) continue;
      const pose = this.pose;
      pose.position.x = tank.x; pose.position.y = tank.y; pose.position.z = tank.z;
      pose.look.x = Math.fround(Math.sin(tank.yaw));
      pose.look.z = Math.fround(Math.cos(tank.yaw));
      const bodyYaw = tank.bodyYaw ?? tank.yaw;
      pose.forward.x = Math.fround(Math.sin(bodyYaw));
      pose.forward.z = Math.fround(Math.cos(bodyYaw));
      const box: MutableRoleObb = this.boxes[count] ?? {matrix: new Array<number>(16), dimensions: [0, 0, 0]};
      createRoleObbFromPoseToRef(pose, box);
      this.boxes[count++] = box;
    }
    this.boxes.length = count;
    return this.boxes;
  }

  clear(): void {this.boxes.length = 0;}
}

export function overlapsTankPose(pose: RoleMovementPose, obstacles: readonly RoleObb[]): boolean {
  return overlapsBox(createRoleObbFromPose(pose), obstacles);
}

function overlapsBox(box: RoleObb, obstacles: readonly RoleObb[]): boolean {
  for (const other of obstacles) {
    if (intersectsOriginalObb(box, other)) return true;
  }
  return false;
}

const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const CONTACT_GAP = .05;
const CORNER_RADIUS = Math.hypot(49, 52) / 2;

/** Merge nearby live scene cells so contact follows surfaces across cell seams. */
function sceneObstacles(start: RoleMovementPose, end: RoleMovementPose, navigation: NavigationGrid): RoleObb[] {
  const grid = navigation.source;
  const turn = angleDelta(Math.atan2(start.forward.x, start.forward.z),
    Math.atan2(end.forward.x, end.forward.z));
  const extent = CORNER_RADIUS * (2 + Math.abs(turn)) + CONTACT_GAP;
  const firstColumn = Math.max(0, Math.floor((Math.min(start.position.x, end.position.x) - extent - grid.minimum[0]) / 12));
  const lastColumn = Math.min(grid.width - 1,
    Math.floor((Math.max(start.position.x, end.position.x) + extent - grid.minimum[0]) / 12));
  const firstRow = Math.max(0, Math.floor((Math.min(start.position.z, end.position.z) - extent - grid.minimum[2]) / 12));
  const lastRow = Math.min(grid.height - 1,
    Math.floor((Math.max(start.position.z, end.position.z) + extent - grid.minimum[2]) / 12));
  const obstacles: MutableRoleObb[] = [];
  let previous = new Map<string, MutableRoleObb>();
  for (let row = firstRow; row <= lastRow; row++) {
    const current = new Map<string, MutableRoleObb>();
    for (let column = firstColumn; column <= lastColumn; column++) {
      if (!navigation.isOccupiedCell(column, row)) continue;
      const first = column;
      while (column < lastColumn && navigation.isOccupiedCell(column + 1, row)) column++;
      const key = `${first}:${column}`;
      let box = previous.get(key);
      if (box) {
        box.matrix[14] += 6;
        box.dimensions[2] += 12;
      } else {
        box = {matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
          grid.minimum[0] + (first + column + 1) * 6,
          (start.position.y + end.position.y) / 2, grid.minimum[2] + row * 12 + 6, 1],
        dimensions: [(column - first + 1) * 12, 24 + Math.abs(end.position.y - start.position.y), 12]};
        obstacles.push(box);
      }
      current.set(key, box);
    }
    previous = current;
  }
  return obstacles;
}

/** Horizontal separation for the upright, yaw-only tank bodies. */
function contactOffset(box: RoleObb, other: RoleObb): {x: number; z: number} {
  const dx = box.matrix[12] - other.matrix[12], dz = box.matrix[14] - other.matrix[14];
  let minimum = Infinity, normalX = 0, normalZ = 0;
  for (const source of [box, other]) {
    for (const offset of [0, 8]) {
      const length = Math.hypot(source.matrix[offset], source.matrix[offset + 2]);
      const x = source.matrix[offset] / length, z = source.matrix[offset + 2] / length;
      const radius = (body: RoleObb): number =>
        (Math.abs(body.matrix[0] * x + body.matrix[2] * z) * body.dimensions[0]
          + Math.abs(body.matrix[8] * x + body.matrix[10] * z) * body.dimensions[2]) / 2;
      const distance = dx * x + dz * z;
      const overlap = radius(box) + radius(other) - Math.abs(distance);
      if (overlap < minimum) {
        minimum = overlap;
        normalX = distance < 0 ? -x : x;
        normalZ = distance < 0 ? -z : z;
      }
    }
  }
  return {x: normalX * (Math.max(0, minimum) + CONTACT_GAP),
    z: normalZ * (Math.max(0, minimum) + CONTACT_GAP)};
}

/** Contact displacement must leave the complete body on traversable ground. */
function fitsNavigation(pose: RoleMovementPose, box: RoleObb, navigation: NavigationGrid): boolean {
  const minimum = navigation.source.minimum;
  const halfX = (Math.abs(box.matrix[0]) * box.dimensions[0]
    + Math.abs(box.matrix[8]) * box.dimensions[2]) / 2;
  const halfZ = (Math.abs(box.matrix[2]) * box.dimensions[0]
    + Math.abs(box.matrix[10]) * box.dimensions[2]) / 2;
  const firstColumn = Math.floor((pose.position.x - halfX - minimum[0]) / 12);
  const lastColumn = Math.ceil((pose.position.x + halfX - minimum[0]) / 12) - 1;
  const firstRow = Math.floor((pose.position.z - halfZ - minimum[2]) / 12);
  const lastRow = Math.ceil((pose.position.z + halfZ - minimum[2]) / 12) - 1;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      if (navigation.cellAt(column, row)?.valid) continue;
      const dx = minimum[0] + column * 12 + 6 - pose.position.x;
      const dz = minimum[2] + row * 12 + 6 - pose.position.z;
      let separated = false;
      // The world-axis tests are covered by the candidate cell range above.
      // The two body axes distinguish covered cells from AABB corner cells.
      for (const offset of [0, 8]) {
        const length = Math.hypot(box.matrix[offset], box.matrix[offset + 2]);
        const x = box.matrix[offset] / length, z = box.matrix[offset + 2] / length;
        const bodyRadius = box.dimensions[offset === 0 ? 0 : 2] * length / 2;
        const cellRadius = 6 * (Math.abs(x) + Math.abs(z));
        if (Math.abs(dx * x + dz * z) >= bodyRadius + cellRadius) {
          separated = true;
          break;
        }
      }
      if (!separated) return false;
    }
  }
  return true;
}

function separateTurningPose(pose: RoleMovementPose, box: MutableRoleObb,
  obstacles: readonly RoleObb[], maximum: number, navigation?: NavigationGrid): number | undefined {
  let displaced = 0;
  // Revisit contacts because leaving one surface can meet another body or wall.
  for (let pass = 0; pass < 4; pass++) {
    let touching = false;
    for (const other of obstacles) {
      if (!intersectsOriginalObb(box, other)) continue;
      touching = true;
      const offset = contactOffset(box, other);
      displaced += Math.hypot(offset.x, offset.z);
      if (displaced > maximum) return undefined;
      pose.position.x += offset.x;
      pose.position.z += offset.z;
      createRoleObbFromPoseToRef(pose, box);
    }
    if (!touching) return (!navigation || fitsNavigation(pose, box, navigation)) ? displaced : undefined;
  }
  return !overlapsBox(box, obstacles) && (!navigation || fitsNavigation(pose, box, navigation))
    ? displaced : undefined;
}

/** Sweep body motion; blocked travel retains the remaining turn at contact. */
export function constrainTankPose(start: RoleMovementPose, end: RoleMovementPose,
  obstacles: readonly RoleObb[], navigation?: NavigationGrid): RoleMovementPose {
  const contacts = navigation ? [...obstacles, ...sceneObstacles(start, end, navigation)] : obstacles;
  if (!contacts.length) return end;
  const stopped = sweepTankPose(start, end, contacts, navigation);
  if (stopped === end || Math.abs(angleDelta(Math.atan2(stopped.forward.x, stopped.forward.z),
    Math.atan2(end.forward.x, end.forward.z))) < .0001) return stopped;
  const turned = sweepTankPose(stopped, {position: {...stopped.position},
    forward: end.forward, look: end.look}, contacts, navigation);
  return turned;
}

function sweepTankPose(start: RoleMovementPose, end: RoleMovementPose,
  obstacles: readonly RoleObb[], navigation?: NavigationGrid): RoleMovementPose {
  const firstBody = Math.atan2(start.forward.x, start.forward.z);
  const bodyTurn = angleDelta(firstBody, Math.atan2(end.forward.x, end.forward.z));
  const firstLook = Math.atan2(start.look.x, start.look.z);
  const lookTurn = angleDelta(firstLook, Math.atan2(end.look.x, end.look.z));
  const distance = Math.hypot(end.position.x - start.position.x,
    end.position.y - start.position.y, end.position.z - start.position.z);
  const steps = Math.max(1, Math.ceil(distance / 6), Math.ceil(Math.abs(bodyTurn) / (Math.PI / 36)));
  const sample: RoleMovementPose = {position: {x: 0, y: 0, z: 0},
    forward: {x: 0, y: 0, z: 0}, look: {x: 0, y: 0, z: 0}};
  const safe: RoleMovementPose = {position: {...start.position}, forward: {...start.forward}, look: {...start.look}};
  const box: MutableRoleObb = {matrix: new Array<number>(16), dimensions: [0, 0, 0]};
  const at = (fraction: number): RoleMovementPose => {
    sample.position.x = start.position.x + (end.position.x - start.position.x) * fraction;
    sample.position.y = start.position.y + (end.position.y - start.position.y) * fraction;
    sample.position.z = start.position.z + (end.position.z - start.position.z) * fraction;
    sample.forward.x = Math.fround(Math.sin(firstBody + bodyTurn * fraction));
    sample.forward.z = Math.fround(Math.cos(firstBody + bodyTurn * fraction));
    sample.look.x = Math.fround(Math.sin(firstLook + lookTurn * fraction));
    sample.look.z = Math.fround(Math.cos(firstLook + lookTurn * fraction));
    return sample;
  };
  // Existing contacts can include more than one wall surface.
  createRoleObbFromPoseToRef(start, box);
  let initialContact = 0;
  if (overlapsBox(box, obstacles)) {
    const initialPose = {position: {...start.position}, forward: start.forward, look: start.look};
    initialContact = separateTurningPose(initialPose, box, obstacles, Infinity, navigation) ?? 0;
  }
  let previous = 0;
  let corrected = false;
  const tryAt = (fraction: number): boolean => {
    createRoleObbFromPoseToRef(at(fraction), box);
    let shifted = false;
    if (overlapsBox(box, obstacles)) {
      // Corner contacts can separate along both horizontal directions.
      if ((Math.abs(bodyTurn) < .0001 && initialContact === 0)
          || separateTurningPose(sample, box, obstacles,
            initialContact + 2 * CORNER_RADIUS * Math.abs(bodyTurn) * fraction + CONTACT_GAP,
            navigation) === undefined) return false;
      shifted = true;
    }
    // Bound each contact step by translation and the swept corner travel.
    const allowedTravel = distance * (fraction - previous)
      + initialContact + 2 * CORNER_RADIUS * Math.abs(bodyTurn) * (fraction - previous) + 2 * CONTACT_GAP;
    if (Math.hypot(sample.position.x - safe.position.x, sample.position.y - safe.position.y,
      sample.position.z - safe.position.z) > allowedTravel) return false;
    if ((shifted || corrected) && navigation
        && (navigation.firstInvalidFraction(safe.position, sample.position) !== undefined
          || !fitsNavigation(sample, box, navigation))) return false;
    return true;
  };
  const remember = (fraction: number): void => {
    corrected ||= sample.position.x !== start.position.x + (end.position.x - start.position.x) * fraction
      || sample.position.z !== start.position.z + (end.position.z - start.position.z) * fraction;
    Object.assign(safe.position, sample.position);
    Object.assign(safe.forward, sample.forward);
    Object.assign(safe.look, sample.look);
  };
  for (let step = 1; step <= steps; step++) {
    const fraction = step / steps;
    if (!tryAt(fraction)) {
      let low = previous, high = fraction;
      for (let iteration = 0; iteration < 10; iteration++) {
        const middle = (low + high) / 2;
        if (tryAt(middle)) {
          low = middle;
          remember(middle);
          previous = middle;
        } else high = middle;
      }
      return low === 0 ? start : safe;
    }
    remember(fraction);
    previous = fraction;
  }
  return safe.position.x === end.position.x && safe.position.y === end.position.y
    && safe.position.z === end.position.z ? end : safe;
}
