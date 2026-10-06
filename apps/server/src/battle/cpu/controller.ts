import type {TrapFireRestraintState} from '../items/trap-fire-restraint';
import type {TrapTurnRestraintState} from '../items/trap-turn-restraint';
import type {MsgPlayerInput, ObjectiveSnapshot} from '../../../../shared/protocols';
import {segmentBox, segmentSphere, type Battlefield, type Point} from '../../battlefield';
import type {BotNavigationPolicy} from './navigation';
import {BotPathPlanner} from './navigation';
import {vipEvasion} from './vip-evasion';
import {getSceneBreakables, type SceneBreakable} from '../../scene-objects';
import {aimTurnRate} from '../roles/aim-turn';
import {roleMovementElapsed} from '../roles/movement-time';
import {combatCatalog} from '../catalog';
import {buildingToolHotkey} from './building-tool';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import type {AmmoBurnState} from '../items/ammo-burn';
import type {AmmoSlowState} from '../items/ammo-slow';
import type {TrapRestraintState} from '../items/trap-restraint';
import type {OpticalCamouflageState} from '../items/optical-camouflage';
import type {RoleDisguiseState} from '../items/role-disguise';
import {isHiddenByOpticalCamouflage} from '../../../../shared/combat/optical-camouflage';
import {petInjectionHotkey, finiteAmmoHotkey, healingHotkey, defenseDrinkHotkey, attackDrinkHotkey, speedDrinkHotkey, invincibilityHotkey, opticalCamouflageHotkey, roleDisguiseHotkey, turnDrinkHotkey, teamLifeHotkey, airstrikeHotkey, type TeamLifeContext} from './items';

export interface BotActor extends Point {
  id: string;
  team: number;
  yaw: number;
  aim: number;
  movement?: {speed: number; turn: number; navigation: BotNavigationPolicy; predict(input: MsgPlayerInput): Point & {yaw: number}};
  alive: boolean;
  vip: boolean;
  tank: {speed: number; turn: number};
  cpu?: {readonly objectiveTargetId: string | undefined};
  autopilot?: {readonly objectiveTargetId: string | undefined};
  hp?: number;
  maxHp?: number;
  fireReady?: boolean;
  movementReady?: boolean;
  attributesReady?: boolean;
  burn?: AmmoBurnState;
  ammoSlow?: AmmoSlowState;
  trapRestraint?: TrapRestraintState;
  trapTurnRestraint?: TrapTurnRestraintState;
  trapFireRestraint?: TrapFireRestraintState;
  opticalCamouflage?: OpticalCamouflageState;
  roleDisguise?: RoleDisguiseState;
  inventory?: readonly BattleItemRecord[];
  combat?: {status?: number; currentAmmoTableId?: number;
    roleFloatFields?: ReadonlyMap<number, number>; record?: {arrays: Map<number, Int32Array>}};
}

/** Rebuilt CPU steering: only emits normal inputs, never mutates world state. */
export class BotController {
  private path: Point[] = [];
  private goal?: Point;
  private nextPlan = 0;
  private sequence = 0;
  private planner?: BotPathPlanner;
  private navigationRevision = -1;
  private planStartedAt = 0;
  private targetId?: string;
  private observedTargetHp?: number;
  private ineffectiveFireSeconds = 0;
  private repositionDestroy = false;
  private previousPosition?: Point;
  private requestedMovement = false;
  private blockedMovementSeconds = 0;
  private escapePoint?: Point;
  private readonly failedApproaches = new Map<string, number>();
  private readonly unavailableUntil = new Map<string, number>();

  /** Current intent for CPU coordination; deferred targets are available to others. */
  get objectiveTargetId(): string | undefined {
    return this.targetId && !this.unavailableUntil.has(this.targetId) ? this.targetId : undefined;
  }

