import {WsClient} from 'tsrpc-browser';
import {serviceProto, type ServiceType} from '../../../shared/protocols/serviceProto';
import {AccountConnection} from './accounts';
import {RoomConnection} from './rooms';
import type {ReqAccount, ResAccount} from '../../../shared/protocols/PtlAccount';
import type {ResChannel} from '../../../shared/protocols/PtlChannel';

interface GameConnectionOptions {
  client?: WsClient<ServiceType>;
  tokenStore?: Pick<Storage, 'getItem' | 'setItem'>;
}

/** Owns the single authenticated transport shared by account and room requests. */
export class GameConnection {
  readonly client: WsClient<ServiceType>;
  readonly accounts: AccountConnection;
  readonly rooms: RoomConnection;
  private readonly tokenStore: Pick<Storage, 'getItem' | 'setItem'>;
  private disconnection: Promise<void> = Promise.resolve();
  private disconnecting = false;
  private connectionReady?: Promise<void>;
  private transportReady?: Promise<void>;
  private identity?: ResAccount;

  get hasSavedIdentity(): boolean {return !!this.tokenStore.getItem('cdtank-account-token');}

  async authenticate(credentials?: ReqAccount['credentials']): Promise<ResAccount> {
    await this.disconnect();
    const request: ReqAccount = {token: credentials?.operation === 'LOGIN' ? undefined
      : this.tokenStore.getItem('cdtank-account-token') ?? undefined, credentials};
    const ready: Promise<void> = this.connectAccount(() => ready, request).catch(error => {
      if (this.connectionReady === ready) this.connectionReady = undefined;
      throw error;
    });
    this.connectionReady = ready;
    await ready;
    return this.identity!;
  }

  async channels(channelId?: string): Promise<ResChannel> {
    await this.ensureConnected();
    const result = await this.client.callApi('Channel', {operation: channelId === undefined ? 'QUERY' : 'ENTER', channelId});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  constructor(options: GameConnectionOptions = {}) {
    this.client = options.client ?? new WsClient(serviceProto, {
      server: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/game`,
      logger: undefined, heartbeat: {interval: 5000, timeout: 10000},
    });
    this.tokenStore = options.tokenStore ?? localStorage;
    this.accounts = new AccountConnection(this.client, () => this.ensureConnected());
    this.rooms = new RoomConnection(this.client, () => this.ensureConnected());
    this.client.flows.postDisconnectFlow.push(input => {
      if (this.connectionReady === this.transportReady) this.connectionReady = undefined;
      this.transportReady = undefined;
      return input;
    });
  }

  ensureConnected(): Promise<void> {
    if (!this.connectionReady) {
      const ready: Promise<void> = this.connectAccount(() => ready).catch(error => {
        if (this.connectionReady === ready) this.connectionReady = undefined;
        throw error;
      });
      this.connectionReady = ready;
    }
    return this.connectionReady;
  }

  private async connectAccount(readiness: () => Promise<void>, request?: ReqAccount): Promise<void> {
    // Returning and refreshing immediately must wait for the old close event.
    await this.disconnection;
    if (this.connectionReady !== readiness()) throw new Error('连接已取消，请重试');
    this.transportReady = readiness();
    const connection = await this.client.connect();
    if (this.connectionReady !== readiness()) throw new Error('连接已取消，请重试');
    if (!connection.isSucc) throw new Error(connection.errMsg);
    const account = await this.client.callApi('Account', request ?? {
      token: this.tokenStore.getItem('cdtank-account-token') ?? undefined,
    });
    if (this.connectionReady !== readiness()) throw new Error('连接已取消，请重试');
    if (!account.isSucc) throw new Error(account.err.message);
    this.tokenStore.setItem('cdtank-account-token', account.res.token);
    this.identity = account.res;
  }

  disconnect(): Promise<void> {
    this.connectionReady = undefined;
    if (!this.disconnecting) {
      this.disconnecting = true;
      this.disconnection = this.client.disconnect().finally(() => {
        this.disconnecting = false;
      });
    }
    return this.disconnection;
  }
}
