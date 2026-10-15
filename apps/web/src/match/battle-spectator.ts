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
    let local: MsgRoomSnapshot['players'][number] | undefined;
    for (const player of snapshot.players) {
      if (player.id === localPlayerId) {local = player; break;}
    }
    const dead = snapshot.phase === 'PLAYING' && local?.alive === false;
    const deathStartedAt = dead && local && local.respawnAt > 0
      ? local.respawnAt - BATTLE_RESPAWN_SECONDS * 1000 : undefined;
    const watchingWreck = deathStartedAt !== undefined
      && serverNow < deathStartedAt + DEATH_WRECK_VIEW_SECONDS * 1000;
    const active = dead && !watchingWreck;
    const previousId = context === this.context ? this.state.playerId : undefined;
    const previousPlayers = this.state.players;
    let updatedPlayers: SpectatorSnapshot['players'][number][] | undefined;
    let count = 0, firstId: string | undefined, selectionPresent = false;
    if (active && local && snapshot.mode <= 3) {
      for (const player of snapshot.players) {
        if (player.id === localPlayerId || !player.alive || player.team !== local.team) continue;
        const previous = previousPlayers[count];
        const same = previous?.id === player.id && previous.name === player.name;
        if (!same && !updatedPlayers) updatedPlayers = previousPlayers.slice(0, count);
        if (updatedPlayers) updatedPlayers.push(same ? previous : {id: player.id, name: player.name});
        if (count === 0) firstId = player.id;
        if (player.id === previousId) selectionPresent = true;
        count++;
      }
    }
    const players = updatedPlayers ?? (count === previousPlayers.length ? previousPlayers : previousPlayers.slice(0, count));
    const playerId = selectionPresent ? previousId : firstId;
    const wreckStartedAt = watchingWreck ? deathStartedAt : undefined;
    this.context = context;
    if (this.state.active === active && this.state.players === players && this.state.playerId === playerId
      && this.state.wreckStartedAt === wreckStartedAt) return;
    this.publish({active, players, playerId, wreckStartedAt});
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
