import {defaultAmmoId} from '../../../../shared/content/catalog';
import type {TrapFireRestraintState} from '../items/trap-fire-restraint';
import type {TrapTurnRestraintState} from '../items/trap-turn-restraint';
import type {GroundTrapSnapshot, MsgPlayerInput, ObjectiveSnapshot} from '../../../../shared/protocols';
import {segmentBox, segmentSphere, type Battlefield, type Point} from '../../battlefield';
import type {BotNavigationPolicy} from './navigation';
import {BotPathPlanner} from './navigation';
import {vipEvasion} from './vip-evasion';
import {getSceneBreakables, getSceneCastles, type SceneBreakable} from '../../scene-objects';
import {defaultMovementParameters} from '../movement-parameters';
import {roleMovementElapsed} from '../roles/movement-time';
import {queryShotTarget} from '../shot-query';
import {combatCatalog} from '../catalog';
import {buildingToolHotkey} from './building-tool';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import type {AmmoBurnState} from '../items/ammo-burn';
import type {AmmoRadarJamState} from '../items/ammo-radar-jam';
import type {AmmoSlowState} from '../items/ammo-slow';
import type {TrapRestraintState} from '../items/trap-restraint';
import type {OpticalCamouflageState} from '../items/optical-camouflage';
import type {RoleDisguiseState} from '../items/role-disguise';
import {isHiddenFromOpponent} from '../../../../shared/combat/optical-camouflage';
import {hasFixedTurret, tankTurretYaw} from '../../../../shared/combat/tank-turret';
import {petInjectionHotkey, finiteAmmoHotkey, healingHotkey, treasureHotkey, defenseDrinkHotkey, attackDrinkHotkey, speedDrinkHotkey, invincibilityHotkey, opticalCamouflageHotkey, roleDisguiseHotkey, turnDrinkHotkey, teamLifeHotkey, airstrikeHotkey, type TeamLifeContext} from './items';
import {trapPlacementHotkey, trapSweepHotkey} from './traps';
import {BOT_BEHAVIORS, randomBotDelay, randomBotGaussian, type BotSkill} from './behavior';
import {tankRouteClear, teammateAvoidancePoint, teammateEscapeClear, teammateInWay, teammateWaypointClear} from './teammate-avoidance';
import {TacticalPlanner, type TacticalIntent} from './tactical';
import {BotBreachPlanner} from './breaching';
import {BotRecovery} from './recovery';
import {ARRIVAL_RADIUS, DrivePlanner, probe, type DriveRequest} from './driving';

