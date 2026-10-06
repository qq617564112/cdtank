import type {BlockedRecord, ReqBlacklist} from '../../../shared/protocols/PtlBlacklist';
import type {GameConnection} from './game-connection';

interface BlacklistState {blocked: BlockedRecord[]; pending: boolean; status: string;}

/** Account relationships are confirmed by the server, independently of battle snapshots. */
export class Blacklist {
  private state: BlacklistState = {blocked: [], pending: false, status: ''};
  private revision = 0;
  private querying = false;
  private readonly listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => {this.listeners.delete(listener);};
  };
  readonly getSnapshot = (): BlacklistState => this.state;
  constructor(private readonly connection: GameConnection) {
    connection.client.flows.postDisconnectFlow.push(input => {
      this.revision++; this.querying = false;
      this.update({blocked: [], pending: false, status: '连接已断开'});
      return input;
    });
  }
  private update(patch: Partial<BlacklistState>): void {
    this.state = {...this.state, ...patch}; for (const listener of this.listeners) listener();
  }
  async refresh(): Promise<void> {
    if (this.querying || this.state.pending) return;
    this.querying = true; const revision = this.revision;
    try {
      await this.connection.ensureConnected();
      if (revision !== this.revision) return;
      const result = await this.connection.client.callApi('Blacklist', {operation: 'QUERY'});
      if (revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      const blocked = result.res.blocked;
      if (JSON.stringify(blocked) !== JSON.stringify(this.state.blocked) || this.state.status) {
        this.update({blocked, status: ''});
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
      const request: ReqBlacklist = {operation, targetAccountId};
      const result = await this.connection.client.callApi('Blacklist', request);
      if (revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      this.update({blocked: result.res.blocked, status: operation === 'ADD' ? '已屏蔽' : '已解除屏蔽'});
    } catch (error) {
      if (revision === this.revision) this.update({status: error instanceof Error ? error.message : String(error)});
    } finally {if (revision === this.revision) this.update({pending: false});}
  }
}
