export interface ModePlayer {
  id: string;
  team: number;
  vip: boolean;
}

export interface ModeTimeLimitPlayer extends ModePlayer {
  hp: number;
  kills: number;
  score: number;
  objectivesDestroyed: number;
}

export interface ModeOutcome {
  winnerTeam: number;
  winnerPlayerId: string;
}

export interface ModeTimeLimitRoom {
  mode: number;
  teamLives: readonly number[];
  teamScores: readonly number[];
  players: ReadonlyMap<string, ModeTimeLimitPlayer>;
}

/** Existing rebuilt kill chain; mode4 has no fixed kill-threshold outcome. */
export function applyModeKill(room: {
  mode: number;
  teamScores: number[];
  teamLives: number[];
}, attacker: ModePlayer, target: ModePlayer): ModeOutcome | undefined {
  if (room.mode === 1 || room.mode === 3) room.teamScores[attacker.team] += 1;
  if (room.mode === 1 && room.teamLives.length === 2) {
    if (room.teamLives[target.team] > 0 && --room.teamLives[target.team] <= 0) {
      return {winnerTeam: attacker.team, winnerPlayerId: ''};
    }
  }
  if (room.mode === 3 && target.vip) {
    return {winnerTeam: attacker.team, winnerPlayerId: ''};
  }
}

/** Decide before roster removal; World synchronously settles the full roster. */
export function forfeitOutcome(room: {
  phase: string;
  mode: number;
  players: ReadonlyMap<string, ModePlayer>;
}, departing: ModePlayer): ModeOutcome | undefined {
  if (room.phase !== 'PLAYING') return;
  const remaining = [...room.players.values()].filter(player => player.id !== departing.id);
  if (remaining.length < 2
      || (room.mode <= 3 && !remaining.some(player => player.team === departing.team))
      || (room.mode === 3 && departing.vip)) {
    const winner = room.mode <= 3 ? remaining.find(player => player.team !== departing.team) : remaining[0];
    return {winnerTeam: room.mode <= 3 ? winner?.team ?? -1 : -1,
      winnerPlayerId: room.mode >= 4 ? winner?.id ?? '' : ''};
  }
}

/** Rebuilt team casualties consume lives and award victory to the opposing team. */
export function applyFriendlyKill(room: {mode: number; teamLives: number[]},
  target: ModePlayer): ModeOutcome | undefined {
  const mode1Depleted = room.mode === 1 && room.teamLives.length === 2
    && room.teamLives[target.team] > 0 && --room.teamLives[target.team] <= 0;
  if (mode1Depleted || (room.mode === 3 && target.vip)) {
    return {winnerTeam: 1 - target.team, winnerPlayerId: ''};
  }
}

/** Explicit time-limit comparison for the next World bridge. */
export function timeLimitOutcome(room: ModeTimeLimitRoom): ModeOutcome {
  const draw: ModeOutcome = {winnerTeam: -1, winnerPlayerId: ''};
  if (room.mode === 1) {
    const winnerTeam = compareTeamValues(room.teamLives[0] ?? 0, room.teamLives[1] ?? 0);
    return winnerTeam < 0 ? draw : {winnerTeam, winnerPlayerId: ''};
  }
  if (room.mode === 2) {
    const winnerTeam = compareTeamValues(room.teamScores[0] ?? 0, room.teamScores[1] ?? 0);
    return winnerTeam < 0 ? draw : {winnerTeam, winnerPlayerId: ''};
  }
  if (room.mode === 3) {
    const players = [...room.players.values()];
    const vipHp = [0, 1].map(team =>
      players.find(player => player.team === team && player.vip)?.hp ?? 0);
    const teamKills = [0, 1].map(team =>
      players.filter(player => player.team === team).reduce((total, player) => total + player.kills, 0));
    const teamScores = [0, 1].map(team =>
      players.filter(player => player.team === team).reduce((total, player) => total + player.score, 0));
    for (const values of [vipHp, teamKills, teamScores]) {
      const winnerTeam = compareTeamValues(values[0], values[1]);
      if (winnerTeam >= 0) return {winnerTeam, winnerPlayerId: ''};
    }
    return draw;
  }
  if (room.mode !== 4 && room.mode !== 5) return draw;
  const metric = (player: ModeTimeLimitPlayer): number =>
    room.mode === 5 ? player.objectivesDestroyed : player.kills;
  const ranked = [...room.players.values()].sort((first, second) =>
    metric(second) - metric(first) || second.score - first.score);
  const first = ranked[0];
  if (!first) return draw;
  const second = ranked[1];
  if (second && metric(first) === metric(second) && first.score === second.score) return draw;
  return {winnerTeam: -1, winnerPlayerId: first.id};
}

function compareTeamValues(first: number, second: number): number {
  return Math.abs(first - second) < 0.000001 ? -1 : first > second ? 0 : 1;
}
