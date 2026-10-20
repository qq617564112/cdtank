import type {MsgPlayerInput} from '../../../../shared/protocols';
import type {Point} from '../../battlefield';
import type {BotActor} from './controller';

interface DriveCommand {move: number; turn: number;}
interface RecoveryContext {
  mapId: string;
  targetId?: string;
  searching: boolean;
  pathLength: number;
  actors: readonly BotActor[];
  pursuing: boolean;
  travelDirection: -1 | 1;
}

export type RecoveryReason = 'RECOVERY_TIMEOUT' | 'BLOCKED_RECOVERY' | 'NO_EXIT' | 'LOCAL_LOOP';

const DRIVE_COMMANDS: readonly DriveCommand[] = [
  {move: 1, turn: 0}, {move: 1, turn: 1}, {move: 1, turn: -1},
  {move: -1, turn: 0}, {move: -1, turn: 1}, {move: -1, turn: -1},
];

/** Track physical progress independently of targeting and short-lived waypoints. */
export class BotRecovery {
  private origin?: Point;
  private progressAt = 0;
  private observedAt = 0;
  private tracking = false;
  private held?: {command: DriveCommand; until: number};
  private attempt?: {origin: Point; startedAt: number};
  private routeOrigin?: Point;
  private routeProgressAt = 0;
  private retryAt = 0;
  private pendingReplan?: RecoveryReason;
  private lastCommand?: DriveCommand;
  private visits: {point: Point; at: number}[] = [];
  private replans = 0;
  private lastReason?: RecoveryReason;
  private nextReportAt = 0;
  private alignment?: {waypoint: Point; direction: number; error: number; progressedAt: number};

  get stalledSeconds(): number {
    return this.tracking ? Math.max(0, this.observedAt - this.progressAt) / 1000 : 0;
  }

  get active(): boolean {return !!this.held && this.observedAt < this.held.until;}

  get replanCount(): number {return this.replans;}
  get replanReason(): RecoveryReason | undefined {return this.lastReason;}
  get routeStalledSeconds(): number {
    return this.routeOrigin ? Math.max(0, this.observedAt - this.routeProgressAt) / 1000 : 0;
  }

  takeReplan(): RecoveryReason | undefined {
    const reason = this.pendingReplan;
    this.pendingReplan = undefined;
    return reason;
  }

  private replan(reason: RecoveryReason, now: number): void {
    this.held = undefined;
    this.attempt = undefined;
    this.routeOrigin = undefined;
    this.retryAt = now + 2500;
    this.pendingReplan = reason;
    this.lastReason = reason;
    this.replans++;
  }

  reset(): void {
    this.origin = undefined;
    this.tracking = false;
    this.held = undefined;
    this.attempt = undefined;
    this.routeOrigin = undefined;
    this.retryAt = 0;
    this.pendingReplan = undefined;
    this.lastCommand = undefined;
    this.lastReason = undefined;
    this.visits = [];
    this.nextReportAt = 0;
    this.alignment = undefined;
  }

  observe(actor: BotActor, now: number): void {
    if (actor.combat?.getFlag?.(9) === 0) {
      this.reset();
      this.observedAt = now;
      return;
    }
    if (now - this.observedAt > 1000) this.reset();
    const threshold = Math.max(2, Math.min(12, (actor.movement?.speed ?? 48) * .25));
    if (!this.origin || !this.tracking || now - this.observedAt > 1000
        || Math.hypot(actor.x - this.origin.x, actor.z - this.origin.z) >= threshold) {
      this.origin = {x: actor.x, y: actor.y, z: actor.z};
      this.progressAt = now;
      if (now - this.observedAt > 1000) this.held = undefined;
    }
    this.observedAt = now;
    this.visits = this.visits.filter(visit => now - visit.at < 4000);
    if (!this.visits.length || now - this.visits[this.visits.length - 1].at >= 150) {
      this.visits.push({point: {x: actor.x, y: actor.y, z: actor.z}, at: now});
    }
    if (this.attempt) {
      if (Math.hypot(actor.x - this.attempt.origin.x, actor.z - this.attempt.origin.z) >= 36) {
        this.attempt = undefined;
        this.held = undefined;
        this.retryAt = now + 750;
      } else if (now - this.attempt.startedAt >= 1500) this.replan('RECOVERY_TIMEOUT', now);
    }
  }

