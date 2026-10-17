import {isHiddenFromOpponent} from '../../../shared/combat/optical-camouflage';
import {isRoleFireReady} from '../battle/roles/reload';
import type {RoomState} from '../rooms/state';
import type {PlayerState} from '../battle/player-state';

export const LEARNING_ACTION_SIZES = [3, 3, 3, 2, 9] as const;

export interface LearningMemory {
  x: number;
  y: number;
  z: number;
  at: number;
  deaths: number;
}

export interface LearningGoal {x: number; z: number;}

/** Actor observations contain local perceptions; reward statistics stay separate. */
export function observeLearning(room: RoomState, player: PlayerState, maximumHp: number,
  now: number, previous?: LearningMemory, goal?: LearningGoal) {
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
  const visible = (point: {x: number; y: number; z: number}) => distance(point) <= 600
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
  const itemMask = [true, player.alive];
  const hotkeys = player.combat.record?.arrays.get(0);
  for (let slot = 2; slot <= 8; slot++) {
    const instance = (hotkeys?.[slot - 2] ?? 0) >>> 0;
    const item = player.inventory.find(record => (record.instanceId >>> 0) === instance);
    const available = !!item && item.ownedQuantity > 0 && item.battleQuantity > 0
      && player.alive && player.combat.status === 2;
    itemMask.push(available);
    observation.push(item ? item.itemTableId / 30000 : 0,
      item ? Math.min(1, item.battleQuantity / 20) : 0, Number(available));
  }
  observation.push(...(goal ? [1, ...local(goal)] : [0, 0, 0]));
  const fireReady = player.alive && !player.combat.pendingShot
    && isRoleFireReady(player.combat.getFlag(11) !== 0,
      (now - room.startedAt) / 1000, player.combat.nextAvailableSeconds);
  return {schema: 1, observation, actionSizes: LEARNING_ACTION_SIZES,
    actionMasks: [[true, true, true], [true, true, true], [true, true, true],
      [true, fireReady], itemMask],
    memory: {x: player.x, y: player.y, z: player.z, at: now, deaths: player.deaths},
    metrics: {hp: player.hp, kills: player.kills, deaths: player.deaths,
      damage: player.roundStats?.damage ?? 0, damageTaken: player.roundStats?.damageTaken ?? 0,
      shots: player.roundStats?.shots ?? 0, hits: player.roundStats?.hits ?? 0,
      objectives: player.objectivesDestroyed, bunkerDamage: player.roundStats?.bunkerDamage ?? 0,
      vipDamage: player.roundStats?.vipDamage ?? 0, team: player.team,
      teamLives: [...room.teamLives], teamScores: [...room.teamScores]},
    nearestEnemyDistance: enemies[0] ? distance(enemies[0]) : undefined,
    alive: player.alive, phase: room.phase, result: room.result};
}
