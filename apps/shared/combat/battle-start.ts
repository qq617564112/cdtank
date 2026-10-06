import type {MsgRoomSnapshot} from '../protocols/MsgRoomSnapshot';

export const BATTLE_MODE_INTRO_MS = 2000;
export const BATTLE_FIGHT_INTRO_MS = 1000;
export const BATTLE_INTRO_MS = 3000;

export type BattleIntroStage = 'hidden' | 'mode' | 'fight';

/** Server-clock intro stage; late observers see only the remaining tail. */
export function battleIntroStage(snapshot: Pick<MsgRoomSnapshot, 'phase' | 'serverTime' | 'match'>,
  now = snapshot.serverTime): BattleIntroStage {
  const startsAt = snapshot.match?.battleStartsAt;
  if (snapshot.phase !== 'PLAYING' || startsAt === undefined || now >= startsAt) return 'hidden';
  return now < startsAt - BATTLE_FIGHT_INTRO_MS ? 'mode' : 'fight';
}

/** Battle movement, input and simulation are live only at/after the shared start. */
export function battleIsActive(snapshot: Pick<MsgRoomSnapshot, 'phase' | 'serverTime' | 'match'>,
  now = snapshot.serverTime): boolean {
  if (snapshot.phase !== 'PLAYING') return false;
  const startsAt = snapshot.match?.battleStartsAt;
  return startsAt === undefined || now >= startsAt;
}
