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
    if (snapshot.phase !== 'PLAYING') {
      this.clear();
      return;
    }
    let localPresent = false;
    for (const player of snapshot.players) {
      if (player.id === playerId) {localPresent = true; break;}
    }
    if (!localPresent) {this.clear(); return;}
    const previous = this.state;
    const round = snapshot.match?.round ?? 0;
    if (previous && previous.roomId === snapshot.roomId && previous.round === round
      && previous.mode === snapshot.mode && previous.playerId === playerId
      && previous.players.length === snapshot.players.length) {
      let unchanged = true;
      for (let index = 0; index < snapshot.players.length; index++) {
        if (!sameScoreboardPlayer(previous.players[index], snapshot.players[index])) {unchanged = false; break;}
      }
      if (unchanged) return;
    }
    const players: ScoreboardPlayer[] = [];
    for (let index = 0; index < snapshot.players.length; index++) {
      const player = snapshot.players[index];
      const cached = previous?.players[index];
      players.push(cached && sameScoreboardPlayer(cached, player) ? cached : {
        id: player.id, name: player.name, team: player.team, petId: player.petId,
        score: player.score, kills: player.kills, deaths: player.deaths,
        alive: player.alive, isVIP: player.isVIP, objectivesDestroyed: player.objectivesDestroyed ?? 0,
      });
    }
    this.state = {roomId: snapshot.roomId, round, mode: snapshot.mode, playerId, players};
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    if (!this.state) return;
    this.state = undefined;
    for (const listener of this.listeners) listener();
  }
}

function sameScoreboardPlayer(left: ScoreboardPlayer, right: PlayerSnapshot): boolean {
  return left.id === right.id && left.name === right.name && left.team === right.team
    && left.petId === right.petId && left.score === right.score && left.kills === right.kills
    && left.deaths === right.deaths && left.alive === right.alive && left.isVIP === right.isVIP
    && left.objectivesDestroyed === (right.objectivesDestroyed ?? 0);
}