export interface BotActor extends Point {
  id: string;
  team: number;
  yaw: number;
  bodyYaw?: number;
  aim: number;
  movement?: {speed: number; turn: number; navigation: BotNavigationPolicy;
    predict(input: MsgPlayerInput): Point & {yaw: number; bodyYaw?: number};
    rollout(input: MsgPlayerInput, steps: number, elapsed: number): (Point & {yaw: number; bodyYaw?: number})[]};
  alive: boolean;
  deaths?: number;
  vip: boolean;
  tank: {id?: number; speed: number; turn: number};
  cpu?: {readonly objectiveTargetId: string | undefined; readonly teammateWaypoint?: Point;
    readonly teammateNeedsRoom?: boolean};
  autopilot?: {readonly objectiveTargetId: string | undefined; readonly teammateWaypoint?: Point;
    readonly teammateNeedsRoom?: boolean};
  hp?: number;
  maxHp?: number;
  fireReady?: boolean;
  movementReady?: boolean;
  attributesReady?: boolean;
  burn?: AmmoBurnState;
  radarJam?: AmmoRadarJamState;
  ammoSlow?: AmmoSlowState;
  trapRestraint?: TrapRestraintState;
  trapTurnRestraint?: TrapTurnRestraintState;
  trapFireRestraint?: TrapFireRestraintState;
  opticalCamouflage?: OpticalCamouflageState;
  roleDisguise?: RoleDisguiseState;
  inventory?: readonly BattleItemRecord[];
  combat?: {status?: number; currentAmmoTableId?: number; selectedAmmoSlot?: number; bulletCount?: number;
    getFlag?(index: number): number;
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
  private targetSelectedAt = 0;
  private nextTargetReview = 0;
  private targetChangeReason = 'INITIAL';
  private observedTargetHp?: number;
  private ineffectiveFireSeconds = 0;
  private repositionDestroy = false;
  private previousPosition?: Point;
  private requestedMovement = false;
  private blockedMovementSeconds = 0;
  private escapePoint?: Point;
  private escapeOrigin?: Point;
  private combatWaypoint?: Point;
  private previousCombatPosition?: {point: Point; until: number};
  private retreatThreatId?: string;
  private nextRetreatPlan = 0;
  private targetSeenAt = Number.NEGATIVE_INFINITY;
  private combatDirection = 1;
  private nextCombatMove = 0;
  private avoidancePoint?: Point;
  private previousYieldPosition?: {point: Point; until: number};
  private nextTeammateMove = 0;
  private observedDeaths?: number;
  private recentDamage?: {attackerId: string; at: number};
  private readonly failedApproaches = new Map<string, number>();
  private readonly unavailableUntil = new Map<string, number>();
  private reaction?: {targetId: string; readyAt: number; lastSeenAt: number; triggerAt?: number};
  private aimError?: {targetId: string; offset: number; at: number};
  private readonly tactical = new TacticalPlanner();
  private readonly breaching = new BotBreachPlanner();
  private readonly recovery = new BotRecovery();
  private readonly drive = new DrivePlanner();
  private traceNow = 0;
  private traceIntent?: TacticalIntent;
  private traceVisible = false;
  private traceAttackId?: string;
  private traceMovementReady = false;
  private traceMove = 0;
  private targetChanges = 0;
  private driveReversals = 0;
  private traceDriveSource = 'IDLE';

  constructor(readonly skill: BotSkill = 'MEDIUM') {}

  /** Keep round skill through respawns while discarding an old firing confirmation. */
  resetReaction(): void {
    this.reaction = undefined;
    this.aimError = undefined;
  }

  /** A newly engaged tank is first aimed slightly off; the error settles while tracking. */
  private aimOffset(targetId: string, now: number, scale = 1): number {
    const behavior = BOT_BEHAVIORS[this.skill];
    if (this.aimError?.targetId !== targetId || scale !== 1) {
      this.aimError = {targetId, offset: randomBotGaussian() * behavior.aimError * scale, at: now};
    }
    return this.aimError.offset * Math.exp(-(now - this.aimError.at) / 1000 / behavior.aimSettleSeconds);
  }

  noticeDamage(attackerId: string, now: number): void {
    this.recentDamage = {attackerId, at: now};
  }

  private observeTarget(targetId: string, visible: boolean, now: number): boolean {
    if (this.reaction?.targetId !== targetId) this.resetReaction();
    if (!visible) {
      if (this.reaction && now - this.reaction.lastSeenAt >= 750) this.resetReaction();
      return this.reaction !== undefined && now >= this.reaction.readyAt;
    }
    if (!this.reaction || now - this.reaction.lastSeenAt >= 750) {
      this.reaction = {targetId, readyAt: now + randomBotDelay(BOT_BEHAVIORS[this.skill].reactionMs),
        lastSeenAt: now};
    } else this.reaction.lastSeenAt = now;
    return now >= this.reaction.readyAt;
  }

  private confirmShot(aiming: boolean, ready: boolean, now: number): boolean {
    if (!this.reaction) return false;
    if (!ready) {
      this.reaction.triggerAt = undefined;
      return false;
    }
    // Once the trigger is committed, aim drift or a crossing obstacle can spoil the shot.
    if (this.reaction.triggerAt === undefined) {
      if (!aiming) return false;
      this.reaction.triggerAt = now + randomBotDelay(BOT_BEHAVIORS[this.skill].triggerMs);
    }
    if (now < this.reaction.triggerAt) return false;
    this.reaction.triggerAt = undefined;
    return true;
  }

  /** Current intent for CPU coordination; deferred targets are available to others. */
  get objectiveTargetId(): string | undefined {
    return this.targetId && !this.unavailableUntil.has(this.targetId) ? this.targetId : undefined;
  }

  /** Reserve the position being approached without changing world movement. */
  get teammateWaypoint(): Point | undefined {
    return this.avoidancePoint ?? this.breaching.waypoint ?? this.combatWaypoint
      ?? this.path[0] ?? this.escapePoint ?? this.goal;
  }

  /** Ask a priority owner to help when its teammate cannot clear the lane alone. */
  get teammateNeedsRoom(): boolean {
    return this.recovery.stalledSeconds >= 1.25;
  }

  /** Read only when the room recorder samples; do not run navigation queries. */
  traceState() {
    const point = (value: Point | undefined) => value
      ? {x: value.x, y: value.y, z: value.z} : undefined;
    return {policyRevision: 35, skill: this.skill, intent: this.traceIntent,
      driveSource: this.traceDriveSource, targetId: this.targetId,
      travelDirection: this.drive.travelDirection,
      reverseSeconds: this.drive.reverseSeconds(this.traceNow),
      driveStuckSeconds: this.drive.stuckSeconds(this.traceNow),
      recentDamage: this.recentDamage,
      attackId: this.traceAttackId, targetVisible: this.traceVisible,
      movementReady: this.traceMovementReady, targetChanges: this.targetChanges,
      targetSelectedAt: this.targetSelectedAt, targetChangeReason: this.targetChangeReason,
      driveReversals: this.driveReversals, searching: !!this.planner,
      breachSearching: this.breaching.searching, breachWorking: this.breaching.working,
      localBreachSelections: this.breaching.localSelectionCount,
      recovering: this.drive.stuckSeconds(this.traceNow) >= 1.5, stalledSeconds: this.recovery.stalledSeconds,
      recoveryReplans: this.recovery.replanCount, recoveryReason: this.recovery.replanReason,
      routeStalledSeconds: this.recovery.routeStalledSeconds,
      blockedSeconds: this.blockedMovementSeconds, pathLength: this.path.length,
      path: this.path.slice(0, 4).map(value => point(value)!), goal: point(this.goal),
      waypoint: point(this.teammateWaypoint), avoidance: point(this.avoidancePoint),
      escape: point(this.escapePoint), escapeOrigin: point(this.escapeOrigin),
      combatWaypoint: point(this.combatWaypoint),
      retreatThreatId: this.retreatThreatId};
  }

  input(actor: BotActor, actors: readonly BotActor[], objectives: readonly ObjectiveSnapshot[],
    field: Battlefield, mode: number, now: number, dt: number,
    teamLife?: TeamLifeContext, buildingToolRoom?: Parameters<typeof buildingToolHotkey>[3]
      & {groundTraps?: readonly GroundTrapSnapshot[]}): MsgPlayerInput {
    const reach = (start: Point, end: Point) => actor.movement
      ? actor.movement.navigation.reachable(start, end) : field.move(start, end, 20);
    if (this.navigationRevision !== field.navigationRevision) {
      this.navigationRevision = field.navigationRevision;
      // A released gate can connect cells already closed by an older search.
      this.planner = undefined;
      this.failedApproaches.clear();
      this.unavailableUntil.clear();
      let previous: Point = actor;
      if (this.path.some(point => {
        const reached = reach(previous, point);
        previous = point;
        return Math.hypot(reached.x - point.x, reached.z - point.z) >= .01;
      })) this.path = [];
      this.nextPlan = 0;
      if (!this.planner && !this.path.length) this.goal = undefined;
      if (this.combatWaypoint) {
        const reached = reach(actor, this.combatWaypoint);
        if (Math.hypot(reached.x - this.combatWaypoint.x, reached.z - this.combatWaypoint.z) >= .01) {
          this.combatWaypoint = undefined;
        }
      }
      if (!this.combatWaypoint) this.nextCombatMove = 0;
    }
    const input: MsgPlayerInput = {sequence: ++this.sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: this.sequence === 1 ? 1 : 0, clientTime: now};
    this.traceDriveSource = 'IDLE';
    this.traceNow = now;
    const parameters = actor.movement ?? defaultMovementParameters(actor.tank);
    const spacing = combatSpacing(actor);
    const behavior = BOT_BEHAVIORS[this.skill];
    const fixedTurret = hasFixedTurret(actor.tank.id);
    const aimStep = fixedTurret ? 0 : parameters.turn * roleMovementElapsed(dt);
    const aimTolerance = fixedTurret
      ? Math.max(behavior.aimTolerance, parameters.turn * roleMovementElapsed(dt) * .5)
      : behavior.aimTolerance;
    const newLife = this.observedDeaths !== undefined && actor.deaths !== undefined
      && actor.deaths !== this.observedDeaths;
    this.observedDeaths = actor.deaths;
    if (!actor.alive || newLife) {
      input.useItem = 0;
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
      this.targetId = undefined; this.failedApproaches.clear(); this.unavailableUntil.clear();
      this.observedTargetHp = undefined; this.ineffectiveFireSeconds = 0;
      this.repositionDestroy = false;
      this.previousPosition = undefined; this.requestedMovement = false; this.blockedMovementSeconds = 0;
      this.escapePoint = undefined; this.escapeOrigin = undefined;
      this.combatWaypoint = undefined; this.nextCombatMove = 0;
      this.previousCombatPosition = undefined;
      this.retreatThreatId = undefined;
      this.avoidancePoint = undefined; this.nextTeammateMove = 0;
      this.previousYieldPosition = undefined;
      this.drive.reset();
      this.recentDamage = undefined;
      this.breaching.reset();
      this.recovery.reset();
      this.resetReaction();
      return input;
    }
    if (actor.roleDisguise) input.fire = false;
    input.useItem = healingHotkey(actor) || input.useItem;
    input.useItem = treasureHotkey(actor) || input.useItem;
    const distance = (point: Point) => Math.hypot(point.x - actor.x, point.z - actor.z);
    const teammates = mode <= 3 ? actors.filter(other => other.alive
      && other.id !== actor.id && other.team === actor.team) : [];
    this.recovery.observe(actor, now);
    if (actor.combat?.getFlag?.(9) === 0) {
      // A trap that forbids translation is not a blocked route; restart progress afterwards.
      this.previousPosition = undefined;
      this.requestedMovement = false;
      this.blockedMovementSeconds = 0;
      this.drive.idle();
    }
    const recoveryReplan = this.recovery.takeReplan();
    // Minimap contacts are global. Distance limits below apply to firing, not acquisition.
    const enemies = actors.filter(other => other.alive && other.id !== actor.id
      && (mode >= 4 || other.team !== actor.team)
      && !isHiddenFromOpponent(other, actor, mode));
    const assignments = new Map<string, number>();
    for (const other of actors) {
      if (other.id === actor.id || !other.alive || other.team !== actor.team) continue;
      const id = (other.cpu ?? other.autopilot)?.objectiveTargetId;
      if (id) assignments.set(id, (assignments.get(id) ?? 0) + 1);
    }
    const claimed = new Set(assignments.keys());
    const nearestEnemy = Math.min(...enemies.map(distance));
    const pursuitBand = (enemy: BotActor) => distance(enemy) < spacing.minimum ? 0
      : distance(enemy) <= nearestEnemy + 160 ? 1 : 2;
    enemies.sort((a, b) => (mode === 3 ? Number(b.vip) - Number(a.vip) : 0)
      || pursuitBand(a) - pursuitBand(b)
      || (mode <= 3 ? (assignments.get(a.id) ?? 0) - (assignments.get(b.id) ?? 0) : 0)
      || distance(a) - distance(b));
    const mapId = Number(field.source.id);
    const castleTargets = mode === 2 ? objectives.filter(objective => {
      if (objective.kind !== 'CAPTURE' || objective.hp <= 0 || objective.maxHp <= 0
          || (objective.ownerTeam !== 0 && objective.ownerTeam !== 1)
          || objective.ownerTeam === actor.team
          || objective.sourcePlacementId === undefined || objective.sourceModel === undefined) return false;
      return getSceneCastles(mapId).some(source => source.id === objective.sourcePlacementId
        && source.model === objective.sourceModel && source.affiliation === objective.ownerTeam + 1);
    }) : [];
    const objectiveTargets = mode === 5 ? objectives.filter(o => o.hp > 0) : castleTargets;
    const targets: readonly (BotActor | ObjectiveSnapshot)[] = mode === 2 || mode === 5
      ? objectiveTargets.sort((a, b) =>
        Number(claimed.has(a.id)) - Number(claimed.has(b.id)) || distance(a) - distance(b)) : enemies;
    for (const [id, until] of this.unavailableUntil) {
      if (now >= until) this.unavailableUntil.delete(id);
    }
    const readyTargets = targets.filter(target => !this.unavailableUntil.has(target.id));
    // Keep pursuing a map contact when every candidate has a failed approach.
    const available = readyTargets.length ? readyTargets : targets;
    // Work on a reachable firing line before committing to a route around a wall.
    // The existing order still distributes equally shootable work among teammates.
    const preferred = (mode === 2 || mode === 5 ? available.find((objective): objective is ObjectiveSnapshot => {
      if (!('kind' in objective) || objective.sourcePlacementId === undefined) return false;
      const box = objectiveSource(objective, mapId, mode);
      if (!box) return false;
      const bearing = Math.atan2(objective.x - actor.x, objective.z - actor.z);
      return canShootSource(actor, bearing, box, field, actors, actor.id);
    }) : undefined) ?? available[0];
    const current = available.find(candidate => candidate.id === this.targetId);
    let target = current ?? preferred;
    let targetReason = current ? 'RETAINED'
      : !this.targetId ? 'INITIAL'
        : targets.some(candidate => candidate.id === this.targetId) ? 'DEFERRED' : 'INVALID';
    const urgentVip = mode === 3 && preferred && 'vip' in preferred && preferred.vip
      && current && 'vip' in current && !current.vip;
    if (this.recentDamage && now - this.recentDamage.at > 5000) this.recentDamage = undefined;
    const shotActors = new Map(actors.map(other => [other.id, other]));
    const exposed = (other: Point & {id: string}) => {
      if (distance(other) >= 700 || Math.abs(other.y - actor.y) >= 18) return false;
      const bearing = Math.atan2(other.x - actor.x, other.z - actor.z);
      const shot = queryShotTarget(actor, {x: Math.sin(bearing), y: 0, z: Math.cos(bearing)},
        shotActors, field, 20, undefined,
        (actor.combat?.currentAmmoTableId ?? defaultAmmoId()) === defaultAmmoId());
      return shot.kind === 'PLAYER' && shot.targetId === other.id;
    };
    const attacker = mode !== 2 && mode !== 5 && this.recentDamage
      ? enemies.find(enemy => enemy.id === this.recentDamage!.attackerId && exposed(enemy)) : undefined;
    if (urgentVip) {target = preferred; targetReason = 'VIP';}
    else if (attacker && attacker.id !== current?.id && (!current || !exposed(current)
        || now - this.targetSelectedAt >= 2500 && (
          distance(attacker) < spacing.minimum && distance(current) > distance(attacker) + 80
          || distance(attacker) < 400 && distance(current) > spacing.preferred + 80
            && distance(current) > distance(attacker) + 160))) {
      target = attacker; targetReason = 'ATTACKER';
    }
    else if (current && preferred && preferred.id !== current.id
        && now - this.targetSelectedAt >= 2500 && now >= this.nextTargetReview) {
      this.nextTargetReview = now + 1500;
      const working = this.planner || this.path.length || this.escapePoint || this.combatWaypoint
        || this.avoidancePoint || this.drive.stuckSeconds(now) >= 1.5 || this.breaching.working
        || mode === 5 && !claimed.has(current.id);
      const nearer = distance(preferred) + 160 < distance(current)
        && distance(preferred) < distance(current) * .7;
      const lessClaimed = mode <= 3
        && (assignments.get(current.id) ?? 0) >= (assignments.get(preferred.id) ?? 0) + 2
        && distance(preferred) <= distance(current) + 80
        && now - this.targetSelectedAt >= 6000;
      if (nearer && (!working || distance(preferred) < spacing.minimum)) {
        target = preferred; targetReason = 'NEARER';
      } else if (!working && lessClaimed) {
        target = preferred; targetReason = 'TEAM_ASSIGNMENT';
      }
    }
    if (this.targetId !== target?.id) {
      this.targetChanges++;
      this.targetSelectedAt = now;
      this.nextTargetReview = now + 2500;
      this.targetChangeReason = targetReason;
      this.targetId = target?.id; this.path = []; this.goal = undefined;
      this.targetSeenAt = Number.NEGATIVE_INFINITY;
      this.planner = undefined; this.nextPlan = 0;
      this.observedTargetHp = undefined; this.ineffectiveFireSeconds = 0;
      this.repositionDestroy = false;
      this.previousPosition = undefined; this.requestedMovement = false; this.blockedMovementSeconds = 0;
      // Passing and recovery destinations survive a change of opponent.
      this.combatWaypoint = undefined; this.nextCombatMove = 0;
      this.previousCombatPosition = undefined;
      this.resetReaction();
      this.combatDirection = actor.id.charCodeAt(actor.id.length - 1) % 2 === 0 ? 1 : -1;
    }
    const objectiveTarget = target && 'kind' in target ? target : undefined;
    const source = objectiveTarget ? objectiveSource(objectiveTarget, mapId, mode) : undefined;
    const canShoot = (position: Point, heading: number): boolean => {
      if (!target) return false;
      const distance = Math.hypot(target.x - position.x, target.z - position.z);
      const endpoint = {x: position.x + Math.sin(heading) * distance, y: position.y + 20,
        z: position.z + Math.cos(heading) * distance};
      if (teammates.some(other => blocksShot(position, endpoint, other))) return false;
      if (source) return canShootSource(position, heading, source, field, actors, actor.id);
      if (distance >= 700 || Math.abs(target.y - position.y) >= 18) return false;
      if (objectiveTarget) {
        const origin = {...position, y: position.y + 20};
        const endpoint = {...target, y: origin.y};
        return !field.firstSurfaceHit(origin, endpoint, 1) && !actors.some(other =>
          other.alive && other.id !== actor.id && blocksShot(origin, endpoint, other));
      }
      const shot = queryShotTarget({...position, id: actor.id},
        {x: Math.sin(heading), y: 0, z: Math.cos(heading)}, shotActors, field, 20,
        undefined, (actor.combat?.currentAmmoTableId ?? defaultAmmoId()) === defaultAmmoId());
      return shot.kind === 'PLAYER' && shot.targetId === target.id;
    };
    let breach = this.breaching.advance(actor, target,
      mode === 5 ? objectives : buildingToolRoom?.sceneObjects ?? [], field, now,
      this.recovery.stalledSeconds);
    if (recoveryReplan) {
      // Give an unfinished route its full search budget instead of restarting
      // it on each recovery timeout while the tank remains at the same corner.
      const keepSearch = !!this.planner && !this.path.length && !this.escapePoint;
      const blockedGoal = this.escapePoint ? target : this.goal ?? target;
      if (target && !keepSearch) {
        this.failedApproaches.set(target.id, (this.failedApproaches.get(target.id) ?? 0) + 1);
      }
      if (blockedGoal && !this.breaching.searching) {
        this.breaching.retry(blockedGoal);
        breach = undefined;
      }
      if (!keepSearch) {
        this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
        this.escapePoint = recoveryExit(actor, target, teammates, actors, reach,
          this.recovery.replanCount, this.drive.travelDirection, input, this.escapePoint);
        this.escapeOrigin = this.escapePoint ? {x: actor.x, y: actor.y, z: actor.z} : undefined;
      }
      this.combatWaypoint = undefined; this.avoidancePoint = undefined;
      this.nextTeammateMove = 0;
      this.blockedMovementSeconds = 0;
    }
    const targetVisible = !!target && canShoot(actor,
      Math.atan2(target.x - actor.x, target.z - actor.z));
    const tacticalIntent: TacticalIntent = this.tactical.decide({
      breach: !!breach,
      lowHealth: actor.hp !== undefined && actor.maxHp !== undefined
        && actor.maxHp > 0 && actor.hp <= actor.maxHp * .4,
      nearbyThreat: enemies.some(enemy => distance(enemy) <= spacing.preferred + 80),
      blocked: Math.max(this.blockedMovementSeconds, this.recovery.stalledSeconds) >= 1.25,
      objective: !!objectiveTarget,
      hasTarget: !!target,
      targetVisible,
    });
    this.traceIntent = tacticalIntent;
    this.traceVisible = targetVisible;
    this.traceAttackId = breach?.object.id ?? target?.id;
    this.traceMovementReady = actor.movementReady === true;
    let retreating = false;
    let request: DriveRequest | undefined;
    const finishInput = (): MsgPlayerInput => {
      const attackTarget = breach?.aim ?? target;
      const attackId = breach?.object.id ?? target?.id;
      const attackSource = breach?.source ?? source;
      if (breach) {
        this.traceDriveSource = 'BREACH';
        input.move = 0; input.turn = 0; input.fire = false;
        request = breach.object.hp > 0 && breach.path.length
          ? {mode: 'BREACH', route: breach.path, face: fixedTurret ? undefined : breach.aim} : undefined;
      }
      const finishItems = (): MsgPlayerInput => {
        if (actor.roleDisguise) input.fire = false;
        if (breach && input.useItem === 0 && actor.combat?.currentAmmoTableId !== undefined
            && actor.combat.currentAmmoTableId !== defaultAmmoId()) input.useItem = 1;
        if (input.useItem === 0) input.useItem = petInjectionHotkey(actor);
        const groundTraps = buildingToolRoom?.groundTraps;
        if (input.useItem === 0 && groundTraps) {
          input.useItem = trapSweepHotkey(actor, groundTraps, mode, now);
        }
        if (input.useItem === 0 && groundTraps) {
          input.useItem = trapPlacementHotkey(actor, enemies, groundTraps, now,
            this.escapePoint !== undefined || input.move < 0);
        }
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
        if (input.useItem === 0 && !breach) {
          input.useItem = finiteAmmoHotkey(actor, input.fire && actor.fireReady === true,
            !objectiveTarget);
        }
        const move = Math.sign(input.move);
        if (move !== 0) {
          if (this.traceMove !== 0 && move !== this.traceMove) this.driveReversals++;
          this.traceMove = move;
        }
        return input;
      };
      const passingRoute = this.breaching.waypoint ?? this.combatWaypoint ?? this.path[0] ?? this.escapePoint
        ?? request?.route[0] ?? (this.planner ? this.goal : undefined);
      if (this.avoidancePoint) {
        const reached = reach(actor, this.avoidancePoint);
        const passing = teammates.some(other => Math.abs(other.y - actor.y) < 24
          && distance(other) < 144) || teammateInWay(actor, passingRoute, teammates);
        if (distance(this.avoidancePoint) < ARRIVAL_RADIUS || !passing) {
          this.avoidancePoint = undefined;
          // Rejoin from the passing position rather than return to the crowded lane,
          // and drive on for a moment before considering another pass.
          this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
          this.nextTeammateMove = now + 1200;
          request = undefined;
        } else if (Math.hypot(reached.x - this.avoidancePoint.x, reached.z - this.avoidancePoint.z) >= .01
            || !teammateEscapeClear(actor, this.avoidancePoint, teammates)
            || !tankRouteClear(actor, this.avoidancePoint, actors)) this.avoidancePoint = undefined;
      }
      if (!this.avoidancePoint && now >= this.nextTeammateMove) {
        if (teammateInWay(actor, passingRoute, teammates)
            || this.blockedMovementSeconds >= 1.25 && teammates.some(other =>
              Math.abs(other.y - actor.y) < 24 && distance(other) < 144)) {
          this.avoidancePoint = teammateAvoidancePoint(actor, passingRoute, teammates, actors,
            this.combatDirection, reach, attackTarget ? point => {
              const bearing = Math.atan2(attackTarget.x - point.x, attackTarget.z - point.z);
              return attackSource ? canShootSource(point, bearing, attackSource, field, actors, actor.id)
                : canShoot(point, bearing);
            } : undefined, actor.movement ? point => probe(actor, point, input) : undefined,
            this.previousYieldPosition && now < this.previousYieldPosition.until
              ? this.previousYieldPosition.point : undefined);
          if (this.avoidancePoint) {
            this.previousYieldPosition = {point: {x: actor.x, y: actor.y, z: actor.z}, until: now + 4000};
          }
          this.nextTeammateMove = now + 250;
        }
      }
      if (this.avoidancePoint) {
        this.traceDriveSource = 'TEAMMATE_YIELD';
        request = {mode: 'YIELD', route: [this.avoidancePoint],
          face: targetVisible && !fixedTurret ? attackTarget : undefined};
      }
      if (request) this.drive.drive(actor, request, actors, now, input);
      else this.drive.idle();
      const movementWaypoint = this.avoidancePoint ?? this.breaching.waypoint
        ?? this.combatWaypoint ?? this.path[0] ?? this.escapePoint;
      const pursuing = retreating || !!movementWaypoint || !!target && !targetVisible && !breach;
      this.recovery.track(actor, pursuing || Math.abs(input.move) > .1, pursuing, now);
      // A blocked route counts as requested movement so the blocked-exit search still runs.
      this.requestedMovement = Math.abs(input.move) > .1 || !!request && this.drive.waiting;
      if (!attackTarget || !attackId || (breach && breach.object.hp <= 0)) {
        this.resetReaction();
        return finishItems();
      }
      if (fixedTurret && (breach || input.fire) && input.move === 0 && !this.path.length && !this.planner
          && !this.escapePoint && !this.combatWaypoint && !this.avoidancePoint && !this.repositionDestroy) {
        const bearing = Math.atan2(attackTarget.x - actor.x, attackTarget.z - actor.z);
        const error = angle(bearing - (actor.bodyYaw ?? actor.yaw));
        input.turn = Math.abs(error) < aimTolerance ? 0
          : Math.max(-1, Math.min(1, error / (parameters.turn * Math.max(dt, .001))));
      }
      if (!fixedTurret && input.move === 0 && input.turn === 0
          && !movementWaypoint && !this.planner && actor.movement
          && (targetVisible || breach && breach.object.hp > 0)) {
        const bearing = Math.atan2(attackTarget.x - actor.x, attackTarget.z - actor.z);
        const error = angle(bearing - tankTurretYaw(actor.tank.id, actor));
        if (Math.abs(error) > Math.max(aimTolerance, aimStep * 2)) {
          const turn = Math.sign(error);
          const predicted = actor.movement.predict({...input, turn});
          const nextError = angle(bearing - tankTurretYaw(actor.tank.id,
            {yaw: predicted.yaw, bodyYaw: predicted.bodyYaw, aim: actor.aim}));
          if (Math.abs(nextError) < Math.abs(error) - .000001) {
            input.turn = turn;
            this.traceDriveSource = 'AIM_ASSIST';
          }
        }
      }
      // World applies body turn, turret turn and movement before firing.
      const native = actor.movement?.predict(input);
      const yaw = native?.yaw ?? actor.yaw + input.turn * parameters.turn * dt;
      const bodyYaw = native?.bodyYaw ?? (actor.bodyYaw ?? actor.yaw) + input.turn * parameters.turn * dt;
      const forward = Math.sign(input.move) * parameters.speed * dt;
      const position = native ?? (forward === 0 ? actor : field.move(actor, {
        x: actor.x + Math.sin(yaw) * forward, y: actor.y,
        z: actor.z + Math.cos(yaw) * forward,
      }, 20));
      const bearing = Math.atan2(attackTarget.x - position.x, attackTarget.z - position.z);
      let visible: boolean;
      if (breach) {
        const shot = queryShotTarget({...position, id: actor.id},
          {x: Math.sin(bearing), y: 0, z: Math.cos(bearing)}, shotActors, field, 20, undefined, true);
        visible = shot.kind === 'SCENE' && field.isPlacementHit(shot.targetId, breach.source.id);
      } else if (attackSource) {
        visible = canShootSource(position, bearing, attackSource, field, actors, actor.id);
      } else {
        visible = canShoot(position, bearing);
      }
      const reacted = this.observeTarget(attackId, visible, now);
      // Obstructions and objectives are aimed exactly; tanks carry the settling aim error.
      const aimBearing = bearing + (breach || attackSource ? 0 : this.aimOffset(attackId, now));
      const error = angle(aimBearing - tankTurretYaw(actor.tank.id, {yaw, bodyYaw, aim: actor.aim}));
      input.aim = reacted && aimStep > 0 ? Math.max(-1, Math.min(1, error / aimStep)) : 0;
      const shotAngle = tankTurretYaw(actor.tank.id, {yaw, bodyYaw, aim: actor.aim}) + input.aim * aimStep;
      const shotDistance = Math.hypot(attackTarget.x - position.x, attackTarget.z - position.z);
      const shotEnd = {x: position.x + Math.sin(shotAngle) * shotDistance, y: position.y + 20,
        z: position.z + Math.cos(shotAngle) * shotDistance};
      const friendly = teammates.some(other => blocksShot(position, shotEnd, other));
      const aiming = reacted && !actor.roleDisguise && Math.abs(angle(aimBearing - shotAngle)) < aimTolerance;
      let clearShot = visible;
      if (breach && aiming) {
        const shot = queryShotTarget({...position, id: actor.id},
          {x: Math.sin(shotAngle), y: 0, z: Math.cos(shotAngle)}, shotActors, field, 20, undefined, true);
        clearShot = shot.kind === 'SCENE' && field.isPlacementHit(shot.targetId, breach.source.id);
      }
      input.fire = this.confirmShot(aiming,
        reacted && clearShot && !actor.roleDisguise && actor.fireReady === true && !friendly, now);
      // Recoil and the next reload leave a smaller error to correct before the following shot.
      if (input.fire && !breach && !attackSource) this.aimOffset(attackId, now, .6);
      if (mode === 5 && !breach && aiming && !this.repositionDestroy && !this.escapePoint) {
        this.ineffectiveFireSeconds += dt;
      }
      return finishItems();
    };
    if (this.goal && !(this.escapePoint ? teammateEscapeClear(actor, this.goal, teammates)
      : teammateWaypointClear(actor, this.goal, teammates))) {
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
    }
    if (this.escapePoint && (distance(this.escapePoint) < ARRIVAL_RADIUS
        || this.escapeOrigin && distance(this.escapeOrigin) >= 96)) {
      this.escapePoint = undefined; this.escapeOrigin = undefined;
      this.goal = undefined; this.path = []; this.planner = undefined; this.nextPlan = 0;
    }
    if (this.requestedMovement && this.previousPosition
        && Math.hypot(actor.x - this.previousPosition.x, actor.z - this.previousPosition.z) < .05) {
      this.blockedMovementSeconds += dt;
    } else this.blockedMovementSeconds = 0;
    this.previousPosition = {x: actor.x, y: actor.y, z: actor.z};
    this.requestedMovement = false;
    // A route the hull cannot follow, e.g. a gap that only admits an aligned
    // hull, shows as no route progress while the tank still shuffles about.
    const blocked = this.blockedMovementSeconds >= 2 || this.drive.stuckSeconds(now) >= 3;
    if (tacticalIntent === 'BREACH' && breach) {
      if (blocked && (breach.path.length || this.avoidancePoint)) {
        if (breach.path.length && target) this.breaching.retry(target);
        this.avoidancePoint = undefined; this.nextTeammateMove = 0;
        this.combatDirection *= -1;
        this.blockedMovementSeconds = 0;
        this.drive.idle();
      }
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
      this.escapePoint = undefined; this.combatWaypoint = undefined;
      this.repositionDestroy = false;
      return finishInput();
    }
    if (blocked && (target || teammates.length)
        && (!this.planner || this.path.length)) {
      // A traversable route can still be blocked when steering clips a corner.
      // Retry another approach using observed movement, without bypassing collision.
      if (target) this.failedApproaches.set(target.id, (this.failedApproaches.get(target.id) ?? 0) + 1);
      if (target) this.breaching.request(this.goal ?? target);
      this.path = []; this.goal = undefined; this.planner = undefined; this.nextPlan = 0;
      this.combatWaypoint = undefined;
      this.avoidancePoint = undefined; this.nextTeammateMove = 0;
      this.combatDirection *= -1;
      this.repositionDestroy = mode === 5;
      this.blockedMovementSeconds = 0;
      this.drive.idle();
      const escapes: Point[] = [];
      for (let step = 0; step < 16; step++) {
        const bearing = step * Math.PI / 8;
        const desired = {x: actor.x + Math.sin(bearing) * 36, y: actor.y,
          z: actor.z + Math.cos(bearing) * 36};
        const reached = reach(actor, desired);
        if (Math.hypot(reached.x - desired.x, reached.z - desired.z) < .01
            && teammateEscapeClear(actor, reached, teammates)
            && tankRouteClear(actor, reached, actors)) escapes.push(reached);
      }
      const clearance = (point: Point) => Math.min(...teammates.map(other =>
        Math.abs(other.y - point.y) >= 24 ? Infinity : Math.hypot(other.x - point.x, other.z - point.z)));
      const crowded = clearance(actor) < 80;
      escapes.sort((a, b) => (target && !crowded
        ? Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)
        : clearance(b) - clearance(a)));
      this.escapePoint = escapes[0];
      this.escapeOrigin = this.escapePoint ? {x: actor.x, y: actor.y, z: actor.z} : undefined;
    }
    let goal: Point | undefined = this.escapePoint ?? target;
    let friendly = false;
    if (!objectiveTarget && !this.escapePoint) {
      const origin = {...actor, y: actor.y + 20};
      const threats = enemies.filter(enemy => distance(enemy) < spacing.preferred + 80
        && Math.abs(enemy.y - actor.y) < 18
        && !field.firstSurfaceHit(origin, {...enemy, y: enemy.y + 20}, 1));
      // Finish withdrawing to the preferred range even when a corner briefly
      // hides the threat. Re-enter retreat only inside the closer danger band.
      const withdrawing = enemies.find(enemy => enemy.id === this.retreatThreatId
        && distance(enemy) < spacing.preferred && Math.abs(enemy.y - actor.y) < 18);
      const danger = threats.find(enemy => distance(enemy) < spacing.minimum);
      const threat = withdrawing ?? danger;
      const previousThreat = this.retreatThreatId;
      if (this.retreatThreatId && !threat) this.combatWaypoint = undefined;
      this.retreatThreatId = threat?.id;
      if (withdrawing && !threats.includes(withdrawing)) threats.push(withdrawing);
      if (threat) {
        // Keep one withdrawal point for a while: a point that follows the hull never gets closer.
        if (!this.combatWaypoint || previousThreat !== threat.id || now >= this.nextRetreatPlan
            || distance(this.combatWaypoint) < ARRIVAL_RADIUS * 2) {
          this.combatWaypoint = retreatPoint(actor, threats, reach);
          this.nextRetreatPlan = now + 1500;
        }
        retreating = true;
        this.traceDriveSource = 'RETREAT';
        this.path = []; this.goal = undefined; this.planner = undefined;
        // Back away while the turret keeps covering the threat.
        request = {mode: 'RETREAT', route: [this.combatWaypoint], threats,
          face: fixedTurret ? undefined : threat};
        return finishInput();
      }
    }
    if (target) {
      const bearing = Math.atan2(target.x - actor.x, target.z - actor.z);
      const error = angle(bearing - tankTurretYaw(actor.tank.id, actor));
      input.aim = aimStep > 0 ? Math.max(-1, Math.min(1, error / aimStep)) : 0;
      const origin = {...actor, y: actor.y + 20};
      const end = {...target, y: source || mode === 5 ? actor.y + 20 : target.y + 20};
      const wall = source ? undefined : field.firstSurfaceHit(origin, end, 1);
      friendly = teammates.some(other => blocksShot(origin, end, other));
      const visible = (source ? canShootSource(actor, bearing, source, field, actors, actor.id) : !wall && distance(target) < 700)
        && (source || Math.abs(actor.y - target.y) < 18);
      if (visible) this.targetSeenAt = now;
      input.fire = !actor.roleDisguise && visible && (fixedTurret || Math.abs(error) < .06) && !friendly;
      // Rebuilt VIP survival: create aiming time using ordinary collision-tested
      // movement rather than parking within an enemy's firing range while hurt.
      if (mode === 3 && actor.vip && actor.hp !== undefined && actor.maxHp !== undefined
          && actor.hp < actor.maxHp && visible && distance(target) < 330 && Math.abs(error) >= .06) {
        const evasion = vipEvasion(actor, enemies, bearing, input, field, dt);
        if (evasion) {
          this.traceDriveSource = 'VIP_EVASION';
          Object.assign(input, evasion);
          this.requestedMovement = true;
          return finishInput();
        }
      }
      if (this.repositionDestroy && this.goal && !this.planner && distance(this.goal) < ARRIVAL_RADIUS) {
        this.repositionDestroy = false;
      }
      const changingDestroyPosition = (mode === 5 && this.repositionDestroy)
        || tacticalIntent === 'UNSTICK';
      const engagementDistance = objectiveTarget ? 330 : spacing.preferred + 80;
      if (!this.escapePoint && visible && !friendly && distance(target) < engagementDistance
          && !changingDestroyPosition) goal = undefined;
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
      // Finish an existing positioning move across small range fluctuations.
      // Re-entering combat uses the closer boundary once that move is released.
      // A sight line that flickers past cover keeps the current combat move for a moment.
      const engaged = visible || !!this.combatWaypoint && now - this.targetSeenAt < 1200;
      const mobileCombat = !objectiveTarget && engaged
        && distance(target) < engagementDistance + (this.combatWaypoint ? 80 : 0);
      if (!this.escapePoint && !this.repositionDestroy && (friendly || mobileCombat)) {
        if (this.combatWaypoint && (distance(this.combatWaypoint) < ARRIVAL_RADIUS
            || !teammateWaypointClear(actor, this.combatWaypoint, teammates)
            || !tankRouteClear(actor, this.combatWaypoint, actors)
            || !objectiveTarget && Math.abs(Math.hypot(target.x - this.combatWaypoint.x,
              target.z - this.combatWaypoint.z) - spacing.preferred) > 80
            || !canShoot(this.combatWaypoint, Math.atan2(target.x - this.combatWaypoint.x,
              target.z - this.combatWaypoint.z)))) this.combatWaypoint = undefined;
        if (!this.combatWaypoint && now >= this.nextCombatMove && (visible || friendly)) {
          this.combatWaypoint = combatMovementPoint(actor, target, actors, teammates, field,
            this.combatDirection, fixedTurret && !friendly,
            objectiveTarget ? {minimum: 160, preferred: 280} : spacing, reach, canShoot,
            this.previousCombatPosition && now < this.previousCombatPosition.until
              ? this.previousCombatPosition.point : undefined, this.drive.travelDirection);
          this.nextCombatMove = now + randomBotDelay(behavior.movementMs);
          if (this.combatWaypoint) {
            this.previousCombatPosition = {point: {x: actor.x, y: actor.y, z: actor.z}, until: now + 4000};
          } else {
            this.combatDirection *= -1;
          }
        }
        if (this.combatWaypoint) {
          this.traceDriveSource = 'COMBAT_POSITION';
          this.path = []; this.goal = undefined; this.planner = undefined;
          const face = target;
          request = {mode: 'COMBAT', route: [this.combatWaypoint], face,
            canShoot: point => canShoot(point, Math.atan2(face.x - point.x, face.z - point.z))};
          return finishInput();
        }
      } else this.combatWaypoint = undefined;
    }
    const failed = target ? this.failedApproaches.get(target.id) ?? 0 : 0;
    const approach = target && (mode === 5 || tacticalIntent === 'OBJECTIVE'
      || tacticalIntent === 'APPROACH' || friendly || failed > 0 || !objectiveTarget);
    // Keep a useful approach while the chassis turns and follows its bends.
    // A moving contact releases the route after leaving its engagement area;
    // collision and recovery feedback still release blocked approaches.
    const keepApproachRoute = this.path.length > 0 && this.goal !== undefined
      && (mode === 5 || !!target && Math.abs(this.goal.y - target.y) < 18
        && Math.hypot(this.goal.x - target.x, this.goal.z - target.z)
          <= (objectiveTarget ? 330 : spacing.preferred + 160));
    if (approach && goal && !this.escapePoint) {
      // Choose a walkable firing point around blocked targets or friendly rays.
      if (!this.planner && (!this.goal || (now >= this.nextPlan && !keepApproachRoute))) {
        const candidates: Point[] = [];
        const approaches: Point[] = [];
        const radii = mode === 5 ? [100, 180, 280] : objectiveTarget ? [180, 280]
          : [spacing.preferred, spacing.preferred + 80];
        for (const radius of radii) {
          for (let step = 0; step < 16; step++) {
            const a = step * Math.PI / 8;
            const x = target.x + Math.sin(a) * radius, z = target.z + Math.cos(a) * radius;
            const cell = field.navigation.sample(x, z);
            if (!cell?.valid) continue;
            const candidate = {x, y: cell.height, z};
            if (!teammateWaypointClear(actor, candidate, teammates)) continue;
            if (actor.movement && !actor.movement.navigation.canTraverse(
                {x: x - Math.sin(a) * 6, y: cell.height, z: z - Math.cos(a) * 6}, candidate)) continue;
            if (mode === 5 ? Math.abs(candidate.y + 20 - target.y) > 50
              : Math.abs(candidate.y - target.y) >= 18) continue;
            if (!objectiveTarget) approaches.push(candidate);
            const endpoint = {...target, y: mode === 5 ? candidate.y + 20 : target.y + 20};
            const origin = {...candidate, y: candidate.y + 20};
            const wall = field.firstSurfaceHit(origin, endpoint, 1);
            if (wall && !field.isPlacementHit(wall.boxId, source?.id ?? '')) continue;
            if (source && segmentBox(origin, endpoint, source, 1) === undefined) continue;
            if (teammates.some(other => blocksShot(origin, endpoint, other))) continue;
            candidates.push(candidate);
          }
        }
        // A wall can hide every firing point. Route to walkable positions on
        // the firing ring until a clear angle opens.
        const positions = candidates.length || objectiveTarget ? candidates : approaches;
        positions.sort((a, b) => distance(a) - distance(b));
        // Try another firing position after a blocked approach.
        goal = positions[mode === 5 || friendly ? failed : Math.max(0, failed - 1)];
        if (!goal) {
          this.unavailableUntil.set(target.id, now + 8000);
          this.failedApproaches.delete(target.id);
        }
      } else goal = this.goal;
    }
    if (!goal) {
      if (target && !canShoot(actor, Math.atan2(target.x - actor.x, target.z - actor.z))) {
        this.breaching.request(target);
      }
      this.path = []; this.goal = undefined; this.planner = undefined;
      return finishInput();
    }
    if (!this.planner && ((now >= this.nextPlan && !keepApproachRoute) || !this.goal || Math.hypot(goal.x - this.goal.x, goal.z - this.goal.z) > 60)) {
      this.planner = new BotPathPlanner(field, actor, goal, actor.movement?.navigation ?? 20);
      this.planStartedAt = now;
      this.goal = {...goal};
    }
    if (this.planner) {
      const planned = this.planner.advance();
      if (planned !== undefined) {
        this.path = planned; this.planner = undefined;
        this.nextPlan = now + (planned.length ? 2500 : 0);
        if (planned.length && !this.escapePoint) this.breaching.reset();
        if (!planned.length && target) {
          this.breaching.request(goal);
          this.failedApproaches.set(target.id, failed + 1);
          if (mode === 5) this.repositionDestroy = true;
          this.goal = undefined;
        }
      } else if (!this.path.length && now - this.planStartedAt >= 8000 && target) {
        // An unfinished search is not proof that the target is unreachable.
        // Give other targets a turn, then retry a different firing position.
        this.planner = undefined; this.goal = undefined; this.nextPlan = 0;
        this.failedApproaches.set(target.id, failed + 1);
        if (!this.breaching.working) this.unavailableUntil.set(target.id, now + 8000);
        this.breaching.request(goal);
        if (mode === 5) this.repositionDestroy = true;
      } else if (!this.path.length && now - this.planStartedAt >= 1500) {
        this.breaching.request(goal);
      }
    }
    // The drive planner pursues a point ahead along the route. Drop a bend once it
    // is near or already passed and the following point is directly reachable,
    // as players cut a corner as soon as the next stretch opens up.
    while (this.path.length) {
      const first = this.path[0];
      const next = this.path[1];
      if (!next) {
        if (distance(first) < ARRIVAL_RADIUS) this.path.shift();
        break;
      }
      const passed = (actor.x - first.x) * (next.x - first.x) + (actor.z - first.z) * (next.z - first.z) > 0;
      if (distance(first) >= Math.max(36, parameters.speed * .6) && !passed) break;
      const reached = reach(actor, next);
      if (Math.hypot(reached.x - next.x, reached.z - next.z) >= .01) break;
      this.path.shift();
    }
    let waypoint = this.path[0];
    if (!waypoint && this.planner && this.goal) {
      // A pending full route need not keep the tank at its old search origin.
      // Follow only the prefix accepted by the authoritative collision sweep.
      const reached = reach(actor, this.goal);
      if (distance(reached) >= ARRIVAL_RADIUS) waypoint = reached;
    }
    if (!waypoint) {
      if (friendly && target && !this.planner) {
        this.failedApproaches.set(target.id, failed + 1);
        this.goal = undefined; this.nextPlan = now;
      }
      // While the route is still being searched, face its destination as a player would.
      if (this.planner && this.goal) request = {mode: 'TRAVEL', route: [this.goal], turnOnly: true};
      return finishInput();
    }
    this.traceDriveSource = this.escapePoint ? 'ESCAPE' : 'PATH';
    request = {mode: this.escapePoint ? 'ESCAPE' : 'TRAVEL',
      route: waypoint === this.path[0] ? this.path : [waypoint],
      face: targetVisible && !fixedTurret ? target : undefined};
    return finishInput();
  }
}

