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
}

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
  private nextReportAt = 0;

  get stalledSeconds(): number {
    return this.tracking ? Math.max(0, this.observedAt - this.progressAt) / 1000 : 0;
  }

  get active(): boolean {return !!this.held && this.observedAt < this.held.until;}

  reset(): void {
    this.origin = undefined;
    this.tracking = false;
    this.held = undefined;
    this.nextReportAt = 0;
  }

  observe(actor: BotActor, now: number): void {
    const threshold = Math.max(2, Math.min(12, (actor.movement?.speed ?? 48) * .25));
    if (!this.origin || !this.tracking || now - this.observedAt > 1000
        || Math.hypot(actor.x - this.origin.x, actor.z - this.origin.z) >= threshold) {
      this.origin = {x: actor.x, y: actor.y, z: actor.z};
      this.progressAt = now;
      if (now - this.observedAt > 1000) this.held = undefined;
    }
    this.observedAt = now;
  }

  apply(actor: BotActor, teammates: readonly BotActor[], input: MsgPlayerInput,
    waypoint: Point | undefined, needsMovement: boolean, now: number,
    context: RecoveryContext): boolean {
    const crowded = teammates.filter(other => Math.abs(other.y - actor.y) < 24
      && Math.hypot(other.x - actor.x, other.z - actor.z) < 96);
    const tracking = !actor.roleDisguise
      && (this.active || needsMovement || crowded.length > 0 || input.move !== 0);
    if (!this.tracking || !tracking) {
      this.origin = {x: actor.x, y: actor.y, z: actor.z};
      this.progressAt = now;
    }
    this.tracking = tracking;
    if (!tracking || !actor.movement) {this.held = undefined; return false;}
    const predict = (command: DriveCommand) => actor.movement!.predict({...input, ...command});
    const moves = (point: Point) => Math.hypot(point.x - actor.x, point.z - actor.z) > .01;
    if (this.held && now < this.held.until) {
      const next = predict(this.held.command);
      if (this.held.command.move !== 0 ? moves(next)
        : Math.abs(turnDelta(actor.yaw, next.yaw)) > .000001) {
        Object.assign(input, this.held.command);
        return true;
      }
    }
    this.held = undefined;
    if (this.stalledSeconds < (crowded.length ? .75 : 1.5)) return false;

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
      const progress = (next.x - actor.x) * direction.x + (next.z - actor.z) * direction.z;
      if (!chosen || relief > bestRelief + .01
          || Math.abs(relief - bestRelief) <= .01 && progress > bestProgress) {
        chosen = command; bestRelief = relief; bestProgress = progress;
      }
    }
    if (!chosen) {
      const bearing = Math.atan2(direction.x, direction.z);
      let bestTurn = -Infinity;
      for (const turn of [1, -1]) {
        const next = predict({move: 0, turn});
        if (Math.abs(turnDelta(actor.yaw, next.yaw)) <= .000001) continue;
        const progress = Math.abs(turnDelta(actor.yaw, bearing))
          - Math.abs(turnDelta(next.yaw, bearing));
        if (progress > bestTurn) {chosen = {move: 0, turn}; bestTurn = progress;}
      }
    }
    if (this.stalledSeconds >= 6 && now >= this.nextReportAt) {
      this.nextReportAt = now + 10000;
      console.warn('CPU movement stalled', {mapId: context.mapId, playerId: actor.id,
        targetId: context.targetId, x: actor.x, y: actor.y, z: actor.z,
        seconds: Math.round(this.stalledSeconds), searching: context.searching,
        pathLength: context.pathLength, waypoint, availableMoves: available,
        command: chosen, status: actor.combat?.status,
        movementFlags: [8, 9, 10].map(index => actor.combat?.getFlag?.(index)),
        neighbours: context.actors.filter(other => other.alive && other.id !== actor.id
          && Math.abs(other.y - actor.y) < 24
          && Math.hypot(other.x - actor.x, other.z - actor.z) < 144)
          .map(other => ({id: other.id, team: other.team, x: other.x, z: other.z}))});
    }
    if (!chosen) {input.move = 0; input.turn = 0; return false;}
    this.held = {command: chosen, until: now + (chosen.move === 0 ? 250 : 600)};
    Object.assign(input, chosen);
    return true;
  }
}

function turnDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
