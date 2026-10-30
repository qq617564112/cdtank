import type {MsgPlayerInput} from '../../../../shared/protocols';
import {hasFixedTurret, tankTurretYaw} from '../../../../shared/combat/tank-turret';
import type {Point} from '../../battlefield';
import type {BotActor} from './controller';

/** Every driving branch treats a waypoint within this distance as reached. */
export const ARRIVAL_RADIUS = 10;

export type DriveMode = 'TRAVEL' | 'ESCAPE' | 'YIELD' | 'BREACH' | 'COMBAT' | 'RETREAT';

export interface DriveRequest {
  readonly mode: DriveMode;
  /** Remaining waypoints; the last one is the destination. */
  readonly route: readonly Point[];
  /** Point the turret, or a fixed hull, should keep covering. */
  readonly face?: Point;
  /** Enemies to gain distance from while withdrawing. */
  readonly threats?: readonly Point[];
  /** Line of fire from a candidate position. */
  readonly canShoot?: (position: Point) => boolean;
  /** Only face the route, e.g. while its full search is still running. */
  readonly turnOnly?: boolean;
}

export interface DrivePose extends Point {yaw: number; bodyYaw?: number;}

interface Command {readonly move: -1 | 0 | 1; readonly turn: -1 | 0 | 1;}

const COMMANDS: readonly Command[] = [
  {move: 1, turn: 0}, {move: 1, turn: 1}, {move: 1, turn: -1},
  {move: -1, turn: 0}, {move: -1, turn: 1}, {move: -1, turn: -1},
  {move: 0, turn: 1}, {move: 0, turn: -1},
];
const STOP: Command = {move: 0, turn: 0};
const STEPS = 6;
const STEP_SECONDS = .1;
const HORIZON = STEPS * STEP_SECONDS;
/** Players hold a key for a short while; decisions are not re-made every tick. */
const DECISION_MS: readonly [number, number] = [120, 200];
/** Reversing beyond a few tank lengths costs extra while travelling. */
const REVERSE_DISTANCE: Readonly<Record<DriveMode, number>> = {
  TRAVEL: .8, ESCAPE: .3, YIELD: .2, BREACH: .5, COMBAT: .1, RETREAT: 0,
};
/** Continued reversing grows more expensive outside combat. */
const REVERSE_HOLD: Readonly<Record<DriveMode, number>> = {
  TRAVEL: .25, ESCAPE: .1, YIELD: .1, BREACH: .15, COMBAT: 0, RETREAT: 0,
};
/** Players hold a roughly right heading instead of correcting every few degrees. */
const HEADING_SLACK = .06;
const TEAMMATE_CLEARANCE = 84;
const ENEMY_CLEARANCE = 70;

function angle(value: number): number {return Math.atan2(Math.sin(value), Math.cos(value));}
/** Hull rotation of a command: reversing with a turn key swings the nose the other way. */
function rotation(command: Command): number {return command.move < 0 ? -command.turn : command.turn;}
function flat(a: Point, b: Point): number {return Math.hypot(a.x - b.x, a.z - b.z);}

interface RouteGuide {
  /** Directly reachable point ahead on the route; the route distance is measured from it. */
  readonly carrot: Point;
  /** Route direction at the carrot, used once the hull is close to it. */
  readonly heading: number;
  readonly remaining: number;
  readonly final: boolean;
}

interface RoutePoint {point: Point; remaining: number; final: boolean; heading: number;}

function along(start: Point, route: readonly Point[], distance: number): RoutePoint {
  let previous = start;
  let left = distance;
  for (let index = 0; index < route.length; index++) {
    const point = route[index];
    const length = flat(previous, point);
    if (length >= left && length > 0) {
      const fraction = left / length;
      let remaining = length - left;
      for (let next = index + 1; next < route.length; next++) remaining += flat(route[next - 1], route[next]);
      return {point: {x: previous.x + (point.x - previous.x) * fraction,
        y: previous.y + (point.y - previous.y) * fraction,
        z: previous.z + (point.z - previous.z) * fraction}, remaining, final: index === route.length - 1,
        heading: Math.atan2(point.x - previous.x, point.z - previous.z)};
    }
    left -= length;
    if (length > 0) previous = point;
  }
  const last = route[route.length - 1] ?? start;
  return {point: last, remaining: 0, final: true, heading: Math.atan2(last.x - start.x, last.z - start.z)};
}

/**
 * Pure pursuit over the remaining route. The carrot must be reachable in a
 * straight line, so a bend is followed around its corner rather than cut; fine
 * steps let it slide round the corner instead of jumping across it.
 */
