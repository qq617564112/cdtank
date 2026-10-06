interface ModeParticipant {
  id: string;
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
  players: ReadonlyMap<string, ModeParticipant>;
  teamScores: number[];
  teamLives: number[];
}): (player: ModeParticipant) => void {
  room.teamScores = [0, 0];
  room.teamLives = room.mode === 1 && room.map.tankLimit > 0
    ? [room.map.tankLimit, room.map.tankLimit] : [];
  const vipIds = new Set<string>();
  if (room.mode === 3) {
    const teams = new Set<number>();
    for (const player of room.players.values()) {
      if ((player.team === 0 || player.team === 1) && !teams.has(player.team)) {
        teams.add(player.team);
        vipIds.add(player.id);
      }
    }
  }
  // Stable room order chooses one leader per team; every round resets the prior VIP.
  return player => {
    player.vip = room.mode === 3 && vipIds.has(player.id);
  };
}
