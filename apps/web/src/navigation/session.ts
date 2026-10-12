export interface LoginSession {accountId: string; channelId?: string;}
export interface RoomSession {accountId: string; roomId: string; playerId: string;}

export function readLoginSession(): LoginSession | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('cdtank-login-session') ?? 'null');
    if (value && typeof value === 'object' && 'accountId' in value && typeof value.accountId === 'string') {
      return {accountId: value.accountId,
        channelId: 'channelId' in value && typeof value.channelId === 'string' ? value.channelId : undefined};
    }
  } catch {localStorage.removeItem('cdtank-login-session');}
  return undefined;
}

export function saveLoginSession(session?: LoginSession): void {
  if (session) localStorage.setItem('cdtank-login-session', JSON.stringify(session));
  else localStorage.removeItem('cdtank-login-session');
}

export function readRoomSession(): RoomSession | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem('cdtank-room-session') ?? 'null');
    if (value && typeof value === 'object'
        && 'accountId' in value && typeof value.accountId === 'string'
        && 'roomId' in value && typeof value.roomId === 'string'
        && 'playerId' in value && typeof value.playerId === 'string') return {
      accountId: value.accountId, roomId: value.roomId, playerId: value.playerId,
    };
  } catch {sessionStorage.removeItem('cdtank-room-session');}
  return undefined;
}

export function saveRoomSession(session?: RoomSession): void {
  if (session) sessionStorage.setItem('cdtank-room-session', JSON.stringify(session));
  else sessionStorage.removeItem('cdtank-room-session');
}