/** Leave the failed turning area before resuming pursuit; vary repeated exits. */
function recoveryExit(actor: BotActor, target: Point | undefined, teammates: readonly BotActor[],
  actors: readonly BotActor[], reach: (start: Point, end: Point) => Point, attempt: number,
  travelDirection: -1 | 1, input: MsgPlayerInput, previousExit?: Point): Point | undefined {
  const bearing = target ? Math.atan2(target.x - actor.x, target.z - actor.z) : actor.yaw;
  const heading = actor.yaw + (travelDirection < 0 ? Math.PI : 0);
  // A short straight exit can release a corner before a slow hull could turn
  // toward a longer sideways exit. Both travel directions use normal sweeps.
  const directions = [heading, heading + Math.PI,
    ...Array.from({length: 16}, (_, step) => bearing + ((step + attempt * 5) % 16) * Math.PI / 8)];
  let turningExit: Point | undefined;
  for (const direction of directions) {
    if (previousExit) {
      const previousBearing = Math.atan2(previousExit.x - actor.x, previousExit.z - actor.z);
      if (Math.abs(angle(direction - previousBearing)) < Math.PI / 4) continue;
    }
    for (const length of [144, 72, 36]) {
      const desired = {x: actor.x + Math.sin(direction) * length, y: actor.y,
        z: actor.z + Math.cos(direction) * length};
      const reached = reach(actor, desired);
      if (Math.hypot(reached.x - desired.x, reached.z - desired.z) >= .01
          || !teammateEscapeClear(actor, reached, teammates)
          || !tankRouteClear(actor, reached, actors)) continue;
      const approach = probe(actor, reached, input);
      if (approach === 'MOVE') return reached;
      if (approach === 'TURN') turningExit ??= reached;
    }
  }
  return turningExit;
}

