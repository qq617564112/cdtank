import type {MsgRoomSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {teamInfo, type TeamCounts} from './team-info';

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

export function modeInfo(snapshot: MsgRoomSnapshot, playerId: string,
  previous?: HudModeInfo, teamCounts?: TeamCounts): HudModeInfo | undefined {
  if (snapshot.phase !== 'PLAYING' && snapshot.phase !== 'FINISHED') return;
  const mode = snapshot.mode, finished = snapshot.phase === 'FINISHED';
  let local: MsgRoomSnapshot['players'][number] | undefined;
  for (const player of snapshot.players) {
    if (player.id === playerId) {local = player; break;}
  }
  const team = local?.team;
  let self: string | undefined, enemy: string | undefined, info: string | undefined;
  let binding: string, label: string;
  if (mode === 1) {
    const counts = teamCounts ?? teamInfo(snapshot, playerId);
    if (!counts) return;
    self = counts.self; enemy = counts.enemy;
    binding = 'teamLives'; label = '剩余生命';
  } else if (mode === 2) {
    if ((team !== 0 && team !== 1) || snapshot.teamScores.length !== 2) return;
    for (const score of snapshot.teamScores) if (!Number.isFinite(score)) return;
    self = String(Math.trunc(snapshot.teamScores[team]));
    enemy = String(Math.trunc(snapshot.teamScores[1 - team]));
    binding = 'teamScores'; label = '城堡伤害';
  } else if (mode === 3) {
    if (team !== 0 && team !== 1) return;
    self = vipHealth(snapshot, team); enemy = vipHealth(snapshot, 1 - team);
    if (!self && !enemy) return;
    binding = 'vipHp'; label = '王生命';
  } else if (mode === 4) {
    const stats = snapshot.phase === 'FINISHED'
      ? snapshot.match?.result?.players.find(player => player.id === playerId) : local;
    const catsInfo = stats?.catsInfo;
    const dogsInfo = stats?.dogsInfo;
    if (catsInfo === undefined || dogsInfo === undefined
        || !Number.isFinite(catsInfo) || !Number.isFinite(dogsInfo)) return;
    info = String(catsInfo + dogsInfo);
    binding = 'catsInfo+dogsInfo'; label = '本机击毁';
  } else if (mode === 5) {
    const objectives = snapshot.match?.objectives;
    if (!objectives) return;
    let total = 0, remaining = 0;
    for (const objective of objectives) {
      if (objective.kind !== 'DESTROY') continue;
      total++;
      if (objective.hp > 0) remaining++;
    }
    if (!total) return;
    info = String(remaining);
    binding = 'destroyObjectivesRemaining'; label = '完好目标';
  } else return;
  if (previous?.mode === mode && previous.finished === finished
    && previous.self === self && previous.enemy === enemy && previous.info === info
    && previous.binding === binding && previous.label === label) return previous;
  return mode <= 3 ? {mode, finished, self, enemy, binding, label} : {mode, finished, info, binding, label};
}

function vipHealth(snapshot: MsgRoomSnapshot, team: number): string | undefined {
  for (const player of snapshot.players) {
    if (!player.isVIP || player.team !== team) continue;
    if (!Number.isFinite(player.hp) || !Number.isFinite(player.maxHp)) return;
    return String(player.hp);
  }
}