  apply(actor: BotActor, teammates: readonly BotActor[], input: MsgPlayerInput,
    waypoint: Point | undefined, needsMovement: boolean, now: number,
    context: RecoveryContext): boolean {
    // A trap can forbid translation while ordinary aiming and turning remain
    // useful. Resume pursuit from the actual pose after that permission returns.
    if (actor.combat?.getFlag?.(9) === 0) return false;
    const crowded = teammates.filter(other => Math.abs(other.y - actor.y) < 24
      && Math.hypot(other.x - actor.x, other.z - actor.z) < 96);
    let aligning = false;
    let turned = false;
    if (waypoint && actor.movement && input.move === 0 && input.turn !== 0) {
      const bearing = Math.atan2(waypoint.x - actor.x, waypoint.z - actor.z);
      const offset = context.travelDirection < 0 ? Math.PI : 0;
      const next = actor.movement.predict(input);
      const error = Math.abs(turnDelta(actor.yaw + offset, bearing));
      const same = this.alignment && this.alignment.direction === context.travelDirection
        && Math.hypot(waypoint.x - this.alignment.waypoint.x,
          waypoint.z - this.alignment.waypoint.z) < 7;
      if (!this.alignment) {
        this.alignment = {waypoint: {...waypoint}, direction: context.travelDirection,
          error, progressedAt: now};
      } else if (!same) {
        Object.assign(this.alignment, {waypoint: {...waypoint}, direction: context.travelDirection, error});
      } else if (error < this.alignment.error - .035) {
        this.alignment.error = error;
        this.alignment.progressedAt = now;
        turned = true;
      }
      aligning = Math.abs(turnDelta(next.yaw + offset, bearing)) < error - .000001
        && now - this.alignment.progressedAt < 750;
    } else if (input.move !== 0 || !needsMovement) this.alignment = undefined;
    // A held escape ends when driving is no longer requested and the nearby
    // lane is clear, so aiming or waiting for broken geometry can finish.
    const tracking = !actor.roleDisguise
      && (needsMovement || crowded.length > 0 || input.move !== 0);
    if (context.pursuing && tracking) {
      if (!this.routeOrigin || Math.hypot(actor.x - this.routeOrigin.x, actor.z - this.routeOrigin.z) >= 96) {
        this.routeOrigin = {x: actor.x, y: actor.y, z: actor.z};
        this.routeProgressAt = now;
      } else if (turned) this.routeProgressAt = now;
      else if (now - this.routeProgressAt >= 8000 && now >= this.retryAt && !this.pendingReplan) {
        this.replan('LOCAL_LOOP', now);
      }
    } else this.routeOrigin = undefined;
    if (!this.tracking || !tracking) {
      this.origin = {x: actor.x, y: actor.y, z: actor.z};
      this.progressAt = now;
    }
    this.tracking = tracking;
    if (!tracking || !actor.movement) {
      this.held = undefined; this.attempt = undefined;
      return false;
    }
    // Slow chassis can need several seconds to face a clear route. Keep the
    // physical stall measurement, but let a legal, converging turn finish.
    if (aligning) {
      this.held = undefined; this.attempt = undefined;
      return false;
    }
    if (this.pendingReplan || now < this.retryAt) return false;
    const predict = (command: DriveCommand) => actor.movement!.predict({...input, ...command});
    const moves = (point: Point) => Math.hypot(point.x - actor.x, point.z - actor.z) > .01;
    if (this.held && now < this.held.until) {
      const next = predict(this.held.command);
      if (this.held.command.move !== 0 ? moves(next)
        : Math.abs(turnDelta(actor.yaw, next.yaw)) > .000001) {
        Object.assign(input, this.held.command);
        return true;
      }
      // A blocked held command ends the attempt; reversing immediately can
      // alternate between two valid poses on every simulation tick.
      this.replan('BLOCKED_RECOVERY', now);
      return false;
    }
    this.held = undefined;
    if (this.stalledSeconds < (crowded.length ? .75 : 1.5)) return false;
    this.attempt ??= {origin: {x: actor.x, y: actor.y, z: actor.z}, startedAt: now};

    // Immediate OBB/NAV permission remains authoritative. A full passing point
    // is unnecessary when several neighbours leave only a short usable step.
    const pressure = (point: Point) => crowded.reduce((sum, other) =>
      sum + Math.max(0, 96 - Math.hypot(point.x - other.x, point.z - other.z)) ** 2, 0);
    let dx = waypoint ? waypoint.x - actor.x : Math.sin(actor.yaw);
    let dz = waypoint ? waypoint.z - actor.z : Math.cos(actor.yaw);
    if (crowded.length) {
      dx = 0; dz = 0;
      for (const other of crowded) {
        const distance = Math.max(1, Math.hypot(actor.x - other.x, actor.z - other.z));
        dx += (actor.x - other.x) / (distance * distance);
        dz += (actor.z - other.z) / (distance * distance);
      }
      if (Math.hypot(dx, dz) < .000001) {
        dx = Math.sin(actor.yaw + Math.PI); dz = Math.cos(actor.yaw + Math.PI);
      }
    }
    const length = Math.hypot(dx, dz);
    const direction = length > .000001 ? {x: dx / length, z: dz / length}
      : {x: Math.sin(actor.yaw), z: Math.cos(actor.yaw)};
    const currentPressure = pressure(actor);
    let chosen: DriveCommand | undefined;
    let bestRelief = -Infinity;
    let bestProgress = -Infinity;
    let available = 0;
    for (const command of DRIVE_COMMANDS) {
      const next = predict(command);
      if (!moves(next)) continue;
      available++;
      const relief = currentPressure - pressure(next);
      const revisiting = this.visits.some(visit => now - visit.at >= 300
        && Math.hypot(next.x - visit.point.x, next.z - visit.point.z) < 3);
      const reversing = this.lastCommand && command.move !== this.lastCommand.move;
      const progress = (next.x - actor.x) * direction.x + (next.z - actor.z) * direction.z
        - (revisiting ? 8 : 0) - (reversing ? 4 : 0);
      if (!chosen || relief > bestRelief + .01
          || Math.abs(relief - bestRelief) <= .01 && progress > bestProgress) {
        chosen = command; bestRelief = relief; bestProgress = progress;
      }
    }
    // After repeated physical stalls, a legal step away from the goal can
    // release a corner that cannot be approached from the current pose.
    if (!chosen || bestRelief <= .01 && bestProgress < 0 && this.stalledSeconds < 3) {
      const bearing = Math.atan2(direction.x, direction.z);
      const offset = context.travelDirection < 0 ? Math.PI : 0;
      let bestTurn = -Infinity;
      for (const turn of [1, -1]) {
        const next = predict({move: 0, turn});
        if (Math.abs(turnDelta(actor.yaw, next.yaw)) <= .000001) continue;
        const progress = Math.abs(turnDelta(actor.yaw + offset, bearing))
          - Math.abs(turnDelta(next.yaw + offset, bearing));
        if (progress > bestTurn) {chosen = {move: 0, turn}; bestTurn = progress;}
      }
    }
    if (this.stalledSeconds >= 6 && now >= this.nextReportAt) {
      this.nextReportAt = now + 10000;
      console.warn('CPU movement stalled', {mapId: context.mapId, playerId: actor.id,
        targetId: context.targetId, x: actor.x, y: actor.y, z: actor.z,
        seconds: Math.round(this.stalledSeconds), searching: context.searching,
        pathLength: context.pathLength,
        waypoint: waypoint ? {x: waypoint.x, y: waypoint.y, z: waypoint.z} : undefined,
        availableMoves: available,
        command: chosen, status: actor.combat?.status,
        movementFlags: [8, 9, 10].map(index => actor.combat?.getFlag?.(index)),
        neighbours: context.actors.filter(other => other.alive && other.id !== actor.id
          && Math.abs(other.y - actor.y) < 24
          && Math.hypot(other.x - actor.x, other.z - actor.z) < 144)
          .map(other => ({id: other.id, team: other.team, x: other.x, z: other.z}))});
    }
    if (!chosen) {
      this.replan('NO_EXIT', now);
      input.move = 0; input.turn = 0;
      return false;
    }
    this.held = {command: chosen, until: now + (chosen.move === 0 ? 250 : 600)};
    this.lastCommand = chosen;
    Object.assign(input, chosen);
    return true;
  }
}

function turnDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
