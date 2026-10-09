import type {Battlefield, Point} from '../../battlefield';
import type {BotActor} from './controller';

// The 49x52 tank body needs room to turn as well as translate.
const BODY_CLEARANCE = 72;
const TEAMMATE_SPACING = 80;

/** Keep firing and passing positions apart, including teammates still en route. */
export function teammateWaypointClear(point: Point, teammates: readonly BotActor[]): boolean {
  return teammates.every(other => {
    const waypoint = (other.cpu ?? other.autopilot)?.teammateWaypoint;
    return (Math.abs(other.y - point.y) >= 24
        || Math.hypot(other.x - point.x, other.z - point.z) >= TEAMMATE_SPACING)
      && (!waypoint || Math.abs(waypoint.y - point.y) >= 24
        || Math.hypot(waypoint.x - point.x, waypoint.z - point.z) >= TEAMMATE_SPACING);
  });
}

/** A nearby body may be left behind, but a route must not move farther into it. */
export function tankRouteClear(actor: BotActor, end: Point, actors: readonly BotActor[]): boolean {
  const dx = end.x - actor.x, dz = end.z - actor.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return true;
  return actors.every(other => {
    if (!other.alive || other.id === actor.id) return true;
    const x = actor.x - other.x, z = actor.z - other.z;
    const fraction = Math.max(0, Math.min(1, -(x * dx + z * dz) / lengthSquared));
    const height = actor.y + (end.y - actor.y) * fraction;
    if (Math.abs(height - other.y) >= 24) return true;
    if (Math.hypot(x + dx * fraction, z + dz * fraction) >= BODY_CLEARANCE) return true;
    return Math.abs(actor.y - other.y) < 24
      && Math.hypot(x, z) < BODY_CLEARANCE && x * dx + z * dz >= -1e-6
      && Math.hypot(x + dx, z + dz) > Math.hypot(x, z);
  });
}

/** Look ahead far enough to pass a teammate before authoritative body contact. */
export function teammateInWay(actor: BotActor, route: Point | undefined,
  teammates: readonly BotActor[]): boolean {
  if (teammates.some(other => Math.abs(other.y - actor.y) < 24
      && Math.hypot(other.x - actor.x, other.z - actor.z) < TEAMMATE_SPACING)) return true;
  if (!route) return false;
  const dx = route.x - actor.x, dz = route.z - actor.z;
  const scale = Math.min(1, 144 / Math.hypot(dx, dz));
  return !tankRouteClear(actor, {x: actor.x + dx * scale,
    y: actor.y + (route.y - actor.y) * scale, z: actor.z + dz * scale}, teammates);
}

/** Prefer a clear firing lane, otherwise first make room for another approach. */
export function teammateAvoidancePoint(actor: BotActor, route: Point | undefined,
  teammates: readonly BotActor[], actors: readonly BotActor[], field: Battlefield,
  direction: number, reach: (start: Point, end: Point) => Point,
  canShoot?: (position: Point) => boolean): Point | undefined {
  const bearing = route ? Math.atan2(route.x - actor.x, route.z - actor.z) : actor.yaw;
  const offsets = [direction * Math.PI / 2, -direction * Math.PI / 2,
    direction * Math.PI * .75, -direction * Math.PI * .75, Math.PI];
  let fallback: Point | undefined;
  for (const length of [96, 144, 192]) {
    for (const offset of offsets) {
      const desired = {x: actor.x + Math.sin(bearing + offset) * length, y: actor.y,
        z: actor.z + Math.cos(bearing + offset) * length};
      const cell = field.navigation.sample(desired.x, desired.z);
      if (!cell?.valid) continue;
      desired.y = cell.height;
      const reached = reach(actor, desired);
      if (Math.hypot(reached.x - desired.x, reached.z - desired.z) >= .01
          || !teammateWaypointClear(reached, teammates)
          || !tankRouteClear(actor, reached, actors)) continue;
      if (!canShoot || canShoot(reached)) return reached;
      fallback ??= reached;
    }
  }
  return fallback;
}
