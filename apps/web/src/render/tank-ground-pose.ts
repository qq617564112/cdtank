import type {NavigationGrid} from '../../../shared/movement/navigation';
import {TANK_GROUND_SNAP} from '../../../shared/movement/tank-vertical';

export interface TankGroundSlope {
  readonly pitch: number;
  readonly roll: number;
}

/** Terrain heights are fixed; occupancy must still be checked on every frame. */
export class TankGroundSlopeSampler implements TankGroundSlope {
  pitch = 0;
  roll = 0;
  private navigation?: NavigationGrid;
  private x = NaN;
  private y = NaN;
  private z = NaN;
  private bodyYaw = NaN;
  private valid = false;

  sample(navigation: NavigationGrid | undefined, x: number, y: number,
    z: number, bodyYaw: number): TankGroundSlope {
    const valid = navigation?.isValidAt(x, z) ?? false;
    if (this.navigation === navigation && this.x === x && this.y === y
      && this.z === z && this.bodyYaw === bodyYaw && this.valid === valid) return this;
    this.navigation = navigation;
    this.x = x;
    this.y = y;
    this.z = z;
    this.bodyYaw = bodyYaw;
    this.valid = valid;
    this.pitch = this.roll = 0;
    if (navigation && valid) writeGroundSlope(navigation, x, y, z, bodyYaw, this);
    return this;
  }
}

// Current rebuilt role constructor dimensions. Final per-tank OBB sizes are
// still unknown, so the visible slope uses the same 49x52 footprint as motion.
const WIDTH = 49;
const DEPTH = 52;

/**
 * Visual-only NAV slope for the rendered hull. Pitch/roll tilt the render model
 * so it reads as standing on the sampled NAV surface; physical Y, gravity and
 * ground contact are handled separately by the shared vertical step, and this
 * slope does not feed the horizontal kernel or any authority calculation.
 * `y` is the actual displayed body height; a body lifted clear of the sampled
 * surface (airborne, falling, or crossing a drop) reads flat instead of
 * sampling the ground beneath it.
 */
export function tankGroundSlope(navigation: NavigationGrid | undefined,
  x: number, y: number, z: number, bodyYaw: number): TankGroundSlope {
  const result = {pitch: 0, roll: 0};
  tankGroundSlopeToRef(navigation, x, y, z, bodyYaw, result);
  return result;
}

export function tankGroundSlopeToRef(navigation: NavigationGrid | undefined,
  x: number, y: number, z: number, bodyYaw: number, result: {pitch: number; roll: number}): void {
  result.pitch = result.roll = 0;
  if (!navigation) return;
  if (!navigation.isValidAt(x, z)) return;
  writeGroundSlope(navigation, x, y, z, bodyYaw, result);
}

function writeGroundSlope(navigation: NavigationGrid, x: number, y: number,
  z: number, bodyYaw: number, result: {pitch: number; roll: number}): void {
  const center = navigation.groundHeightAt(x, z);
  if (center === undefined || y > center + TANK_GROUND_SNAP) return;

  const forwardX = Math.sin(bodyYaw);
  const forwardZ = Math.cos(bodyYaw);
  const halfDepth = DEPTH / 2;
  const halfWidth = WIDTH / 2;
  const front = navigation.groundHeightAt(x + forwardX * halfDepth, z + forwardZ * halfDepth) ?? center;
  const back = navigation.groundHeightAt(x - forwardX * halfDepth, z - forwardZ * halfDepth) ?? center;
  // Babylon's glTF X reflection maps local +X to source (-forwardZ, forwardX).
  const plusX = navigation.groundHeightAt(x - forwardZ * halfWidth, z + forwardX * halfWidth) ?? center;
  const minusX = navigation.groundHeightAt(x + forwardZ * halfWidth, z - forwardX * halfWidth) ?? center;

  result.pitch = -Math.atan2(front - back, DEPTH);
  result.roll = Math.atan2(plusX - minusX, WIDTH);
}
