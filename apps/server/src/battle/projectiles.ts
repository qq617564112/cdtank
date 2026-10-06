import {createRoleFreeAim} from './roles/free-aim';
import {queryShotTarget} from './shot-query';
import type {MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot} from '../../../shared/protocols';
import {segmentSphere, segmentBox, type Battlefield, type Point} from '../battlefield';
import {getSceneBreakables, getSceneCastles} from '../scene-objects';
import {prototypeAttack, type AttackBoostState} from './items/attack-drink';
import {calculateQualifiedShotAttack} from './roles/qualified-shot-attack';
import type {recomputeQualifiedRoleArmor} from './roles/recompute-armor';
import type {ShotModifiers} from './roles/shot-modifiers';

export interface BulletState {
  id: string;
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
  /** Center-based remaining travel for a range-extended functional bullet. */
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
  hitPlayer(owner: Player, target: Player, damage: number, ammoItemId: number | undefined,
    bearing?: {x: number; z: number}, shotId?: string): void;
  hitObjective(owner: Player, target: ObjectiveSnapshot, damage: number, ammoItemId?: number): void;
  hitSceneObject?(owner: Player, target: SceneObjectSnapshot, damage: number, ammoItemId?: number): void;
  terrainHit(event: MsgRoomEvent): void;
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
      if (hitPlayer && owner) {
        handlers.hitPlayer(owner, hitPlayer, bullet.damage, bullet.ammoItemId,
          {x: -bullet.vx, z: -bullet.vz}, bullet.id);
      } else if (hitObjective && owner) {
        handlers.hitObjective(owner, hitObjective, bullet.damage, bullet.ammoItemId);
      } else if (hitSceneObject && owner) {
        handlers.hitSceneObject?.(owner, hitSceneObject, bullet.damage, bullet.ammoItemId);
      } else if (wall) {
        handlers.terrainHit({roomId: room.roomId, type: 'terrainHit', message: '弹丸命中障碍',
          playerId: bullet.ownerId, targetId: wall.boxId, value: 0,
          x: bullet.x + (destination.x - bullet.x) * hitFraction,
          y: bullet.y + (destination.y - bullet.y) * hitFraction,
          z: bullet.z + (destination.z - bullet.z) * hitFraction});
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
  aim: number;
  tank: {attack: number};
  attackBoost?: AttackBoostState;
  armorReady?: boolean;
  recoveredArmor?: ReturnType<typeof recomputeQualifiedRoleArmor>;
  shotModifiers?: ShotModifiers;
  combat: {specialFlag12: number; currentAmmoTableId: number};
}, currentSeconds: number, allocateId: () => string, events: MsgRoomEvent[], bodyRadius: number,
  hitSceneObject?: (targetId: string, damage: number, ammoItemId: number) => boolean,
  hitPlayer?: (targetId: string, damage: number, ammoItemId: number, shotId?: string) => void,
  itemId = player.combat.currentAmmoTableId, shotId?: string, fired?: () => void): void {
  const speed = 360;
  const angle = player.yaw + player.aim;
  const aim = createRoleFreeAim(player, {x: Math.sin(angle), y: 0, z: Math.cos(angle)}, currentSeconds);
  const penetratesObstacles = player.shotModifiers?.penetratesObstacles === true;
  const range = 1000 * (player.shotModifiers?.rangePercent ?? 100) / 100;
  const target = queryShotTarget(player, {x: Math.sin(angle), y: 0, z: Math.cos(angle)},
    room.players, room.battlefield, bodyRadius,
    itemId === 2001 ? room.sceneCrushes : undefined, itemId === 2001,
    {closestPlayer: itemId === 2001 || penetratesObstacles,
      range, ignoreObstruction: penetratesObstacles});
  const aimX = aim.x - Math.fround(player.x), aimZ = aim.z - Math.fround(player.z);
  const distance = Math.hypot(aimX, aimZ);
  const directionX = aimX / distance, directionZ = aimZ / distance;
  // Recovered free-aim target; projectile speed and muzzle remain Web rules.
  player.combat.specialFlag12 = 0;
  const muzzle = {x: player.x + directionX * 30,
    y: player.y + 20, z: player.z + directionZ * 30};
  events.push({roomId: room.roomId, type: 'fire', message: `${player.name}开火`, playerId: player.id,
    targetId: target.kind === 'FREE' ? '' : target.targetId, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: itemId,
    // Original player-target branch is silent here; scene/free display immediately.
    shotDisplay: target.kind === 'PLAYER' ? undefined : {itemId, ...target.point}});
  fired?.();
  // Temporary attack skills already contribute to qualified role recomputation.
  const damage = player.armorReady && player.recoveredArmor
    ? calculateQualifiedShotAttack(player.recoveredArmor)
    : 35 + prototypeAttack(player.tank.attack, player.attackBoost) * 0.08;
  // Ordinary2001 and FuncType22 resolve one selected target during the accepted
  // query boundary; query geometry and server damage are rebuilt.
  if (itemId === 2001 || penetratesObstacles) {
    if (target.kind === 'PLAYER') hitPlayer?.(target.targetId, damage, itemId, shotId);
    else if (target.kind === 'SCENE' && !hitSceneObject?.(target.targetId, damage, itemId)) {
      // Original type2 receives remote result feedback without a damage transaction.
      // Source BOX identity and server notification eligibility are reconstructed.
      const sourceBox = room.battlefield.boxes.some(box => box.id === target.targetId);
      events.push({roomId: room.roomId, type: sourceBox ? 'sceneStaticHit' : 'terrainHit',
        message: '射击命中场景', playerId: player.id, targetId: target.targetId,
        value: 0, ...target.point,
        shotItemResult: sourceBox ? {itemId, ...target.point} : undefined});
    }
    return;
  }
  const obstruction = room.battlefield.firstSurfaceHit({...player, y: muzzle.y}, muzzle, 1);
  if (obstruction) {
    if (hitSceneObject?.(obstruction.boxId, damage, itemId)) return;
    events.push({roomId: room.roomId, type: 'terrainHit', message: '弹丸命中障碍', playerId: player.id,
      targetId: obstruction.boxId, value: 0,
      x: player.x + (muzzle.x - player.x) * obstruction.fraction,
      y: muzzle.y,
      z: player.z + (muzzle.z - player.z) * obstruction.fraction,
      skillId: undefined});
    return;
  }
  room.bullets.push({id: allocateId(), ownerId: player.id, ...muzzle,
    vx: directionX * speed, vy: 0, vz: directionZ * speed,
    // Existing damage remains rebuilt; source drink parameters alter attack at shot creation.
    damage, ammoItemId: itemId, ttl: range > 1000 ? range / speed : 2.2,
    remainingDistance: range > 1000 ? range - 30 : undefined});
}
