import type {Point} from '../../battlefield';
import type {BotActor} from './controller';

// The 49x52 tank body needs room to turn as well as translate.
const BODY_CLEARANCE = 72;
const TEAMMATE_SPACING = 80;

/** Stable ownership prevents two equal agents from choosing the same escape. */
function hasPriority(actor: BotActor, other: BotActor): boolean {
  return actor.id < other.id;
}

/** Keep firing and passing positions apart, including teammates still en route. */
export function teammateWaypointClear(actor: BotActor, point: Point, teammates: readonly BotActor[]): boolean {
  return teammates.every(other => {
    const waypoint = (other.cpu ?? other.autopilot)?.teammateWaypoint;
    return (Math.abs(other.y - point.y) >= 24
        || Math.hypot(other.x - point.x, other.z - point.z) >= TEAMMATE_SPACING)
      && (hasPriority(actor, other) || !waypoint || Math.abs(waypoint.y - point.y) >= 24
        || Math.hypot(waypoint.x - point.x, waypoint.z - point.z) >= TEAMMATE_SPACING);
  });
}

/** A crowded tank can separate in several short moves before reaching full spacing. */
export function teammateEscapeClear(actor: BotActor, point: Point, teammates: readonly BotActor[]): boolean {
  if (teammateWaypointClear(actor, point, teammates)) return true;
  let separating = false;
  for (const other of teammates) {
    if (Math.abs(other.y - point.y) >= 24) continue;
    const before = Math.hypot(actor.x - other.x, actor.z - other.z);
    const after = Math.hypot(point.x - other.x, point.z - other.z);
    if (Math.abs(other.y - actor.y) < 24 && before < TEAMMATE_SPACING
        && after > before + .05) separating = true;
    if (after >= TEAMMATE_SPACING) continue;
    if (Math.abs(other.y - actor.y) >= 24 || after <= before + .05) return false;
  }
  // Reservations must not prevent leaving an occupied lane.
  return separating;
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
  const nearby = teammates.filter(other => Math.abs(other.y - actor.y) < 24
    && Math.hypot(other.x - actor.x, other.z - actor.z) < TEAMMATE_SPACING);
  // Priority settles normal encounters; a trapped teammate can request help
  // from the tank occupying the only available escape.
  if (nearby.some(other => !hasPriority(actor, other)
      || (other.cpu ?? other.autopilot)?.teammateNeedsRoom)) return true;
  if (nearby.length) return false;
  if (!route) return false;
  const dx = route.x - actor.x, dz = route.z - actor.z;
  if (Math.hypot(dx, dz) < .01) return false;
  const scale = Math.min(1, 144 / Math.hypot(dx, dz));
  const end = {x: actor.x + dx * scale,
    y: actor.y + (route.y - actor.y) * scale, z: actor.z + dz * scale};
  return teammates.some(other => !tankRouteClear(actor, end, [other])
    && (!hasPriority(actor, other) || (other.cpu ?? other.autopilot)?.teammateNeedsRoom));
}

/** Prefer a clear firing lane, otherwise first make room for another approach. */
export function teammateAvoidancePoint(actor: BotActor, route: Point | undefined,
  teammates: readonly BotActor[], actors: readonly BotActor[],
  direction: number, reach: (start: Point, end: Point) => Point,
  canShoot?: (position: Point) => boolean,
  canApproach?: (position: Point) => 'MOVE' | 'TURN' | undefined,
  previousPosition?: Point): Point | undefined {
  const crowded = teammates.some(other => Math.abs(other.y - actor.y) < 24
    && Math.hypot(other.x - actor.x, other.z - actor.z) < TEAMMATE_SPACING);
  const yieldingTo = teammates.filter(other => Math.abs(other.y - actor.y) < 24
    && Math.hypot(other.x - actor.x, other.z - actor.z) < TEAMMATE_SPACING
    && (!hasPriority(actor, other) || (other.cpu ?? other.autopilot)?.teammateNeedsRoom))
    .sort((a, b) => Math.hypot(a.x - actor.x, a.z - actor.z)
      - Math.hypot(b.x - actor.x, b.z - actor.z))[0];
  const bearing = route ? Math.atan2(route.x - actor.x, route.z - actor.z) : actor.yaw;
  const away = yieldingTo ? Math.atan2(actor.x - yieldingTo.x, actor.z - yieldingTo.z) - bearing : Math.PI;
  // Both directions of traffic pass on their own right. Leave the lane before
  // backing along it; the priority owner only yields to a trapped teammate.
  const offsets = yieldingTo
    ? [Math.PI / 2, -Math.PI / 2, away, Math.PI * .75, -Math.PI * .75, Math.PI]
    : [direction * Math.PI / 2, -direction * Math.PI / 2,
      direction * Math.PI / 4, -direction * Math.PI / 4,
      direction * Math.PI * .75, -direction * Math.PI * .75, Math.PI];
  let fallback: Point | undefined;
  let partial: Point | undefined;
  let turning: Point | undefined;
  for (const length of [96, 144, 192, 48, 24]) {
    for (const offset of offsets) {
      const desired = {x: actor.x + Math.sin(bearing + offset) * length, y: actor.y,
        z: actor.z + Math.cos(bearing + offset) * length};
      const reached = reach(actor, desired);
      if (Math.hypot(reached.x - actor.x, reached.z - actor.z) < 12
          || !crowded && previousPosition && Math.hypot(reached.x - previousPosition.x,
            reached.z - previousPosition.z) < 36
          || !tankRouteClear(actor, reached, actors)) continue;
      const approach = canApproach?.(reached);
      if (canApproach && !approach) continue;
      if (!teammateWaypointClear(actor, reached, teammates)) {
        if (teammateEscapeClear(actor, reached, teammates)) {
          if (approach === 'TURN') turning ??= reached;
          else partial ??= reached;
        }
        continue;
      }
      // Clear the occupied lane immediately when another legal candidate can
      // translate; a slow stationary alignment remains the final alternative.
      if (approach === 'TURN') {turning ??= reached; continue;}
      if (yieldingTo || !canShoot || canShoot(reached)) return reached;
      fallback ??= reached;
    }
  }
  return fallback ?? partial ?? turning;
}
