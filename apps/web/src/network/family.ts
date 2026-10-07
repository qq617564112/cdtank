import type {GameConnection} from './game-connection';
import type {AccountContext} from './accounts';
import type {ResFamily} from '../../../shared/protocols/PtlFamily';

export interface FamilyMembership {
  readonly id: string;
  readonly name: string;
}

export interface FamilySnapshot {
  readonly accountGeneration: number;
  readonly loading: boolean;
  readonly membership?: FamilyMembership;
  readonly status: string;
}

/** Reads the authenticated account's current server-owned family membership. */
export class Family {
  private state: FamilySnapshot = {accountGeneration: 0, loading: false, status: ''};
  private context: AccountContext;
  private querying = false;
  private revision = 0;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeAccountContext: () => void;
  readonly getSnapshot = (): FamilySnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  constructor(private readonly connection: GameConnection) {
    this.context = connection.accountContext;
    this.state = {accountGeneration: this.context.generation, loading: false, status: ''};
    this.unsubscribeAccountContext = connection.subscribeAccountContext(() => this.acceptContext());
  }

  dispose(): void {
    this.unsubscribeAccountContext();
  }

  reset(): void {
    this.revision++;
    this.querying = false;
    this.update({accountGeneration: this.context.generation, loading: false, membership: undefined, status: ''});
  }

  async refresh(): Promise<void> {
    const accountId = this.context.identity?.accountId;
    if (!accountId || this.querying || this.context !== this.connection.accountContext) return;
    this.querying = true;
    const revision = this.revision;
    this.update({loading: true, status: ''});
    try {
      await this.connection.ensureConnected();
      const requestContext = this.connection.accountContext;
      if (!requestContext.identity || requestContext.identity.accountId !== accountId
          || requestContext !== this.connection.accountContext || this.context !== requestContext
          || revision !== this.revision) return;
      const result = await this.connection.client.callApi('Family', {});
      if (requestContext !== this.connection.accountContext || this.context !== requestContext
          || revision !== this.revision) return;
      if (!result.isSucc) throw new Error(result.err.message);
      if (result.res.accountId !== accountId) throw new Error('家族归属账户不匹配');
      this.update({membership: this.membership(result.res), loading: false, status: ''});
    } catch (error) {
      if (this.context === this.connection.accountContext && revision === this.revision) {
        this.update({loading: false, status: error instanceof Error ? error.message : String(error)});
      }
    } finally {
      if (this.context === this.connection.accountContext && revision === this.revision) this.querying = false;
    }
  }

  private membership(result: ResFamily): FamilyMembership | undefined {
    return result.family ? {id: result.family.id, name: result.family.name} : undefined;
  }

  private acceptContext(): void {
    const context = this.connection.accountContext;
    if (context === this.context) return;
    this.revision++;
    this.context = context;
    this.querying = false;
    this.update({accountGeneration: context.generation, loading: false, membership: undefined, status: ''});
  }

  private update(patch: Partial<FamilySnapshot>): void {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }
}
