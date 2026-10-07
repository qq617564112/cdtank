import type {GameConnection} from './game-connection';
import type {AccountContext} from './accounts';
import type {GmSupportReply} from '../../../shared/protocols/PtlGmSupport';
import type {MsgGmReply} from '../../../shared/protocols/MsgGmReply';

export interface GmSupportInboxState {
  readonly replies: readonly GmSupportReply[];
  readonly unread: number;
  readonly loading: boolean;
  readonly error: string;
  readonly contextGeneration: number;
}

/** Reads durable GM replies through the shared account transport. */
export class GmSupportInbox {
  private state: GmSupportInboxState = {
    replies: [], unread: 0, loading: false, error: '', contextGeneration: 0,
  };
  private context: AccountContext = {generation: 0};
  private querying = false;
  private readonly seenIds = new Set<number>();
  private readonly listeners = new Set<() => void>();
  private readonly onAccountContext = (): void => {this.acceptContext();};
  private readonly onReply = (message: MsgGmReply): void => {
    const context = this.context;
    if (!context.identity || context.identity.accountId !== message.accountId
        || context !== this.connection.accountContext) return;
    this.merge([message.reply]);
  };
  private readonly unsubscribeAccountContext: () => void;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  readonly getSnapshot = (): GmSupportInboxState => this.state;

  constructor(private readonly connection: GameConnection) {
    this.unsubscribeAccountContext = connection.subscribeAccountContext(this.onAccountContext);
    connection.client.listenMsg('GmReply', this.onReply);
    this.acceptContext();
  }

  dispose(): void {
    this.unsubscribeAccountContext();
    this.connection.client.unlistenMsg('GmReply', this.onReply);
  }

  markAllRead(): void {
    if (!this.state.replies.some(reply => !this.seenIds.has(reply.id))) return;
    for (const reply of this.state.replies) this.seenIds.add(reply.id);
    this.update({unread: 0});
  }

  async refresh(): Promise<void> {
    const context = this.context;
    const accountId = context.identity?.accountId;
    if (!accountId || this.querying || context !== this.connection.accountContext) return;
    this.querying = true;
    this.update({loading: true, error: ''});
    let afterId = 0;
    try {
      await this.connection.ensureConnected();
      if (context !== this.connection.accountContext || this.context !== context) return;
      while (true) {
        const result = await this.connection.client.callApi('GmSupport', {afterId});
        if (context !== this.connection.accountContext || this.context !== context) return;
        if (!result.isSucc) throw new Error(result.err.message);
        if (result.res.accountId !== accountId) throw new Error('GM回复账户不匹配');
        this.merge(result.res.replies);
        if (!result.res.hasMore) break;
        if (!Number.isSafeInteger(result.res.nextAfterId) || result.res.nextAfterId <= afterId) {
          throw new Error('GM回复分页无效');
        }
        afterId = result.res.nextAfterId;
      }
      if (context === this.connection.accountContext && this.context === context) {
        this.update({loading: false, error: ''});
      }
    } catch (error) {
      if (context === this.connection.accountContext && this.context === context) {
        this.update({loading: false, error: error instanceof Error ? error.message : String(error)});
      }
    } finally {
      if (context === this.connection.accountContext && this.context === context) this.querying = false;
    }
  }

  private acceptContext(): void {
    const context = this.connection.accountContext;
    if (context === this.context) return;
    this.context = context;
    this.querying = false;
    this.seenIds.clear();
    this.update({
      replies: [], unread: 0, loading: false, error: '', contextGeneration: context.generation,
    });
    if (context.identity) void this.refresh();
  }

  private merge(incoming: readonly GmSupportReply[]): void {
    const repliesById = new Map(this.state.replies.map(reply => [reply.id, reply]));
    for (const reply of incoming) repliesById.set(reply.id, reply);
    const replies = [...repliesById.values()].sort((left, right) => left.id - right.id);
    const unread = replies.reduce((count, reply) => count + (this.seenIds.has(reply.id) ? 0 : 1), 0);
    this.update({replies, unread});
  }

  private update(patch: Partial<GmSupportInboxState>): void {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }
}
