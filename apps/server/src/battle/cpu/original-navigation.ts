import type {Battlefield, Point} from '../../battlefield';
import type {BotNavigationPolicy} from './navigation';
import {sampleRoleNavigation} from '../roles/movement-navigation';
import {ORIGINAL_MOVEMENT_DIMENSIONS} from '../movement';

/** Reconstructed CPU route checks using the production original NAV footprint.
 * Route heading assumes body alignment; actual steering still previews the full
 * persistent look/forward pose with the authoritative movement wrapper.
 */
export function createOriginalBotNavigation(field: Battlefield,
  dimensions: {width: number; depth: number} = ORIGINAL_MOVEMENT_DIMENSIONS): BotNavigationPolicy {
  const reachable = (start: Point, end: Point): Point => {
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (length === 0) return {...start};
    const heading = Math.atan2(end.x - start.x, end.z - start.z);
    const forward = {x: Math.fround(Math.sin(heading)), y: 0, z: Math.fround(Math.cos(heading))};
    const steps = Math.ceil(length / 6);
    let previous = {...start};
    for (let index = 1; index <= steps; index++) {
      const fraction = index / steps;
      const point = {x: start.x + (end.x - start.x) * fraction, y: start.y,
        z: start.z + (end.z - start.z) * fraction};
      const cell = field.navigation.sample(point.x, point.z);
      if (!cell?.valid || !sampleRoleNavigation(field.navigation,
          {position: point, forward}, 1, dimensions.width, dimensions.depth).accepted) break;
      point.y = cell.height;
      previous = point;
    }
    return previous;
  };
  return {cacheKey: `original-forward:${dimensions.width}:${dimensions.depth}:6`, reachable,
    canTraverse: (start, end) => {
      const result = reachable(start, end);
      return Math.hypot(result.x - end.x, result.z - end.z) < .01;
    }};
}
