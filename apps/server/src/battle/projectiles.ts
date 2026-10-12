import {gameContent, itemHitHandler} from '../../../shared/content/catalog';
import {shotCausedDamage, shotImpactEvent} from './shot-impact';
import {createRoleFreeAim} from './roles/free-aim';
import {queryShotTarget} from './shot-query';
import type {MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot} from '../../../shared/protocols';
import {segmentSphere, segmentBox, type Battlefield, type Point} from '../battlefield';
import {getSceneBreakables, getSceneCastles} from '../scene-objects';
import {prototypeAttack, type AttackBoostState} from './items/attack-drink';
import {calculateQualifiedShotAttack} from './roles/qualified-shot-attack';
import type {recomputeQualifiedRoleArmor} from './roles/recompute-armor';
import type {ShotModifiers} from './roles/shot-modifiers';
import {tankTurretYaw} from '../../../shared/combat/tank-turret';

export interface BulletState {
  id: string;
  shotId?: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  /** Confirmed ammo at creation; later slot changes cannot change this shot. */
  ammoItemId?: number;
  ttl: number;
  /** Remaining muzzle-to-query-limit travel; lifetime stays aligned with this distance. */
  remainingDistance?: number;
}

interface ProjectilePlayer extends Point {
  id: string;
  alive: boolean;
}

/** Advance existing authoritative bullets; synchronous hits may finish the room. */
export function advanceProjectiles<Player extends ProjectilePlayer>(room: {
  roomId: string;
  map: {mapId: number};
  readonly phase: string;
  bullets: BulletState[];
  players: ReadonlyMap<string, Player>;
  objectives: ObjectiveSnapshot[];
  sceneObjects?: SceneObjectSnapshot[];
  battlefield: Battlefield;
}, dt: number, bodyRadius: number, handlers: {
  /** Damage handlers return true for a confirmed damaging hit. */
  hitPlayer(owner: Player, target: Player, damage: number, ammoItemId: number | undefined,
    bearing?: {x: number; z: number}, shotId?: string): boolean | void;
  hitObjective(owner: Player, target: ObjectiveSnapshot, damage: number, ammoItemId?: number): boolean | void;
  hitSceneObject?(owner: Player, target: SceneObjectSnapshot, damage: number, ammoItemId?: number): boolean | void;
  terrainHit(event: MsgRoomEvent): void;
  shotImpact?(event: MsgRoomEvent): void;
}): void {
  for (let index = room.bullets.length - 1; index >= 0 && room.phase === 'PLAYING'; index--) {
    const bullet = room.bullets[index];
    bullet.ttl -= dt;
    const stepDistance = Math.hypot(bullet.vx, bullet.vy, bullet.vz) * dt;
    const travel = bullet.remainingDistance === undefined ? stepDistance
      : Math.min(stepDistance, Math.max(0, bullet.remainingDistance));
    const stepFraction = stepDistance > 0 ? travel / stepDistance : 1;
    const destination = {x: bullet.x + bullet.vx * dt * stepFraction,
      y: bullet.y + bullet.vy * dt * stepFraction, z: bullet.z + bullet.vz * dt * stepFraction};
    if (bullet.ttl <= 0 && bullet.remainingDistance === undefined) {
      room.bullets.splice(index, 1);
      continue;
    }
    const wall = room.battlefield.firstSurfaceHit(bullet, destination, 1);
    let hitFraction = wall?.fraction ?? Infinity;
    let hitPlayer: Player | undefined;
    let hitObjective: ObjectiveSnapshot | undefined;
    let hitSceneObject: SceneObjectSnapshot | undefined;
    for (const target of room.players.values()) {
      if (!target.alive || target.id === bullet.ownerId) {
        continue;
      }
      const fraction = segmentSphere(bullet, destination,
        {x: target.x, y: target.y + bodyRadius, z: target.z}, bodyRadius);
      if (fraction !== undefined && fraction < hitFraction) {
        hitFraction = fraction;
        hitPlayer = target;
      }
    }
    for (const objective of room.objectives) {
      if (objective.kind !== 'DESTROY' || objective.hp <= 0) continue;
      const source = objective.sourcePlacementId === undefined ? undefined
        : getSceneBreakables(room.map.mapId).find(value => value.id === objective.sourcePlacementId);
      const fraction = source ? segmentBox(bullet, destination, source, 1)
        : segmentSphere(bullet, destination, {...objective, y: objective.y + 20}, objective.radius);
      if (fraction !== undefined && (fraction < hitFraction || fraction === hitFraction && wall?.boxId === objective.id)) {
        hitFraction = fraction;
        hitPlayer = undefined;
        hitObjective = objective;
      }
    }
    for (const object of room.sceneObjects ?? []) {
      if (object.hp <= 0 || !handlers.hitSceneObject) continue;
      const source = getSceneBreakables(room.map.mapId).find(value => value.id === object.sourcePlacementId)
        ?? getSceneCastles(room.map.mapId).find(value => value.id === object.sourcePlacementId);
      if (!source) continue;
      const fraction = segmentBox(bullet, destination, source, 1);
      if (fraction !== undefined && (fraction < hitFraction || fraction === hitFraction && wall?.boxId === object.id)) {
        hitFraction = fraction;
        hitPlayer = undefined;
        hitObjective = undefined;
        hitSceneObject = object;
      }
    }
    if (hitFraction <= 1) {
      const owner = room.players.get(bullet.ownerId);
      const point = {x: bullet.x + (destination.x - bullet.x) * hitFraction,
        y: bullet.y + (destination.y - bullet.y) * hitFraction,
        z: bullet.z + (destination.z - bullet.z) * hitFraction};
      let damaging = false;
      let targetId = wall?.boxId ?? '';
      if (hitPlayer && owner) {
        targetId = hitPlayer.id;
        damaging = handlers.hitPlayer(owner, hitPlayer, bullet.damage, bullet.ammoItemId,
          {x: -bullet.vx, z: -bullet.vz}, bullet.shotId ?? bullet.id) === true;
      } else if (hitObjective && owner) {
        targetId = hitObjective.id;
        damaging = handlers.hitObjective(owner, hitObjective, bullet.damage, bullet.ammoItemId) === true;
      } else if (hitSceneObject && owner) {
        targetId = hitSceneObject.id;
        damaging = handlers.hitSceneObject?.(owner, hitSceneObject, bullet.damage, bullet.ammoItemId) === true;
      } else if (wall) {
        handlers.terrainHit({roomId: room.roomId, type: 'terrainHit', message: '弹丸命中障碍',
          playerId: bullet.ownerId, targetId: wall.boxId, value: 0, ...point});
      }
      if (!(hitPlayer && itemHitHandler(bullet.ammoItemId) === 'medical')) {
        handlers.shotImpact?.(shotImpactEvent(room.roomId, bullet.ownerId, targetId, point,
          damaging, bullet.ammoItemId, !hitPlayer));
      }
      if (room.phase === 'PLAYING') room.bullets.splice(index, 1);
    } else {
      const travelX = destination.x - bullet.x;
      const travelY = destination.y - bullet.y;
      const travelZ = destination.z - bullet.z;
      bullet.x = destination.x;
      bullet.y = destination.y;
      bullet.z = destination.z;
      if (bullet.remainingDistance !== undefined) {
        bullet.remainingDistance -= Math.hypot(travelX, travelY, travelZ);
        if (bullet.remainingDistance <= 0) room.bullets.splice(index, 1);
      }
    }
  }
}


