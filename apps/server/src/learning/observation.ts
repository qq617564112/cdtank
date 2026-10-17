import {isHiddenFromOpponent} from '../../../shared/combat/optical-camouflage';
import {gameContent} from '../../../shared/content/catalog';
import {tankTurretYaw} from '../../../shared/combat/tank-turret';
import {isRoleFireReady} from '../battle/roles/reload';
import {queryShotTarget} from '../battle/shot-query';
import {learningItemState} from './items';
import {originalMovementParameters, ORIGINAL_MOVEMENT_DIMENSIONS} from '../battle/movement';
import {sampleRoleNavigationFailure} from '../battle/roles/movement-navigation';
import type {RoomState} from '../rooms/state';
import type {PlayerState} from '../battle/player-state';
import type {MsgRoomEvent} from '../../../shared/protocols/MsgRoomEvent';

export const LEARNING_ACTION_SIZES = [3, 3, 3, 2, 9] as const;

export interface LearningMemory {
  x: number;
  y: number;
  z: number;
  at: number;
  deaths: number;
  observedAmmo?: Record<string, number>;
  observedPeers?: Record<string, {x: number; z: number; at: number}>;
}

export interface LearningGoal {x: number; z: number;}

/** Actor observations contain local perceptions; reward statistics stay separate. */
export function observeLearning(room: RoomState, player: PlayerState, maximumHp: number,
  now: number, previous?: LearningMemory, goal?: LearningGoal, events: readonly MsgRoomEvent[] = []) {
  const yaw = player.yaw;
  const sine = Math.sin(yaw), cosine = Math.cos(yaw);
  const body = player.bodyYaw ?? yaw;
  const input = player.input;
  const continuous = previous && previous.deaths === player.deaths && player.alive;
  const scale = continuous ? 500 / Math.max(50, now - previous.at) : 0;
  const dx = continuous ? (player.x - previous.x) * scale : 0;
  const dz = continuous ? (player.z - previous.z) * scale : 0;
  const dy = continuous ? (player.y - previous.y) * scale : 0;
  // The first sixteen features also define the sparse-history motion prior.
  const observation = [Math.sin(yaw), Math.cos(yaw), Math.sin(body), Math.cos(body),
    Math.sin(player.aim), Math.cos(player.aim), player.hp / 1000, Number(!!player.roleDisguise),
    input.move, input.turn, input.aim, Number(input.fire),
    (dx * cosine - dz * sine) / 100, (dx * sine + dz * cosine) / 100,
    dy / 100, Number(!!continuous)];
  const local = (point: {x: number; z: number}) => {
    const x = point.x - player.x, z = point.z - player.z;
    return [(x * cosine - z * sine) / 600, (x * sine + z * cosine) / 600];
  };
  const origin = {x: player.x, y: player.y + 20, z: player.z};
  const distance = (point: {x: number; z: number}) => Math.hypot(point.x - player.x, point.z - player.z);
  const visible = (point: {x: number; y: number; z: number}) => distance(point) <= 2500
    && !room.battlefield.firstSurfaceHit(origin, {...point, y: point.y + 20}, 0);
  for (let ray = 0; ray < 8; ray++) {
    const angle = yaw + ray * Math.PI / 4;
    let clear = 0;
    for (let step = 1; step <= 8; step++) {
      const point = {x: player.x + Math.sin(angle) * step * 20,
        z: player.z + Math.cos(angle) * step * 20};
      if (!room.battlefield.navigation.sample(point.x, point.z)?.valid) break;
      clear = step / 8;
    }
    observation.push(clear);
  }
  const enemies = [...room.players.values()].filter(other => other.id !== player.id && other.alive
    && (room.mode >= 4 || other.team !== player.team)
    && !isHiddenFromOpponent(other, player, room.mode) && visible(other))
    .sort((first, second) => distance(first) - distance(second));
  const allies = [...room.players.values()].filter(other => other.id !== player.id && other.alive
    && room.mode <= 3 && other.team === player.team && visible(other))
    .sort((first, second) => distance(first) - distance(second));
  for (const peers of [enemies, allies]) {
    for (let index = 0; index < 3; index++) {
      const peer = peers[index];
      observation.push(...(peer ? [1, ...local(peer), Math.sin(peer.yaw - yaw),
        Math.cos(peer.yaw - yaw), peer.hp / 1000, Number(peer.vip), (peer.y - player.y) / 100]
        : Array<number>(8).fill(0)));
    }
  }
  const bullets = room.bullets.filter(bullet => bullet.ownerId !== player.id && visible(bullet))
    .sort((first, second) => distance(first) - distance(second));
  for (let index = 0; index < 2; index++) {
    const bullet = bullets[index];
    observation.push(...(bullet ? [1, ...local(bullet),
      (bullet.vx * cosine - bullet.vz * sine) / 1000,
      (bullet.vx * sine + bullet.vz * cosine) / 1000, bullet.ttl / 5]
      : Array<number>(6).fill(0)));
  }
  const objectives = room.objectives.filter(target => target.hp > 0)
    .sort((first, second) => distance(first) - distance(second));
  for (let index = 0; index < 2; index++) {
    const target = objectives[index];
    // Objective placements and rule HP are public mode information.
    observation.push(...(target ? [1, ...local(target), target.hp / Math.max(1, target.maxHp),
      Number(target.ownerTeam === player.team), Number(target.ownerTeam < 0)]
      : Array<number>(6).fill(0)));
  }
  for (let mode = 1; mode <= 5; mode++) observation.push(Number(room.mode === mode));
  observation.push(Number(player.vip), maximumHp / 1000,
    Math.max(0, (room.timeLimitSeconds ?? room.map.timeLimit) - (now - room.startedAt) / 1000) / 600);
  const items = learningItemState(player, maximumHp, now);
  const hotkeys = player.combat.record?.arrays.get(0);
  for (let slot = 2; slot <= 8; slot++) {
    const instance = (hotkeys?.[slot - 2] ?? 0) >>> 0;
    const item = player.inventory.find(record => (record.instanceId >>> 0) === instance);
    const available = items.mask[slot];
    observation.push(item ? item.itemTableId / 30000 : 0,
      item ? Math.min(1, item.battleQuantity / 20) : 0, Number(available));
  }
  observation.push(...(goal ? [1, ...local(goal)] : [0, 0, 0]));
  const fireReady = player.alive && !player.combat.pendingShot
    && isRoleFireReady(player.combat.getFlag(11) !== 0,
      (now - room.startedAt) / 1000, player.combat.nextAvailableSeconds);
  const ammo = gameContent().items.get(player.combat.currentAmmoTableId)!;
  const range = ammo.runtime.range! * (player.shotModifiers?.rangePercent ?? 100) / 100;
  const instant = ammo.runtime.query === 'instant';
  const penetrates = player.shotModifiers?.penetratesObstacles === true;
  const turret = tankTurretYaw(player.tank.id, player);
  const perceived = new Map([player, ...enemies, ...allies].map(peer => [peer.id, peer]));
  const query = (angle: number) => queryShotTarget(player,
    {x: Math.sin(angle), y: 0, z: Math.cos(angle)}, perceived, room.battlefield, 20,
    instant ? room.sceneCrushes : undefined, instant,
    {range, closestPlayer: instant || penetrates, ignoreObstruction: penetrates});
  const selected = query(turret);
  const observedAmmo = {...previous?.observedAmmo};
  observation.push(range / 1000, ammo.runtime.projectileSpeed! / 1000, Number(instant), Number(penetrates),
    Math.max(0, player.combat.nextAvailableSeconds - (now - room.startedAt) / 1000) / 5,
    Math.min(1, player.combat.bulletCount / 20), ammo.runtime.muzzleForward! / 1000, Number(fireReady));
  const inRange: boolean[] = [];
  for (const event of events) {
    if (event.type === 'fire' && event.roomId === room.roomId && event.skillId !== undefined
        && enemies.some(peer => peer.id === event.playerId) && visible(event)
        && gameContent().items.get(event.skillId)?.kind === 'ammo') {
      observedAmmo[event.playerId] = event.skillId;
    }
  }
  for (let index = 0; index < 3; index++) {
    const peer = enemies[index];
    if (!peer) {observation.push(...Array<number>(7).fill(0)); continue;}
    const bearing = Math.atan2(peer.x - player.x, peer.z - player.z);
    const aimed = query(bearing);
    const reachable = aimed.kind === 'PLAYER' && aimed.targetId === peer.id;
    inRange.push(reachable);
    const known = observedAmmo[peer.id] !== undefined;
    const knownItem = known ? gameContent().items.get(observedAmmo[peer.id]) : undefined;
    const modifier = knownItem && Object.values(knownItem.runtime.skillRoles)
      .map(id => gameContent().skills.get(id)?.functions[0]).find(value => value?.type === 23);
    const knownRange = (knownItem?.runtime.range ?? 0) * (modifier?.x ?? 100) / 100;
    observation.push(distance(peer) / Math.max(1, range), Number(reachable),
      Number(selected.kind === 'PLAYER' && selected.targetId === peer.id),
      Math.sin(bearing - turret), Math.cos(bearing - turret), knownRange / 1000, Number(known));
  }
  const relativeGoal = goal ? local(goal) : [0, 0];
  const goalLength = Math.hypot(...relativeGoal);
  observation.push(relativeGoal[0] / Math.max(.001, goalLength),
    relativeGoal[1] / Math.max(.001, goalLength), Math.min(4, goalLength));
  observation.push(...items.features);
  const observedPeers: NonNullable<LearningMemory['observedPeers']> = {};
  for (let index = 0; index < 3; index++) {
    const peer = enemies[index];
    if (!peer) {observation.push(0, 0, 0, 0); continue;}
    const turretHeading = tankTurretYaw(peer.tank.id, peer) - yaw;
    const before = previous?.observedPeers?.[peer.id];
    const velocityScale = before && now > before.at && now - before.at <= 500 ? 1000 / (now - before.at) : 0;
    const vx = before ? (peer.x - before.x) * velocityScale : 0;
    const vz = before ? (peer.z - before.z) * velocityScale : 0;
    observation.push(Math.sin(turretHeading), Math.cos(turretHeading),
      (vx * cosine - vz * sine) / 1000, (vx * sine + vz * cosine) / 1000);
    observedPeers[peer.id] = {x: peer.x, z: peer.z, at: now};
  }
  const movement = originalMovementParameters(player);
  observation.push((movement?.speed ?? 0) / 1000, (movement?.turn ?? 0) / 10,
    ORIGINAL_MOVEMENT_DIMENSIONS.width / 100, ORIGINAL_MOVEMENT_DIMENSIONS.depth / 100);
  for (let ray = 0; ray < 8; ray++) {
    const angle = yaw + ray * Math.PI / 4;
    const forward = {x: Math.sin(angle), y: 0, z: Math.cos(angle)};
    let clear = 0;
    for (let step = 1; step <= 8; step++) {
      const point = {x: player.x + forward.x * step * 20, y: player.y,
        z: player.z + forward.z * step * 20};
      if (sampleRoleNavigationFailure(room.battlefield.navigation, point, forward, 1,
          ORIGINAL_MOVEMENT_DIMENSIONS.width, ORIGINAL_MOVEMENT_DIMENSIONS.depth) !== undefined) break;
      clear = step / 8;
    }
    observation.push(clear);
  }
  return {schema: 5, observation, actionSizes: LEARNING_ACTION_SIZES,
    actionMasks: [[true, true, true], [true, true, true], [true, true, true],
      [true, fireReady], items.mask],
    memory: {x: player.x, y: player.y, z: player.z, at: now, deaths: player.deaths, observedAmmo, observedPeers},
    metrics: {hp: player.hp, kills: player.kills, deaths: player.deaths,
      damage: player.roundStats?.damage ?? 0, damageTaken: player.roundStats?.damageTaken ?? 0,
      shots: player.roundStats?.shots ?? 0, hits: player.roundStats?.hits ?? 0,
      objectives: player.objectivesDestroyed, bunkerDamage: player.roundStats?.bunkerDamage ?? 0,
      vipDamage: player.roundStats?.vipDamage ?? 0, team: player.team,
      teamLives: [...room.teamLives], teamScores: [...room.teamScores]},
    nearestEnemyDistance: enemies[0] ? distance(enemies[0]) : undefined,
    weapon: {ammoId: ammo.id, range, instant, projectileSpeed: ammo.runtime.projectileSpeed!,
      penetrates, canReachEnemy: inRange.some(Boolean),
      aimedAtEnemy: selected.kind === 'PLAYER' && enemies.some(peer => peer.id === selected.targetId)},
    alive: player.alive, phase: room.phase, result: room.result};
}
