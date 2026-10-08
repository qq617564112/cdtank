import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {BATTLE_RESPAWN_SECONDS, DEATH_WRECK_VIEW_SECONDS} from '../../../shared/combat/battle-respawn';

export interface SpectatorSnapshot {
  active: boolean;
  players: readonly {id: string; name: string}[];
  playerId?: string;
  wreckStartedAt?: number;
}

/** Camera selection never changes the local participant or its input identity. */
export class BattleSpectator {
  private state: SpectatorSnapshot = {active: false, players: []};
  private context = '';
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): SpectatorSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  update(snapshot: MsgRoomSnapshot, localPlayerId: string, serverNow = snapshot.serverTime): void {
    const context = `${snapshot.roomId}:${snapshot.match?.round ?? 0}:${localPlayerId}`;
    const local = snapshot.players.find(player => player.id === localPlayerId);
    const dead = snapshot.phase === 'PLAYING' && local?.alive === false;
    const deathStartedAt = dead && local.respawnAt > 0
      ? local.respawnAt - BATTLE_RESPAWN_SECONDS * 1000 : undefined;
    const watchingWreck = deathStartedAt !== undefined
      && serverNow < deathStartedAt + DEATH_WRECK_VIEW_SECONDS * 1000;
    const active = dead && !watchingWreck;
    const players = active && local && snapshot.mode <= 3
      ? snapshot.players.filter(player => player.id !== localPlayerId
        && player.alive && player.team === local.team).map(({id, name}) => ({id, name})) : [];
    const previousId = context === this.context ? this.state.playerId : undefined;
    const playerId = players.some(player => player.id === previousId) ? previousId : players[0]?.id;
    this.context = context;
    this.publish({active, players, playerId, wreckStartedAt: watchingWreck ? deathStartedAt : undefined});
  }

  readonly switchPlayer = (direction: -1 | 1): void => {
    const {active, players, playerId} = this.state;
    if (!active || players.length < 2) return;
    const index = players.findIndex(player => player.id === playerId);
    const next = (index + direction + players.length) % players.length;
    this.publish({...this.state, playerId: players[next].id});
  };

  clear(): void {
    this.context = '';
    this.publish({active: false, players: []});
  }

  private publish(next: SpectatorSnapshot): void {
    if (this.state.active === next.active && this.state.playerId === next.playerId
      && this.state.wreckStartedAt === next.wreckStartedAt
      && this.state.players.length === next.players.length
      && this.state.players.every((player, index) => player.id === next.players[index].id
        && player.name === next.players[index].name)) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