  input(actor: BotActor, actors: readonly BotActor[], objectives: readonly ObjectiveSnapshot[],
    field: Battlefield, mode: number, now: number, dt: number,
    teamLife?: TeamLifeContext, buildingToolRoom?: Parameters<typeof buildingToolHotkey>[3]): MsgPlayerInput {
    if (this.navigationRevision !== field.navigationRevision) {
      this.navigationRevision = field.navigationRevision;
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
    }
    const input: MsgPlayerInput = {sequence: ++this.sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: this.sequence === 1 ? 1 : 0, clientTime: now};
    const aimStep = aimTurnRate(actor.movement?.turn, actor.tank.turn) * roleMovementElapsed(dt);
    if (!actor.alive) {
      input.useItem = 0;
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
      this.targetId = undefined; this.failedApproaches.clear(); this.unavailableUntil.clear();
      this.observedTargetHp = undefined; this.ineffectiveFireSeconds = 0;
      this.repositionDestroy = false;
      this.previousPosition = undefined; this.requestedMovement = false; this.blockedMovementSeconds = 0;
      this.escapePoint = undefined;
      return input;
    }
    if (actor.roleDisguise) input.fire = false;
    input.useItem = healingHotkey(actor) || input.useItem;
    const reach = (start: Point, end: Point) => actor.movement
      ? actor.movement.navigation.reachable(start, end) : field.move(start, end, 20);
    const distance = (point: Point) => Math.hypot(point.x - actor.x, point.z - actor.z);
    const enemies = actors.filter(other => other.alive && other.id !== actor.id
      && (mode >= 4 || other.team !== actor.team)
      && !isHiddenByOpticalCamouflage(other, actor, mode));
    enemies.sort((a, b) => (mode === 3 ? Number(b.vip) - Number(a.vip) : 0) || distance(a) - distance(b));
    const claimed = new Set(actors.filter(other => other.id !== actor.id && other.alive
      && other.team === actor.team).map(other => (other.cpu ?? other.autopilot)?.objectiveTargetId));
    const targets = mode === 5 ? objectives.filter(o => o.hp > 0).sort((a, b) =>
      Number(claimed.has(a.id)) - Number(claimed.has(b.id)) || distance(a) - distance(b)) : enemies;
    for (const [id, until] of this.unavailableUntil) {
      if (now >= until) this.unavailableUntil.delete(id);
    }
    const available = targets.filter(target => !this.unavailableUntil.has(target.id));
    // Let an in-flight search finish for its living target rather than replacing
    // it each time two enemies exchange nearest-distance order.
    const retainTarget = this.planner || this.escapePoint
      || (mode === 5 && this.targetId && !claimed.has(this.targetId));
    const retained = retainTarget ? available.find(target => target.id === this.targetId) : undefined;
    // Work on a reachable firing line before committing to a route around a wall.
    // The existing order still distributes equally shootable work among teammates.
    const target = retained ?? (mode === 5 ? available.find(objective => {
      if (!('sourcePlacementId' in objective) || objective.sourcePlacementId === undefined) return false;
      const box = getSceneBreakables(Number(field.source.id)).find(box => box.id === objective.sourcePlacementId);
      if (!box) return false;
      const bearing = Math.atan2(objective.x - actor.x, objective.z - actor.z);
      return canShootSource(actor, bearing, box, field, actors, actor.id);
    }) : undefined) ?? available[0];
    const capture = mode === 2 ? objectives.find(o => o.kind === 'CAPTURE') : undefined;
    const sourcePlacementId = target && 'sourcePlacementId' in target ? target.sourcePlacementId : undefined;
    const source = sourcePlacementId === undefined ? undefined
      : getSceneBreakables(Number(field.source.id)).find(source => source.id === sourcePlacementId);
    const finishInput = (): MsgPlayerInput => {
      const finishItems = (): MsgPlayerInput => {
        if (actor.roleDisguise) input.fire = false;
        if (input.useItem === 0) input.useItem = petInjectionHotkey(actor);
        if (input.useItem === 0) input.useItem = invincibilityHotkey(actor,
          enemies.some(enemy => distance(enemy) <= 300));
        if (input.useItem === 0) input.useItem = roleDisguiseHotkey(actor,
          enemies.some(enemy => distance(enemy) <= 300), input.fire);
        if (input.useItem === 0) input.useItem = opticalCamouflageHotkey(actor,
          enemies.some(enemy => distance(enemy) <= 300));
        if (input.useItem === 0) input.useItem = defenseDrinkHotkey(actor,
          enemies.some(enemy => distance(enemy) <= 500));
        if (input.useItem === 0) input.useItem = teamLifeHotkey(actor, teamLife);
        if (input.useItem === 0 && buildingToolRoom) {
          input.useItem = buildingToolHotkey(combatCatalog, actor.inventory, actor, buildingToolRoom);
        }
        // Only a legal visible enemy inside the 200x200 blast centre qualifies.
        if (input.useItem === 0) {
          const airstrikeThreat = enemies.some(enemy => enemy.combat?.status === 2 &&
            Math.abs(enemy.x - actor.x) <= 100 && Math.abs(enemy.z - actor.z) <= 100);
          input.useItem = airstrikeHotkey(actor, airstrikeThreat, input.fire);
        }
        if (input.useItem === 0) input.useItem = attackDrinkHotkey(actor, input.fire && actor.fireReady === true);
        if (input.useItem === 0 && input.move !== 0 && actor.movementReady === true) {
          const predicted = actor.movement?.predict(input);
          const moving = !!predicted && Math.hypot(predicted.x - actor.x, predicted.z - actor.z) > .0001;
          input.useItem = speedDrinkHotkey(actor, moving);
        }
        if (input.useItem === 0 && input.turn !== 0 && actor.movementReady === true) {
          const predicted = actor.movement?.predict(input);
          const turning = !!predicted && Math.abs(angle(predicted.yaw - actor.yaw)) > .000001;
          input.useItem = turnDrinkHotkey(actor, turning);
        }
        if (input.useItem === 0) input.useItem = finiteAmmoHotkey(actor, input.fire && actor.fireReady === true);
        return input;
      };
      if (!target) return finishItems();
      // World applies body turn, turret turn and movement before firing.
      const native = actor.movement?.predict(input);
      const yaw = native?.yaw ?? actor.yaw + input.turn * actor.tank.turn * .12 * dt;
      const forward = Math.sign(input.move) * actor.tank.speed * 6 * dt;
      const position = native ?? (forward === 0 ? actor : field.move(actor, {
        x: actor.x + Math.sin(yaw) * forward, y: actor.y,
        z: actor.z + Math.cos(yaw) * forward,
      }, 20));
      const bearing = Math.atan2(target.x - position.x, target.z - position.z);
      const error = angle(bearing - yaw - actor.aim);
      input.aim = aimStep > 0 ? Math.max(-1, Math.min(1, error / aimStep)) : 0;
      const shotAngle = yaw + actor.aim + input.aim * aimStep;
      input.fire &&= Math.abs(angle(bearing - shotAngle)) < .06;
      if (input.fire && source) {
        input.fire = canShootSource(position, shotAngle, source, field, actors, actor.id);
      }
      if (mode === 5 && input.fire && !this.repositionDestroy && !this.escapePoint) {
        this.ineffectiveFireSeconds += dt;
      }
      return finishItems();
    };
    const navigationTargetId = capture?.id ?? target?.id;
    if (this.targetId !== navigationTargetId) {
      this.targetId = navigationTargetId; this.path = []; this.goal = undefined;
      this.planner = undefined; this.nextPlan = 0;
      this.observedTargetHp = undefined; this.ineffectiveFireSeconds = 0;
      this.repositionDestroy = false;
      this.previousPosition = undefined; this.requestedMovement = false; this.blockedMovementSeconds = 0;
      this.escapePoint = undefined;
    }
    if (this.escapePoint && distance(this.escapePoint) < 7) {
      this.escapePoint = undefined; this.goal = undefined; this.path = []; this.nextPlan = 0;
    }
    if (this.requestedMovement && this.previousPosition
        && Math.hypot(actor.x - this.previousPosition.x, actor.z - this.previousPosition.z) < .05) {
      this.blockedMovementSeconds += dt;
    } else this.blockedMovementSeconds = 0;
    this.previousPosition = {x: actor.x, y: actor.y, z: actor.z};
    this.requestedMovement = false;
    if (this.blockedMovementSeconds >= 2 && target && !capture) {
      // A traversable route can still be blocked when steering clips a corner.
      // Retry another approach using observed movement, without bypassing collision.
      this.failedApproaches.set(target.id, (this.failedApproaches.get(target.id) ?? 0) + 1);
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
      this.repositionDestroy = mode === 5;
      this.blockedMovementSeconds = 0;
      const escapes: Point[] = [];
      for (let step = 0; step < 16; step++) {
        const bearing = step * Math.PI / 8;
        const desired = {x: actor.x + Math.sin(bearing) * 36, y: actor.y,
          z: actor.z + Math.cos(bearing) * 36};
        const reached = reach(actor, desired);
        if (Math.hypot(reached.x - desired.x, reached.z - desired.z) < .01) escapes.push(reached);
      }
      escapes.sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z)
        - Math.hypot(b.x - target.x, b.z - target.z));
      this.escapePoint = escapes[0];
    }
    let goal: Point | undefined = capture ?? this.escapePoint ?? target;
    let friendly = false;
    if (target) {
      const bearing = Math.atan2(target.x - actor.x, target.z - actor.z);
      const error = angle(bearing - actor.yaw - actor.aim);
      input.aim = aimStep > 0 ? Math.max(-1, Math.min(1, error / aimStep)) : 0;
      const muzzle = {x: actor.x + Math.sin(bearing) * 30, y: actor.y + 20,
        z: actor.z + Math.cos(bearing) * 30};
      const end = {...target, y: mode === 5 ? actor.y + 20 : target.y + 20};
      const wall = source ? undefined : field.firstSurfaceHit({...actor, y: muzzle.y}, end, 1);
      friendly = mode <= 3 && actors.some(other => other.id !== actor.id && other.alive
        && other.team === actor.team && blocksShot(muzzle, end, other));
      const visible = (source ? canShootSource(actor, bearing, source, field, actors, actor.id) : !wall && distance(target) < 700)
        && (mode === 5 || Math.abs(actor.y - target.y) < 18);
      input.fire = !actor.roleDisguise && visible && Math.abs(error) < .06 && !friendly;
      // Rebuilt VIP survival: create aiming time using ordinary collision-tested
      // movement rather than parking within an enemy's firing range while hurt.
      if (mode === 3 && actor.vip && actor.hp !== undefined && actor.maxHp !== undefined
          && actor.hp < actor.maxHp && visible && distance(target) < 330 && Math.abs(error) >= .06) {
        const evasion = vipEvasion(actor, enemies, bearing, input, field, dt);
        if (evasion) {
          Object.assign(input, evasion);
          this.requestedMovement = true;
          return finishInput();
        }
      }
      if (this.repositionDestroy && this.goal && !this.planner && distance(this.goal) < 7) {
        this.repositionDestroy = false;
      }
      const changingDestroyPosition = mode === 5 && this.repositionDestroy;
      if (!capture && !this.escapePoint && visible && !friendly && distance(target) < 330 && !changingDestroyPosition) goal = undefined;
      if (mode === 5 && 'hp' in target) {
        if (this.observedTargetHp !== target.hp) this.ineffectiveFireSeconds = 0;
        this.observedTargetHp = target.hp;
        // A clear terrain ray does not prove bullets hit the source object's OBB.
        // Use ordinary target HP feedback to try another firing position.
        if (this.ineffectiveFireSeconds >= 5) {
          this.failedApproaches.set(target.id, (this.failedApproaches.get(target.id) ?? 0) + 1);
          this.ineffectiveFireSeconds = 0;
          this.repositionDestroy = true;
          this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
          goal = target;
        }
      }
    }
    const failed = target ? this.failedApproaches.get(target.id) ?? 0 : 0;
    const approach = !capture && target && (mode === 5 || friendly || failed > 0);
    // Destroy objects stay fixed. Keep a usable route until it is consumed;
    // movement and damage feedback already release blocked firing approaches.
    const keepDestroyRoute = mode === 5 && this.path.length > 0 && this.goal !== undefined;
    if (approach && goal && !this.escapePoint) {
      // Choose a walkable firing point around blocked targets or friendly rays.
      if (!this.planner && (!this.goal || (now >= this.nextPlan && !keepDestroyRoute))) {
        const candidates: Point[] = [];
        for (const radius of mode === 5 ? [100, 180, 280] : [180, 280]) {
          for (let step = 0; step < 16; step++) {
            const a = step * Math.PI / 8;
            const x = target.x + Math.sin(a) * radius, z = target.z + Math.cos(a) * radius;
            const cell = field.navigation.sample(x, z);
            if (!cell?.valid) continue;
            const candidate = {x, y: cell.height, z};
            if (actor.movement && !actor.movement.navigation.canTraverse(
                {x: x - Math.sin(a) * 6, y: cell.height, z: z - Math.cos(a) * 6}, candidate)) continue;
            if (mode === 5 ? Math.abs(candidate.y + 20 - target.y) > 50
              : Math.abs(candidate.y - target.y) >= 18) continue;
            const endpoint = {...target, y: mode === 5 ? candidate.y + 20 : target.y + 20};
            const origin = {...candidate, y: candidate.y + 20};
            const wall = field.firstSurfaceHit(origin, endpoint, 1);
            if (wall && wall.boxId !== `SCN:${source?.id}`) continue;
            if (source && segmentBox(origin, endpoint, source, 1) === undefined) continue;
            if (mode <= 3 && actors.some(other => other.id !== actor.id && other.alive
              && other.team === actor.team && blocksShot(origin, endpoint, other))) continue;
            candidates.push(candidate);
          }
        }
        candidates.sort((a, b) => distance(a) - distance(b));
        // The first failed chase switches to firing positions; subsequent failed
        // positions try the next candidate instead of repeating the same route.
        goal = candidates[mode === 5 || friendly ? failed : Math.max(0, failed - 1)];
        if (!goal) {
          this.unavailableUntil.set(target.id, now + 8000);
          this.failedApproaches.delete(target.id);
        }
      } else goal = this.goal;
    }
    if (capture && distance(capture) < capture.radius * .45) goal = undefined;
    if (!goal) {this.path = []; this.goal = undefined; this.planner = undefined; return finishInput();}
    if (!this.planner && ((now >= this.nextPlan && !keepDestroyRoute) || !this.goal || Math.hypot(goal.x - this.goal.x, goal.z - this.goal.z) > 60)) {
      this.planner = new BotPathPlanner(field, actor, goal, actor.movement?.navigation ?? 20);
      this.planStartedAt = now;
      this.goal = {...goal};
    }
    if (this.planner) {
      const planned = this.planner.advance();
      if (planned !== undefined) {
        this.path = planned; this.planner = undefined;
        this.nextPlan = now + (planned.length ? 2500 : capture ? 8000 : 0);
        if (!planned.length && target && !capture) {
          this.failedApproaches.set(target.id, failed + 1);
          if (mode === 5) this.repositionDestroy = true;
          this.goal = undefined;
        }
      } else if (!this.path.length && now - this.planStartedAt >= 8000 && target && !capture) {
        // An unfinished search is not proof that the target is unreachable.
        // Give other targets a turn, then retry a different firing position.
        this.planner = undefined; this.goal = undefined; this.nextPlan = 0;
        this.failedApproaches.set(target.id, failed + 1);
        this.unavailableUntil.set(target.id, now + 8000);
        if (mode === 5) this.repositionDestroy = true;
      }
    }
    while (this.path.length && distance(this.path[0]) < 7) {
      const next = this.path[1];
      if (next) {
        const reached = reach(actor, next);
        // Near a bend, dropping the waypoint can cut across a collision corner.
        if (Math.hypot(reached.x - next.x, reached.z - next.z) >= .01) break;
      }
      this.path.shift();
    }
    let waypoint = this.path[0];
    if (!waypoint && this.planner && mode === 5 && this.goal) {
      // A pending full route need not keep the tank at its old search origin.
      // Follow only the prefix accepted by the authoritative collision sweep.
      const reached = reach(actor, this.goal);
      if (distance(reached) >= 7) waypoint = reached;
    }
    if (!waypoint) {
      if (friendly && target && !capture && !this.planner) {
        this.failedApproaches.set(target.id, failed + 1);
        this.goal = undefined; this.nextPlan = now;
      }
      return finishInput();
    }
    const turn = angle(Math.atan2(waypoint.x - actor.x, waypoint.z - actor.z) - actor.yaw);
    input.turn = Math.max(-1, Math.min(1, turn / ((actor.movement?.turn ?? actor.tank.turn * .12) * Math.max(dt, .001))));
    // Native commands are discrete: analog fractions do not reduce turn speed.
    // Choose the nearest heading rather than alternating full turns forever.
    if (actor.movement && Math.abs(turn) < actor.movement.turn * dt * .5) input.turn = 0;
    input.move = Math.abs(turn) < .25 ? Math.min(1, distance(waypoint) / ((actor.movement?.speed ?? actor.tank.speed * 6) * dt)) : 0;
    if (actor.movement && input.move > 0) {
      const predicted = actor.movement.predict(input);
      if (Math.hypot(predicted.x - actor.x, predicted.z - actor.z) < .05) {
        // Arc fallback may turn without translating; try ordinary straight input
        // first, and retain observed blocking feedback if it too cannot advance.
        const straight = actor.movement.predict({...input, turn: 0});
        if (Math.hypot(straight.x - actor.x, straight.z - actor.z) >= .05) input.turn = 0;
      }
    }
    if (actor.movement && (input.move !== 0 || input.turn !== 0)) {
      const predicted = actor.movement.predict(input);
      if (Math.hypot(predicted.x - actor.x, predicted.z - actor.z) < .05
          && Math.abs(angle(predicted.yaw - actor.yaw)) < .0001) {
        // An original dynamic gate may reject both forward and turning. Request
        // an ordinary reverse step only when the same gate/NAV preview allows it.
        const reverse = actor.movement.predict({...input, move: -1, turn: 0});
        if (Math.hypot(reverse.x - actor.x, reverse.z - actor.z) >= .05) {
          input.move = -1;
          input.turn = 0;
        }
      }
    }
    this.requestedMovement = Math.abs(input.move) > .1;
    return finishInput();
  }
}

