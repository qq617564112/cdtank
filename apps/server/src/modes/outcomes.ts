interface ModePlayer {
  id: string;
  team: number;
  vip: boolean;
}

export interface ModeOutcome {
  winnerTeam: number;
  winnerPlayerId: string;
}

/** Existing rebuilt kill counters and winning conditions, not original authority. */
export function applyModeKill(room: {
  mode: number;
  targetScore: number;
  teamScores: number[];
  teamLives: number[];
}, attacker: ModePlayer & {kills: number}, target: ModePlayer): ModeOutcome | undefined {
  if (room.mode === 1 || room.mode === 3) room.teamScores[attacker.team] += 1;
  if (room.mode === 1) room.teamLives[target.team]--;
  if ((room.mode === 1 && room.teamLives[target.team] <= 0)
      || (room.mode === 3 && target.vip)
      || (room.mode === 4 && attacker.kills >= room.targetScore)) {
    return {winnerTeam: room.mode <= 3 ? attacker.team : -1,
      winnerPlayerId: room.mode === 4 ? attacker.id : ''};
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
  if (room.mode === 1) room.teamLives[target.team]--;
  if ((room.mode === 1 && room.teamLives[target.team] <= 0) || (room.mode === 3 && target.vip)) {
    return {winnerTeam: 1 - target.team, winnerPlayerId: ''};
  }
}
