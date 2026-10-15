import type {Battlefield, Point} from '../../battlefield';
import type {BotNavigationPolicy} from './navigation';
import {sampleRoleNavigationFailure} from '../roles/movement-navigation';
import {ORIGINAL_MOVEMENT_DIMENSIONS} from '../movement';

/** Reconstructed CPU route checks using the production original NAV footprint.
 * Route heading assumes body alignment; actual steering still previews the full
 * persistent look/forward pose with the authoritative movement wrapper.
 */
export function createOriginalBotNavigation(field: Pick<Battlefield, 'navigation'>,
  dimensions: {width: number; depth: number} = ORIGINAL_MOVEMENT_DIMENSIONS): BotNavigationPolicy {
  const forward = {x: 0, y: 0, z: 0}, point = {x: 0, y: 0, z: 0}, reached = {x: 0, y: 0, z: 0};
  let advanced = false;
  // Each policy call finishes synchronously; returned route points own their values.
  const trace = (start: Point, end: Point): void => {
    advanced = false;
    reached.x = start.x; reached.y = start.y; reached.z = start.z;
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (length === 0) return;
    const heading = Math.atan2(end.x - start.x, end.z - start.z);
    forward.x = Math.fround(Math.sin(heading)); forward.z = Math.fround(Math.cos(heading));
    const steps = Math.ceil(length / 6);
    for (let index = 1; index <= steps; index++) {
      const fraction = index / steps;
      point.x = start.x + (end.x - start.x) * fraction; point.y = start.y;
      point.z = start.z + (end.z - start.z) * fraction;
      const height = field.navigation.validHeightAt(point.x, point.z);
      if (height === undefined || sampleRoleNavigationFailure(field.navigation,
          point, forward, 1, dimensions.width, dimensions.depth) !== undefined) break;
      reached.x = point.x; reached.y = height; reached.z = point.z;
      advanced = true;
    }
  };
  const reachable = (start: Point, end: Point): Point => {
    trace(start, end);
    return advanced ? {...reached} : {...start};
  };
  return {cacheKey: `original-forward:${dimensions.width}:${dimensions.depth}:6`, reachable,
    canTraverse: (start, end) => {
      trace(start, end);
      return Math.hypot(reached.x - end.x, reached.z - end.z) < .01;
    }};
}