function angle(value: number): number {return Math.atan2(Math.sin(value), Math.cos(value));}
function canShootSource(position: Point, heading: number, source: SceneBreakable, field: Battlefield,
  actors: readonly BotActor[], ownerId: string): boolean {
  const muzzle = {x: position.x + Math.sin(heading) * 30, y: position.y + 20,
    z: position.z + Math.cos(heading) * 30};
  const end = {x: muzzle.x + Math.sin(heading) * 792, y: muzzle.y,
    z: muzzle.z + Math.cos(heading) * 792};
  const hit = segmentBox(muzzle, end, source, 1);
  const wall = field.firstSurfaceHit(muzzle, end, 1);
  const blocked = hit !== undefined && actors.some(other => {
    if (!other.alive || other.id === ownerId) return false;
    const body = segmentSphere(muzzle, end, {...other, y: other.y + 20}, 20);
    return body !== undefined && body <= hit;
  });
  return hit !== undefined && (!wall || hit < wall.fraction || wall.boxId === `SCN:${source.id}` && hit === wall.fraction)
    && !blocked && !field.firstSurfaceHit({...position, y: muzzle.y}, muzzle, 1);
}
function blocksShot(start: Point, end: Point, ally: Point): boolean {
  const dx = end.x - start.x, dz = end.z - start.z;
  const t = ((ally.x - start.x) * dx + (ally.z - start.z) * dz) / (dx * dx + dz * dz);
  return t > 0 && t < 1 && Math.hypot(start.x + t * dx - ally.x, start.z + t * dz - ally.z) < 24;
}