/** Wounded actors and empty ordinary magazines require a wider firing distance. */
function combatSpacing(actor: BotActor): {minimum: number; preferred: number} {
  if (actor.hp !== undefined && actor.maxHp !== undefined && actor.maxHp > 0
      && actor.hp <= actor.maxHp * .4) return {minimum: 320, preferred: 400};
  if (actor.combat?.selectedAmmoSlot === 1 && actor.combat.currentAmmoTableId === defaultAmmoId()
      && actor.combat.bulletCount === 0) return {minimum: 280, preferred: 360};
  return {minimum: 220, preferred: 300};
}

/** The reachable point farthest from the threats among directions away from the nearest one. */
function retreatPoint(actor: BotActor, threats: readonly BotActor[],
  reach: (start: Point, end: Point) => Point): Point {
  const nearest = threats.reduce((best, threat) => Math.hypot(threat.x - actor.x, threat.z - actor.z)
    < Math.hypot(best.x - actor.x, best.z - actor.z) ? threat : best);
  const away = Math.atan2(actor.x - nearest.x, actor.z - nearest.z);
  const separation = (point: Point) => Math.min(...threats.map(threat =>
    Math.hypot(threat.x - point.x, threat.z - point.z)));
  let best: Point | undefined;
  let bestSeparation = -Infinity;
  for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
    const reached = reach(actor, {x: actor.x + Math.sin(away + offset) * 160, y: actor.y,
      z: actor.z + Math.cos(away + offset) * 160});
    if (Math.hypot(reached.x - actor.x, reached.z - actor.z) < 48) continue;
    const value = separation(reached);
    if (value > bestSeparation) {best = reached; bestSeparation = value;}
  }
  return best ?? {x: actor.x + Math.sin(away) * 144, y: actor.y, z: actor.z + Math.cos(away) * 144};
}

