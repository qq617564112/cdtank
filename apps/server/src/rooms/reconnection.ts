import {ROOM_RECONNECT_WINDOW_MS} from '../../../shared/room-reconnection';
import type {RoomWorld as World} from './world-interface';

interface RoomSession {roomId: string; playerId: string;}
interface RetainedSession {
  connectionId: string;
  session: RoomSession;
  timer: ReturnType<typeof setTimeout>;
}

/** Keeps one disconnected account's existing room participant until restore or expiry. */
export class RoomReconnections {
  private readonly retained = new Map<string, RetainedSession>();
  private readonly retaining = new Map<string, Promise<boolean>>();

  constructor(private readonly world: World,
    private readonly accounts: Map<string, string>,
    private readonly sessions: Map<string, RoomSession>,
    private readonly depart: (session: RoomSession) => void | Promise<void>) {}

  retain(connectionId: string): Promise<boolean> {
    const session = this.sessions.get(connectionId);
    const accountId = this.accounts.get(connectionId);
    if (!session || !accountId) return Promise.resolve(false);
    const pending = this.retainSession(connectionId, accountId, session);
    this.retaining.set(accountId, pending);
    void pending.finally(() => {
      if (this.retaining.get(accountId) === pending) this.retaining.delete(accountId);
    }).catch(() => {});
    return pending;
  }

  private async retainSession(connectionId: string, accountId: string, session: RoomSession): Promise<boolean> {
    try {await this.world.pauseDisconnectedPlayer(session.playerId);}
    catch {return false;}
    const snapshot = this.world.snapshot(session.roomId);
    if (!snapshot || !snapshot.players.some(player => player.id === session.playerId)
        || (snapshot.phase !== 'PLAYING' && snapshot.phase !== 'LOADING')) return false;
    const timer = setTimeout(() => {
      this.retained.delete(accountId);
      // Settlement captures account identity before its room binding is removed.
      void Promise.resolve(this.depart(session)).catch(error => {
        console.error('Retained room departure failed', error);
      }).finally(() => {
        this.sessions.delete(connectionId);
        this.accounts.delete(connectionId);
      });
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

  async restore(accountId: string, connectionId: string): Promise<void> {
    // A fast reconnect can arrive before the old room acknowledges released controls.
    await this.retaining.get(accountId);
    const retained = this.retained.get(accountId);
    if (!retained) return;
    clearTimeout(retained.timer);
    this.retained.delete(accountId);
    const {session} = retained;
    try {
      await this.world.restorePlayerConnection(session.playerId, connectionId);
    } catch (error) {
      this.sessions.delete(retained.connectionId);
      this.accounts.delete(retained.connectionId);
      throw error;
    }
    this.sessions.delete(retained.connectionId);
    this.accounts.delete(retained.connectionId);
    this.sessions.set(connectionId, session);
  }
}