/** Resolve the accepted shot after the original03 start/query delay. */
export function fireProjectile(room: {
  roomId: string;
  sceneCrushes?: SceneCrushSnapshot[];
  battlefield: Battlefield;
  bullets: BulletState[];
  players: ReadonlyMap<string, ProjectilePlayer>;
}, player: Point & {
  id: string;
  name: string;
  yaw: number;
  bodyYaw?: number;
  aim: number;
  tank: {id?: number; attack: number};
  attackBoost?: AttackBoostState;
  armorReady?: boolean;
  recoveredArmor?: ReturnType<typeof recomputeQualifiedRoleArmor>;
  shotModifiers?: ShotModifiers;
  combat: {specialFlag12: number; currentAmmoTableId: number};
}, currentSeconds: number, allocateId: () => string, events: MsgRoomEvent[], bodyRadius: number,
  hitSceneObject?: (targetId: string, damage: number, ammoItemId: number) => boolean,
  hitPlayer?: (targetId: string, damage: number, ammoItemId: number, shotId?: string) => void,
  itemId = player.combat.currentAmmoTableId, shotId?: string, fired?: () => void,
  shotModifiers = player.shotModifiers): void {
  const ammo = gameContent().items.get(itemId)!;
  const speed = ammo.runtime.projectileSpeed!;
  const instant = ammo.runtime.query === 'instant';
  const angle = tankTurretYaw(player.tank.id, player);
  const aim = createRoleFreeAim(player, {x: Math.sin(angle), y: 0, z: Math.cos(angle)}, currentSeconds);
  const penetratesObstacles = shotModifiers?.penetratesObstacles === true;
  const range = ammo.runtime.range! * (shotModifiers?.rangePercent ?? 100) / 100;
  const target = queryShotTarget(player, {x: Math.sin(angle), y: 0, z: Math.cos(angle)},
    room.players, room.battlefield, bodyRadius,
    instant ? room.sceneCrushes : undefined, instant,
    {closestPlayer: instant || penetratesObstacles,
      range, ignoreObstruction: penetratesObstacles});
  const aimX = aim.x - Math.fround(player.x), aimZ = aim.z - Math.fround(player.z);
  const distance = Math.hypot(aimX, aimZ);
  const directionX = aimX / distance, directionZ = aimZ / distance;
  // Recovered free-aim target; projectile speed and muzzle remain Web rules.
  player.combat.specialFlag12 = 0;
  const muzzle = {x: player.x + directionX * ammo.runtime.muzzleForward!,
    y: player.y + ammo.runtime.muzzleHeight!, z: player.z + directionZ * ammo.runtime.muzzleForward!};
  events.push({roomId: room.roomId, type: 'fire', message: `${player.name}开火`, playerId: player.id,
    targetId: target.kind === 'FREE' ? '' : target.targetId, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: itemId,
    // Original player-target branch is silent here; scene/free display immediately.
    shotDisplay: target.kind === 'PLAYER' ? undefined : {itemId, ...target.point}});
  fired?.();
  // Temporary attack skills already contribute to qualified role recomputation.
  const damage = player.armorReady && player.recoveredArmor
    ? calculateQualifiedShotAttack(player.recoveredArmor)
    : ammo.runtime.values.baseDamage + prototypeAttack(player.tank.attack, player.attackBoost) * ammo.runtime.values.attackScale;
  // Instant ammunition and FuncType22 resolve one selected target at the
  // accepted query boundary; query geometry and server damage are rebuilt.
  if (instant || penetratesObstacles) {
    const firstEvent = events.length;
    if (target.kind === 'PLAYER') {
      const victim = room.players.get(target.targetId)!;
      const center = {...victim, y: victim.y + bodyRadius};
      const endpoint = {x: muzzle.x + Math.sin(angle) * range, y: muzzle.y,
        z: muzzle.z + Math.cos(angle) * range};
      const fraction = segmentSphere(muzzle, endpoint, center, bodyRadius);
      // The ordinary strip can accept a hull off the center ray; use its front surface.
      const length = Math.hypot(muzzle.x - center.x, muzzle.y - center.y, muzzle.z - center.z);
      const offset = length > 0 ? Math.min(1, bodyRadius / length) : 0;
      const point = fraction === undefined ? {
        x: center.x + (muzzle.x - center.x) * offset,
        y: center.y + (muzzle.y - center.y) * offset,
        z: center.z + (muzzle.z - center.z) * offset,
      } : {x: muzzle.x + (endpoint.x - muzzle.x) * fraction,
        y: muzzle.y + (endpoint.y - muzzle.y) * fraction,
        z: muzzle.z + (endpoint.z - muzzle.z) * fraction};
      hitPlayer?.(target.targetId, damage, itemId, shotId);
      if (itemHitHandler(itemId) !== 'medical') events.push(shotImpactEvent(room.roomId, player.id,
        target.targetId, point, shotCausedDamage(events, firstEvent, player.id, target.targetId), itemId, false));
    } else if (target.kind === 'SCENE') {
      if (!hitSceneObject?.(target.targetId, damage, itemId)) {
        // Original type2 receives remote result feedback without a damage transaction.
        // Source BOX identity and server notification eligibility are reconstructed.
        const sourceBox = room.battlefield.boxes.some(box => box.id === target.targetId);
        events.push({roomId: room.roomId, type: sourceBox ? 'sceneStaticHit' : 'terrainHit',
          message: '射击命中场景', playerId: player.id, targetId: target.targetId,
          value: 0, ...target.point,
          shotItemResult: sourceBox ? {itemId, ...target.point} : undefined});
      }
      events.push(shotImpactEvent(room.roomId, player.id, target.targetId, target.point,
        shotCausedDamage(events, firstEvent, player.id, target.targetId), itemId, true));
    }
    return;
  }
  const obstruction = room.battlefield.firstSurfaceHit({...player, y: muzzle.y}, muzzle, 1);
  if (obstruction) {
    const point = {x: player.x + (muzzle.x - player.x) * obstruction.fraction, y: muzzle.y,
      z: player.z + (muzzle.z - player.z) * obstruction.fraction};
    const firstEvent = events.length;
    if (!hitSceneObject?.(obstruction.boxId, damage, itemId)) {
      events.push({roomId: room.roomId, type: 'terrainHit', message: '弹丸命中障碍', playerId: player.id,
        targetId: obstruction.boxId, value: 0, ...point});
    }
    events.push(shotImpactEvent(room.roomId, player.id, obstruction.boxId, point,
      shotCausedDamage(events, firstEvent, player.id, obstruction.boxId), itemId, true));
    return;
  }
  const travelDistance = Math.max(0, range - ammo.runtime.muzzleForward!);
  room.bullets.push({id: allocateId(), shotId, ownerId: player.id, ...muzzle,
    vx: directionX * speed, vy: 0, vz: directionZ * speed,
    // Existing damage remains rebuilt; source drink parameters alter attack at shot creation.
    damage, ammoItemId: itemId, ttl: travelDistance / speed,
    remainingDistance: travelDistance});
}
