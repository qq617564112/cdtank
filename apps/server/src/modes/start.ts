interface ModeParticipant {
  team: number;
  vip: boolean;
}

/** Keep the existing balanced insertion policy and team-zero tie break. */
export function joiningTeam(mode: number, players: Iterable<{team: number}>): number {
  if (mode !== 1 && mode !== 2 && mode !== 3) return 0;
  const members = [...players];
  return members.filter(player => player.team === 0).length
    <= members.filter(player => player.team === 1).length ? 0 : 1;
}

/** Existing rebuilt opening policies; original server authority is unresolved. */
export function initializeModeRound(room: {
  mode: number;
  map: {tankLimit: number};
  teamScores: number[];
  teamLives: number[];
}): (player: ModeParticipant) => void {
  room.teamScores = [0, 0];
  const lives = room.map.tankLimit > 0 ? room.map.tankLimit : 30;
  room.teamLives = room.mode === 1 ? [lives, lives] : [];
  const vipTeams = new Set<number>();
  // Called in room insertion order, before each participant's attribute reset.
  return player => {
    player.vip = room.mode === 3 && !vipTeams.has(player.team);
    if (player.vip) vipTeams.add(player.team);
  };
}
