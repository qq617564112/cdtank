import {tankTurretYaw} from '../../../shared/combat/tank-turret';
import type {RoomState} from '../rooms/state';

export const LEARNING_MAX_PLAYERS = 6;

/** Privileged training inputs for the value network; never sent to the actor. */
export function centralLearningState(room: RoomState, controlled: readonly string[], now: number) {
  const players = [...room.players.values()];
  if (players.length > LEARNING_MAX_PLAYERS) throw new Error('Learning supports at most six actors');
  const teamMetrics = [0, 1].map(team => players.filter(player => player.team === team)
    .reduce((total, player) => ({
      damage: total.damage + (player.roundStats?.damage ?? 0),
      damageTaken: total.damageTaken + (player.roundStats?.damageTaken ?? 0),
      kills: total.kills + player.kills,
      deaths: total.deaths + player.deaths,
      bunkerDamage: total.bunkerDamage + (player.roundStats?.bunkerDamage ?? 0),
      vipDamage: total.vipDamage + (player.roundStats?.vipDamage ?? 0),
    }), {damage: 0, damageTaken: 0, kills: 0, deaths: 0, bunkerDamage: 0, vipDamage: 0}));
  const criticStates = controlled.map(id => {
    const actor = room.players.get(id)!;
    const state = [1, 2, 3, 4, 5].map(mode => Number(room.mode === mode));
    state.push(Number(actor.team === 0), Number(actor.team === 1),
      Math.max(0, (room.timeLimitSeconds ?? room.map.timeLimit) - (now - room.startedAt) / 1000) / 600,
      (room.teamLives[0] ?? 0) / Math.max(1, room.map.tankLimit),
      (room.teamLives[1] ?? 0) / Math.max(1, room.map.tankLimit),
      (room.teamScores[0] ?? 0) / 10000, (room.teamScores[1] ?? 0) / 10000);
    for (let index = 0; index < LEARNING_MAX_PLAYERS; index++) {
      const player = players[index];
      state.push(...(player ? [1, Number(player.id === id),
        Number(room.mode <= 3 && player.team === actor.team), Number(player.alive),
        player.x / 3000, player.y / 100, player.z / 3000,
        Math.sin(player.yaw), Math.cos(player.yaw),
        Math.sin(tankTurretYaw(player.tank.id, player)), Math.cos(tankTurretYaw(player.tank.id, player)),
        player.hp / 1000, Number(player.vip), player.kills / 10, player.deaths / 10,
        player.objectivesDestroyed / 10] : Array<number>(16).fill(0)));
    }
    for (let index = 0; index < 4; index++) {
      const target = room.objectives[index];
      state.push(...(target ? [1, target.x / 3000, target.z / 3000,
        target.hp / Math.max(1, target.maxHp), Number(target.ownerTeam === actor.team),
        Number(target.ownerTeam < 0), Number(target.contested), Number(target.kind === 'DESTROY')]
        : Array<number>(8).fill(0)));
    }
    return state;
  });
  return {criticStates, teamMetrics};
}
