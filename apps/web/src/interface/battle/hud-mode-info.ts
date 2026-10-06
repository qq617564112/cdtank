import type {MsgRoomSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {teamInfo} from './team-info';

/** Rebuilt five-mode battle-info values from ordinary room snapshots. Missing
 * authority fields stay undefined; the projection never fills score-like zeroes.
 */
export interface HudModeInfo {
  mode: number;
  self?: string;
  enemy?: string;
  info?: string;
  binding: string;
  label: string;
  finished: boolean;
}

export function modeInfo(snapshot: MsgRoomSnapshot, playerId: string): HudModeInfo | undefined {
  if (!['PLAYING', 'FINISHED'].includes(snapshot.phase)) return;
  const base = {mode: snapshot.mode, finished: snapshot.phase === 'FINISHED'};
  const local = snapshot.players.find(player => player.id === playerId);
  const team = local?.team;
  if (snapshot.mode === 1) {
    const counts = teamInfo(snapshot, playerId);
    return counts ? {...base, ...counts, binding: 'teamLives', label: '剩余生命'} : undefined;
  }
  if (snapshot.mode === 2) {
    if ((team !== 0 && team !== 1) || snapshot.teamScores.length !== 2
        || snapshot.teamScores.some(value => !Number.isFinite(value))) return;
    return {...base, self: String(Math.trunc(snapshot.teamScores[team])), enemy: String(Math.trunc(snapshot.teamScores[1 - team])),
      binding: 'teamScores', label: '城堡伤害'};
  }
  if (snapshot.mode === 3) {
    if (team !== 0 && team !== 1) return;
    const own = vipHealth(snapshot, team), enemy = vipHealth(snapshot, 1 - team);
    if (!own && !enemy) return;
    return {...base, self: own, enemy, binding: 'vipHp', label: '王生命'};
  }
  if (snapshot.mode === 4) {
    const resultPlayer = snapshot.phase === 'FINISHED'
      ? snapshot.match?.result?.players.find(player => player.id === playerId) : undefined;
    const kills = resultPlayer?.kills ?? local?.kills;
    return kills === undefined ? undefined : {...base, info: String(kills), binding: 'localKills', label: '本机击毁'};
  }
  if (snapshot.mode === 5) {
    const objectives = snapshot.match?.objectives;
    if (!objectives) return;
    const destroys = objectives.filter(objective => objective.kind === 'DESTROY');
    if (!destroys.length) return;
    return {...base, info: String(destroys.filter(objective => objective.hp > 0).length),
      binding: 'destroyObjectivesRemaining', label: '完好目标'};
  }
  return;
}

function vipHealth(snapshot: MsgRoomSnapshot, team: number): string | undefined {
  const vip = snapshot.players.find(player => player.isVIP && player.team === team);
  if (!vip || !Number.isFinite(vip.hp) || !Number.isFinite(vip.maxHp)) return;
  return String(vip.hp);
}