function routeGuide(start: Point, route: readonly Point[], lookahead: number,
  clear: (end: Point) => boolean): RouteGuide {
  for (const fraction of [1, .85, .7, .55, .4, .25]) {
    const candidate = along(start, route, lookahead * fraction);
    if (clear(candidate.point)) {
      return {carrot: candidate.point, heading: candidate.heading, remaining: candidate.remaining,
        final: candidate.final};
    }
  }
  // Near a bend that is not yet passable, head along the next leg rather than back at the bend.
  const first = along(start, route, flat(start, route[0]));
  const heading = route.length > 1
    ? Math.atan2(route[1].x - route[0].x, route[1].z - route[0].z) : first.heading;
  return {carrot: first.point, heading, remaining: first.remaining, final: first.final};
}

/** Whether a short point can be approached by translating, or at least by turning. */
export function probe(actor: BotActor, point: Point, input: MsgPlayerInput): 'MOVE' | 'TURN' | undefined {
  if (!actor.movement) return 'MOVE';
  const before = flat(actor, point);
  let turning = false;
  for (const command of COMMANDS) {
    const next = actor.movement.predict({...input, ...command});
    if (command.move !== 0 && flat(next, actor) > .01 && flat(next, point) < before - .01) return 'MOVE';
    if (Math.abs(angle(next.yaw - actor.yaw)) > .000001) turning = true;
  }
  return turning ? 'TURN' : undefined;
}

/**
 * Chooses ordinary move/turn keys by previewing each command for a short time
 * and scoring the result with one cost: time still needed along the route,
 * heading, reversing, clearance, aim and progress history.
 */
export class DrivePlanner {
  private command: Command = STOP;
  private decideAt = 0;
  private destination?: Point;
  private mode?: DriveMode;
  private turnOnly = false;
  private reverseFrom?: number;
  private lastMove: -1 | 1 = 1;
  private directionSince = 0;
  private bestCost = Number.POSITIVE_INFINITY;
  private bestAt = 0;
  private stuckOrigin?: Point;
  private visits: {point: Point; at: number}[] = [];
  private holding = false;
  private holdingSince?: number;

  get travelDirection(): -1 | 1 {return this.lastMove;}
  /** The destination is not reached, yet no command currently makes progress. */
  get waiting(): boolean {return this.holding;}

  reverseSeconds(now: number): number {
    return this.reverseFrom === undefined ? 0 : Math.max(0, now - this.reverseFrom) / 1000;
  }

  /** Seconds without reducing the remaining route cost of the current destination. */
  stuckSeconds(now: number): number {
    return this.destination ? Math.max(0, now - this.bestAt) / 1000 : 0;
  }

  reset(): void {
    this.command = STOP;
    this.decideAt = 0;
    this.destination = undefined;
    this.mode = undefined;
    this.reverseFrom = undefined;
    this.holding = false;
    this.holdingSince = undefined;
    this.lastMove = 1;
    this.directionSince = 0;
    this.bestCost = Number.POSITIVE_INFINITY;
    this.bestAt = 0;
    this.stuckOrigin = undefined;
    this.visits = [];
  }

  /** Keys released by a branch that aims or waits in place. */
  idle(): void {
    this.holding = false;
    this.holdingSince = undefined;
    this.command = STOP;
    this.decideAt = 0;
    this.destination = undefined;
    this.mode = undefined;
    this.reverseFrom = undefined;
  }

