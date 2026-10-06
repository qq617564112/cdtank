import type {FriendRecord, ReqFriends} from '../../../shared/protocols/PtlFriends';
import type {GameConnection} from './game-connection';

interface FriendState {friends: FriendRecord[]; pending: boolean; status: string;}

/** Account relationships are confirmed by the server, independently of battle snapshots. */
export class Friends {
  private state: FriendState = {friends: [], pending: false, status: ''};
  private revision = 0;
  private querying = false;
  private readonly listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => {this.listeners.delete(listener);};
  };
  readonly getSnapshot = (): FriendState => this.state;
  constructor(private readonly connection: GameConnection) {
    connection.client.flows.postDisconnectFlow.push(input => {
      this.revision++; this.querying = false;
      this.update({friends: [], pending: false, status: '连接已断开'});
      return input;
    });
  }
  private update(patch: Partial<FriendState>): void {
    this.state = {...this.state, ...patch}; for (const listener of this.listeners) listener();
  }
  async refresh(): Promise<void> {
    if (this.querying || this.state.pending) return;
    this.querying = true; const revision = this.revision;
    try {
      await this.connection.ensureConnected();
      if (revision !== this.revision) return;
      const result = await this.connection.client.callApi('Friends', {operation: 'QUERY'});
      if (revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      const friends = result.res.friends;
      if (JSON.stringify(friends) !== JSON.stringify(this.state.friends) || this.state.status) {
        this.update({friends, status: ''});
      }
    } catch (error) {
      if (revision === this.revision) this.update({status: error instanceof Error ? error.message : String(error)});
    } finally {if (revision === this.revision) this.querying = false;}
  }
  async change(operation: 'ADD' | 'REMOVE', targetAccountId: string): Promise<void> {
    if (this.state.pending) return;
    const revision = ++this.revision; this.querying = false;
    this.update({pending: true, status: ''});
    try {
      await this.connection.ensureConnected();
      if (revision !== this.revision) return;
      const request: ReqFriends = {operation, targetAccountId};
      const result = await this.connection.client.callApi('Friends', request);
      if (revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      this.update({friends: result.res.friends, status: operation === 'ADD' ? '已添加好友' : '已删除好友'});
    } catch (error) {
      if (revision === this.revision) this.update({status: error instanceof Error ? error.message : String(error)});
    } finally {if (revision === this.revision) this.update({pending: false});}
  }
}