/** Traversable combat moves preserve firing angles and the engagement distance. */
function combatMovementPoint(actor: BotActor, target: Point, actors: readonly BotActor[],
  teammates: readonly BotActor[], field: Battlefield, direction: number, fixedTurret: boolean,
  spacing: {minimum: number; preferred: number},
  reach: (start: Point, end: Point) => Point,
  canShoot: (position: Point, heading: number) => boolean,
  previousPosition?: Point, travelDirection: -1 | 1 = 1): Point | undefined {
  const bearing = Math.atan2(target.x - actor.x, target.z - actor.z);
  const distance = Math.hypot(target.x - actor.x, target.z - actor.z);
  const radius = spacing.preferred;
  const usable = (desired: Point): Point | undefined => {
    if (previousPosition && Math.hypot(desired.x - previousPosition.x,
      desired.z - previousPosition.z) < 36) return undefined;
    const cell = field.navigation.sample(desired.x, desired.z);
    if (!cell?.valid) return undefined;
    desired.y = cell.height;
    const reached = reach(actor, desired);
    if (Math.hypot(reached.x - desired.x, reached.z - desired.z) >= .01) return undefined;
    if (!teammateWaypointClear(actor, reached, teammates) || !tankRouteClear(actor, reached, actors)) return undefined;
    return canShoot(reached, Math.atan2(target.x - reached.x, target.z - reached.z)) ? reached : undefined;
  };
  if (!fixedTurret) {
    // A rotating turret keeps aiming while the hull shuttles along its own axis,
    // which a slow hull manages without first turning toward a sideways point.
    for (const length of [96, 160]) {
      for (const sign of [travelDirection, -travelDirection]) {
        const desired = {x: actor.x + Math.sin(actor.yaw) * sign * length, y: actor.y,
          z: actor.z + Math.cos(actor.yaw) * sign * length};
        const range = Math.hypot(target.x - desired.x, target.z - desired.z);
        if (range < spacing.minimum || range > spacing.preferred + 80) continue;
        const reached = usable(desired);
        if (reached) return reached;
      }
    }
  }
  const offsets = fixedTurret
    ? distance < spacing.minimum ? [Math.PI] : distance > spacing.preferred + 20 ? [0] : []
    : [direction * Math.PI / 2, -direction * Math.PI / 2,
      direction * Math.PI / 3, -direction * Math.PI / 3];
  for (const length of fixedTurret ? [48] : [48, 96, 144]) {
    for (const offset of offsets) {
      const lateral = Math.sin(offset) * length;
      const forward = fixedTurret ? Math.cos(offset) * length
        : distance - Math.sqrt(radius * radius - lateral * lateral);
      const desired = {x: actor.x + Math.sin(bearing) * forward + Math.cos(bearing) * lateral,
        y: actor.y, z: actor.z + Math.cos(bearing) * forward - Math.sin(bearing) * lateral};
      const reached = usable(desired);
      if (reached) return reached;
    }
  }
  return undefined;
}

function angle(value: number): number {return Math.atan2(Math.sin(value), Math.cos(value));}
function objectiveSource(objective: ObjectiveSnapshot, mapId: number, mode: number): SceneBreakable | undefined {
  if (objective.sourcePlacementId === undefined) return undefined;
  const sources = mode === 2 ? getSceneCastles(mapId) : getSceneBreakables(mapId);
  return sources.find(source => source.id === objective.sourcePlacementId
    && (mode !== 2 || source.model === objective.sourceModel));
}
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
  return hit !== undefined && (!wall || hit < wall.fraction || field.isPlacementHit(wall.boxId, source.id) && hit === wall.fraction)
    && !blocked && !field.firstSurfaceHit({...position, y: muzzle.y}, muzzle, 1);
}
function blocksShot(start: Point, end: Point, ally: Point): boolean {
  const dx = end.x - start.x, dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) return false;
  const x = ally.x - start.x, z = ally.z - start.z;
  const forward = (x * dx + z * dz) / length;
  const lateral = (x * dz - z * dx) / length;
  return forward >= 0 && forward <= length && Math.abs(lateral) <= 25;
}