  /** Writes move/turn into the input; stops within the arrival radius of the destination. */
  drive(actor: BotActor, request: DriveRequest, neighbours: readonly BotActor[],
    now: number, input: MsgPlayerInput): void {
    const destination = request.route[request.route.length - 1];
    if (!destination) {this.idle(); return;}
    this.remember(actor, now);
    if (request.route.length === 1 && flat(actor, destination) < ARRIVAL_RADIUS) {
      this.holding = false;
      this.apply(STOP, input, now);
      this.destination = undefined;
      return;
    }
    const changed = !this.destination || this.mode !== request.mode
      || this.turnOnly !== !!request.turnOnly || flat(this.destination, destination) > 24;
    if (changed) {
      this.destination = {...destination};
      this.mode = request.mode;
      this.turnOnly = !!request.turnOnly;
      this.bestCost = Number.POSITIVE_INFINITY;
      this.bestAt = now;
      this.stuckOrigin = undefined;
      this.holdingSince = undefined;
      this.decideAt = 0;
    } else this.destination = {...destination};
    const movement = actor.movement;
    if (!movement) {
      this.apply(fallback(actor, request.route[0]), input, now);
      return;
    }
    if (now < this.decideAt && !this.blocked(actor, input)) {
      this.apply(this.command, input, now);
      return;
    }
    const speed = Math.max(1, movement.speed);
    const turnRate = Math.max(.1, movement.turn);
    const lookahead = Math.max(36, speed * .6);
    const guide = routeGuide(actor, request.route, lookahead, end => {
      const reached = movement.navigation.reachable(actor, end);
      return flat(reached, end) < .01;
    });
    const reverseCost = REVERSE_DISTANCE[request.mode];
    const toGo = (pose: DrivePose): number => {
      const gap = flat(pose, guide.carrot);
      const distance = gap + guide.remaining;
      // Orientation no longer matters on the last few units.
      if (guide.final && distance < ARRIVAL_RADIUS * 2) return distance / speed;
      // Near the carrot the target heading blends into the route direction there,
      // so the cost has no step that holds the hull short of the carrot.
      const bearing = Math.atan2(guide.carrot.x - pose.x, guide.carrot.z - pose.z);
      const blend = Math.max(0, Math.min(1, (gap - lookahead * .2) / (lookahead * .3)));
      const approach = guide.heading + angle(bearing - guide.heading) * blend;
      const forward = distance / speed
        + Math.max(0, Math.abs(angle(approach - pose.yaw)) - HEADING_SLACK) / turnRate;
      const reverse = distance / speed + reverseCost * Math.min(distance, 400) / speed
        + Math.max(0, Math.abs(angle(approach - pose.yaw - Math.PI)) - HEADING_SLACK) / turnRate;
      return Math.min(forward, reverse);
    };
    const current = toGo(actor);
    if (current < this.bestCost - .15) {
      this.bestCost = current;
      this.bestAt = now;
      this.stuckOrigin = undefined;
    }
    const stuck = this.stuckSeconds(now);
    // A route the movement kernel refuses, or a local minimum of the route cost,
    // shows as a held stop or as no progress; players then back off or swing out.
    const held = this.holdingSince === undefined ? 0 : (now - this.holdingSince) / 1000;
    const explore = Math.max(Math.min(1, Math.max(0, held - .3)), stuck >= 1.5 ? .6 : 0);
    if (explore > 0) this.stuckOrigin ??= {x: actor.x, y: actor.y, z: actor.z};
    const predicted = neighbours.filter(other => other.alive && other.id !== actor.id
      && Math.abs(other.y - actor.y) < 24 && flat(other, actor) < 260).map(other => {
      const teammate = other.team === actor.team;
      const waypoint = (other.cpu ?? other.autopilot)?.teammateWaypoint;
      const travel = waypoint ? Math.min(flat(waypoint, other), other.tank.speed * 6 * .9 * HORIZON) : 0;
      const bearing = waypoint ? Math.atan2(waypoint.x - other.x, waypoint.z - other.z) : 0;
      return {x: other.x + Math.sin(bearing) * travel, z: other.z + Math.cos(bearing) * travel,
        radius: teammate ? TEAMMATE_CLEARANCE : ENEMY_CLEARANCE,
        // The lower id keeps its lane; the other tank yields more readily.
        weight: teammate ? (actor.id < other.id ? .4 : 1) : .6};
    });
    const crowding = (pose: Point): number => predicted.reduce((sum, other) => {
      const distance = Math.hypot(pose.x - other.x, pose.z - other.z);
      return distance >= other.radius ? sum : sum + other.weight * ((other.radius - distance) / other.radius) ** 2;
    }, 0);
    const face = request.face;
    const fixedTurret = hasFixedTurret(actor.tank.id);
    const aimCost = (pose: DrivePose): number => {
      if (!face) return 0;
      const bearing = Math.atan2(face.x - pose.x, face.z - pose.z);
      if (fixedTurret) return Math.abs(angle(bearing - (pose.bodyYaw ?? pose.yaw))) / turnRate * .8;
      // The turret rides on the hull and tracks at the same rate as the hull turns.
      const turret = tankTurretYaw(actor.tank.id, actor) + angle(pose.yaw - actor.yaw);
      return Math.max(0, Math.abs(angle(bearing - turret)) - turnRate * HORIZON) / turnRate * .6;
    };
    const threatDistance = (pose: Point): number => request.threats?.length
      ? Math.min(...request.threats.map(threat => flat(threat, pose))) : 0;
    const startThreat = threatDistance(actor);
    const reversing = this.reverseSeconds(now);
    let bestStep = 0;
    const score = (command: Command, poses: readonly DrivePose[]): number => {
      const end = poses[poses.length - 1] ?? actor;
      // The best pose along the preview counts, so a short final approach is not
      // rejected for overshooting; the next decision stops or turns there.
      let route = Number.POSITIVE_INFINITY;
      bestStep = 0;
      for (let index = 0; index < poses.length; index++) {
        const value = toGo(poses[index]) + index * .02;
        if (value < route) {route = value; bestStep = index;}
      }
      let cost = route + aimCost(end);
      cost += crowding(poses[Math.floor(poses.length / 2)] ?? end) * .5 + crowding(end);
      if (command.move < 0) cost += REVERSE_HOLD[request.mode] * (1 + reversing) * HORIZON;
      if (command.move !== this.command.move) {
        cost += command.move * this.command.move < 0 ? .3 : .08;
      }
      // Players keep a chosen direction for a while; a quick change back costs more.
      if (command.move === -this.lastMove && explore === 0) {
        cost += .2 + .4 * Math.max(0, 1 - (now - this.directionSince) / 2000);
      }
      // Costs follow the hull's actual rotation, so a reverse arc that keeps
      // swinging the same way as a pivot is not treated as a change of side.
      const spin = rotation(command), previousSpin = rotation(this.command);
      if (spin !== previousSpin) cost += spin * previousSpin < 0 ? .12 : .04;
      if (request.threats?.length) cost -= (threatDistance(end) - startThreat) / speed;
      if (request.canShoot && command !== STOP && !request.canShoot(end)) cost += .5;
      if (explore > 0 && this.stuckOrigin) {
        // Without progress, prefer leaving the spot over repeating the same poses.
        cost -= Math.max(0, Math.min(1, (flat(end, this.stuckOrigin) - flat(actor, this.stuckOrigin))
          / Math.max(12, speed * HORIZON * .5))) * explore;
        if (this.visits.some(visit => now - visit.at >= 1000 && flat(visit.point, end) < 6)) cost += .3 * explore;
      }
      return cost;
    };
    let best = STOP;
    let bestCost = score(STOP, [actor]);
    let holdSteps = STEPS;
    for (const command of COMMANDS) {
      if (request.turnOnly && command.move !== 0) continue;
      const poses = movement.rollout({...input, move: command.move, turn: command.turn}, STEPS, STEP_SECONDS);
      const end = poses[poses.length - 1];
      // Holding a move key against a wall only grinds the hull round; turning is done with the turn keys.
      if (!end || (command.move !== 0 ? flat(end, actor) < 2
        : Math.abs(angle(end.yaw - actor.yaw)) <= .000001)) continue;
      const cost = score(command, poses);
      if (cost < bestCost) {best = command; bestCost = cost; holdSteps = bestStep + 1;}
    }
    this.apply(best, input, now);
    this.holding = best === STOP && !request.turnOnly;
    if (!this.holding) this.holdingSince = undefined;
    else this.holdingSince ??= now;
    // An escape manoeuvre is held long enough to actually change the pose. A turn
    // is held only until the preview's best heading, like a player tapping the key,
    // so a full-rate turn does not overshoot and swing back.
    const interval = DECISION_MS[0] + Math.random() * (DECISION_MS[1] - DECISION_MS[0]);
    this.decideAt = now + (explore > 0 && best !== STOP ? 500
      : best.turn !== 0 ? Math.min(interval, holdSteps * STEP_SECONDS * 1000) : interval);
  }

