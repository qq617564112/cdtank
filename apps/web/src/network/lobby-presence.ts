import type {ResLobbyPlayers} from '../../../shared/protocols/PtlLobbyPlayers';
import type {GameConnection} from './game-connection';

interface LobbyPresenceState {
  inRoom: boolean;
  loading: boolean;
  status: string;
  players: ResLobbyPlayers['players'];
}

/** Server-owned lobby members, queried independently from the simulation clock. */
export class LobbyPresence {
  private state: LobbyPresenceState = {inRoom: false, loading: false, status: '', players: []};
  private generation = 0;
  private querying = false;
  private timer?: ReturnType<typeof setInterval>;
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = (): LobbyPresenceState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  constructor(private readonly connection: GameConnection) {
    connection.client.flows.postDisconnectFlow.push(input => {
      this.generation++;
      this.querying = false;
      this.update({players: [], loading: false, status: '连接已断开'});
      return input;
    });
  }

  private update(patch: Partial<LobbyPresenceState>): void {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }

  start(): void {
    if (this.timer !== undefined) return;
    void this.refresh();
    this.timer = setInterval(() => {
      if (!this.state.inRoom && this.connection.client.isConnected && !document.hidden) void this.refresh();
    }, 1000);
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.generation++;
    this.querying = false;
    this.update({players: [], loading: false, status: ''});
  }

  setInRoom(inRoom: boolean): void {
    if (this.state.inRoom === inRoom) return;
    this.generation++;
    this.querying = false;
    this.update({inRoom, players: [], loading: false, status: ''});
    if (!inRoom && this.timer !== undefined) void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.state.inRoom || this.querying) return;
    const generation = this.generation;
    this.querying = true;
    if (!this.state.players.length) this.update({loading: true, status: ''});
    try {
      await this.connection.ensureConnected();
      if (generation !== this.generation || this.state.inRoom) return;
      const result = await this.connection.client.callApi('LobbyPlayers', {});
      if (generation !== this.generation || this.state.inRoom) return;
      if (!result.isSucc) throw new Error(result.err.message);
      const players = result.res.players;
      const changed = players.length !== this.state.players.length || players.some((player, index) =>
        player.accountId !== this.state.players[index]?.accountId || player.name !== this.state.players[index]?.name);
      if (changed || this.state.loading || this.state.status) this.update({players, loading: false, status: ''});
    } catch (error) {
      if (generation === this.generation) this.update({loading: false, status: error instanceof Error ? error.message : String(error)});
    } finally {
      if (generation === this.generation) this.querying = false;
    }
  }
}
