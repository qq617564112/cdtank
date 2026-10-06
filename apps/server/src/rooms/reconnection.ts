import {ROOM_RECONNECT_WINDOW_MS} from '../../../shared/room-reconnection';
import type {World} from '../world';

interface RoomSession {roomId: string; playerId: string;}
interface RetainedSession {
  connectionId: string;
  session: RoomSession;
  timer: ReturnType<typeof setTimeout>;
}

/** Keeps one disconnected account's existing room participant until restore or expiry. */
export class RoomReconnections {
  private readonly retained = new Map<string, RetainedSession>();

  constructor(private readonly world: World,
    private readonly accounts: Map<string, string>,
    private readonly sessions: Map<string, RoomSession>,
    private readonly depart: (session: RoomSession) => void) {}

  retain(connectionId: string): boolean {
    const session = this.sessions.get(connectionId);
    const accountId = this.accounts.get(connectionId);
    const phase = session ? this.world.snapshot(session.roomId)?.phase : undefined;
    if (!session || !accountId || (phase !== 'PLAYING' && phase !== 'LOADING')) return false;
    this.world.pauseDisconnectedPlayer(session.playerId);
    const timer = setTimeout(() => {
      this.retained.delete(accountId);
      // Settlement captures account identity before its room binding is removed.
      this.depart(session);
      this.sessions.delete(connectionId);
      this.accounts.delete(connectionId);
    }, ROOM_RECONNECT_WINDOW_MS);
    timer.unref();
    this.retained.set(accountId, {connectionId, session, timer});
    return true;
  }

  releasePlayer(playerId: string): void {
    for (const [accountId, retained] of this.retained) {
      if (retained.session.playerId !== playerId) continue;
      clearTimeout(retained.timer);
      this.retained.delete(accountId);
      this.sessions.delete(retained.connectionId);
      this.accounts.delete(retained.connectionId);
    }
  }

  restore(accountId: string, connectionId: string): void {
    const retained = this.retained.get(accountId);
    if (!retained) return;
    clearTimeout(retained.timer);
    this.retained.delete(accountId);
    const {session} = retained;
    this.world.restorePlayerConnection(session.playerId, connectionId);
    this.sessions.delete(retained.connectionId);
    this.accounts.delete(retained.connectionId);
    this.sessions.set(connectionId, session);
  }
}
