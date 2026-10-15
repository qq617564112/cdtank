import type {MsgRoomSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';

export interface TeamCounts {self: string; enemy: string;}

/** Rebuilt projection of authority-owned lives onto the recovered two-count display. */
export function teamInfo(snapshot: MsgRoomSnapshot, playerId: string, previous?: TeamCounts): TeamCounts | undefined {
  if (snapshot.mode !== 1 || !snapshot.match || (snapshot.phase !== 'PLAYING' && snapshot.phase !== 'FINISHED')) return;
  let team: number | undefined;
  for (const player of snapshot.players) {
    if (player.id === playerId) {team = player.team; break;}
  }
  if (team !== 0 && team !== 1) return;
  const counts = snapshot.match.teamLives;
  if (counts.length !== 2) return;
  for (const value of counts) if (!Number.isSafeInteger(value) || value < 0) return;
  const self = String(counts[team]), enemy = String(counts[1 - team]);
  return previous?.self === self && previous.enemy === enemy ? previous : {self, enemy};
}
