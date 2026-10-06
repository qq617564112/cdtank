import type {MsgRoomSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';

/** Rebuilt projection of authority-owned lives onto the recovered two-count display. */
export function teamInfo(snapshot: MsgRoomSnapshot, playerId: string): {self: string; enemy: string} | undefined {
  if (snapshot.mode !== 1 || !snapshot.match || !['PLAYING','FINISHED'].includes(snapshot.phase)) return;
  const team = snapshot.players.find(player => player.id === playerId)?.team;
  if (team !== 0 && team !== 1) return;
  const counts = snapshot.match.teamLives;
  if (counts.length !== 2 || counts.some(value => !Number.isSafeInteger(value) || value < 0)) return;
  return {self: String(counts[team]), enemy: String(counts[1-team])};
}
