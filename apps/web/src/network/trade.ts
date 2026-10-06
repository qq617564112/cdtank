import type {ReqTrade, ResTrade} from '../../../shared/protocols/PtlTrade';
import type {GameConnection} from './game-connection';

interface TradeState {value?: ResTrade; pending: boolean; status: string;}

/** Trade state is confirmed by account authority; React owns only input drafts. */
export class Trade {
  private state: TradeState = {pending: false, status: ''};
  private revision = 0;
  private querying = false;
  private receivedRevision = 0;
  private readonly listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => {this.listeners.delete(listener);};
  };
  readonly getSnapshot = (): TradeState => this.state;
  constructor(private readonly connection: GameConnection) {
    connection.client.listenMsg('TradeState', value => {
      this.receivedRevision++;
      const previous = this.state.value?.session;
      if (previous?.id === value.session?.id && previous!.revision > value.session!.revision) return;
      this.update({value});
    });
    connection.client.flows.postDisconnectFlow.push(input => {
      this.revision++; this.querying = false;
      this.update({value: undefined, pending: false, status: '连接已断开'}); return input;
    });
  }
  private update(patch: Partial<TradeState>): void {
    this.state = {...this.state, ...patch}; for (const listener of this.listeners) listener();
  }
  async refresh(): Promise<void> {
    if (this.querying || this.state.pending) return;
    this.querying = true;
    const revision = this.revision, receivedRevision = this.receivedRevision;
    try {
      await this.connection.ensureConnected();
      const result = await this.connection.client.callApi('Trade', {operation: 'QUERY'});
      if (revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      const current = this.state.value?.session, incoming = result.res.session;
      if (receivedRevision !== this.receivedRevision && current?.id !== incoming?.id) return;
      if (!current || current.id !== incoming?.id || current.revision <= incoming.revision) this.update({value: result.res});
    } catch (error) {
      if (revision === this.revision) this.update({status: error instanceof Error ? error.message : String(error)});
    } finally {if (revision === this.revision) this.querying = false;}
  }
  async act(request: ReqTrade): Promise<void> {
    if (this.state.pending) return;
    const revision = ++this.revision; this.querying = false;
    this.update({pending: true, status: ''});
    try {
      await this.connection.ensureConnected();
      const result = await this.connection.client.callApi('Trade', request);
      if (revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      const current = this.state.value?.session, incoming = result.res.session;
      if (!current || current.id !== incoming?.id || current.revision <= incoming.revision) this.update({value: result.res});
    } catch (error) {
      if (revision === this.revision) this.update({status: error instanceof Error ? error.message : String(error)});
    } finally {
      if (revision === this.revision) {this.update({pending: false}); void this.refresh();}
    }
  }
}
