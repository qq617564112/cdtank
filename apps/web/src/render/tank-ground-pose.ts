import type {NavigationGrid} from '../../../shared/movement/navigation';
import {TANK_GROUND_SNAP} from '../../../shared/movement/tank-vertical';

export interface TankGroundSlope {
  readonly pitch: number;
  readonly roll: number;
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
  if (!navigation) return {pitch: 0, roll: 0};
  const center = navigation.sample(x, z);
  if (!center?.valid) return {pitch: 0, roll: 0};
  if (y > center.height + TANK_GROUND_SNAP) return {pitch: 0, roll: 0};

  const forwardX = Math.sin(bodyYaw);
  const forwardZ = Math.cos(bodyYaw);
  const halfDepth = DEPTH / 2;
  const halfWidth = WIDTH / 2;
  const front = navigation.sample(x + forwardX * halfDepth, z + forwardZ * halfDepth);
  const back = navigation.sample(x - forwardX * halfDepth, z - forwardZ * halfDepth);
  // Babylon's glTF X reflection maps local +X to source (-forwardZ, forwardX).
  const plusX = navigation.sample(x - forwardZ * halfWidth, z + forwardX * halfWidth);
  const minusX = navigation.sample(x + forwardZ * halfWidth, z - forwardX * halfWidth);
  if (!front?.valid || !back?.valid || !plusX?.valid || !minusX?.valid) {
    return {pitch: 0, roll: 0};
  }

  return {
    pitch: -Math.atan2(front.height - back.height, DEPTH),
    roll: Math.atan2(plusX.height - minusX.height, WIDTH),
  };
}