  /** A held key that no longer moves or turns the hull is re-decided at once. */
  private blocked(actor: BotActor, input: MsgPlayerInput): boolean {
    if (this.command === STOP || !actor.movement) return this.command !== STOP;
    const next = actor.movement.predict({...input, move: this.command.move, turn: this.command.turn});
    return flat(next, actor) <= .01 && Math.abs(angle(next.yaw - actor.yaw)) <= .000001;
  }

  private apply(command: Command, input: MsgPlayerInput, now: number): void {
    if (command.move < 0) this.reverseFrom ??= now;
    else if (command.move > 0) this.reverseFrom = undefined;
    if (command.move !== 0 && command.move !== this.lastMove) {
      this.lastMove = command.move;
      this.directionSince = now;
    }
    this.command = command;
    input.move = command.move;
    input.turn = command.turn;
  }

  private remember(actor: BotActor, now: number): void {
    this.visits = this.visits.filter(visit => now - visit.at < 4000);
    if (!this.visits.length || now - this.visits[this.visits.length - 1].at >= 250) {
      this.visits.push({point: {x: actor.x, y: actor.y, z: actor.z}, at: now});
    }
  }
}

/** Kinematic fallback before the movement attributes are available. */
function fallback(actor: BotActor, waypoint: Point): Command {
  const error = angle(Math.atan2(waypoint.x - actor.x, waypoint.z - actor.z) - actor.yaw);
  if (Math.abs(error) > .5) return {move: 0, turn: error > 0 ? 1 : -1};
  return {move: 1, turn: Math.abs(error) < .05 ? 0 : error > 0 ? 1 : -1};
}
