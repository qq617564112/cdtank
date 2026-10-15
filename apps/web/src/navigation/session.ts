export interface LoginSession {accountId: string; channelId?: string;}

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
