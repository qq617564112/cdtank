import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';

export type ScoreboardPlayer = Pick<PlayerSnapshot,
  'id' | 'name' | 'team' | 'petId' | 'score' | 'kills' | 'deaths' | 'alive' | 'isVIP'> & {
  objectivesDestroyed: number;
};

export interface ScoreboardSnapshot {
  roomId: string;
  round: number;
  mode: number;
  playerId: string;
  players: readonly ScoreboardPlayer[];
}

/** Publish score changes independently of positions, timers and HUD animations. */
export class BattleScoreboard {
  private state?: ScoreboardSnapshot;
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = (): ScoreboardSnapshot | undefined => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  update(snapshot: MsgRoomSnapshot, playerId: string): void {
    if (snapshot.phase !== 'PLAYING' || !snapshot.players.some(player => player.id === playerId)) {
      this.clear();
      return;
    }
    const next: ScoreboardSnapshot = {
      roomId: snapshot.roomId, round: snapshot.match?.round ?? 0, mode: snapshot.mode, playerId,
      players: snapshot.players.map(player => ({
        id: player.id, name: player.name, team: player.team, petId: player.petId,
        score: player.score, kills: player.kills, deaths: player.deaths,
        alive: player.alive, isVIP: player.isVIP, objectivesDestroyed: player.objectivesDestroyed ?? 0,
      })),
    };
    const previous = this.state;
    if (previous && previous.roomId === next.roomId && previous.round === next.round
        && previous.mode === next.mode && previous.playerId === next.playerId
        && previous.players.length === next.players.length && previous.players.every((player, index) => {
          const other = next.players[index];
          return player.id === other.id && player.name === other.name && player.team === other.team
            && player.petId === other.petId && player.score === other.score && player.kills === other.kills
            && player.deaths === other.deaths && player.alive === other.alive && player.isVIP === other.isVIP
            && player.objectivesDestroyed === other.objectivesDestroyed;
        })) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    if (!this.state) return;
    this.state = undefined;
    for (const listener of this.listeners) listener();
  }
}
