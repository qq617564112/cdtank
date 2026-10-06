import type {MatchResult, ResultPlayer, RoundStats} from '../../../shared/protocols';

interface SettlementPlayer {
  readonly id: string;
  readonly name: string;
  readonly team: number;
  readonly score: number;
  readonly kills: number;
  readonly deaths: number;
  readonly objectivesDestroyed: number;
  /** Real per-round producers; absent on legacy fixtures without a battle path. */
  readonly roundStats?: RoundStats;
  /** Real frozen PLAYING seconds; used by awards, not part of the public result. */
  readonly playedSeconds?: number;
}

export interface MatchResultInput {
  readonly players: readonly SettlementPlayer[];
  /** Participants removed mid-round; merged into the frozen list without affecting the winner. */
  readonly departedPlayers?: readonly SettlementPlayer[];
  readonly mode: number;
  readonly bonuses: {readonly drawScore: number; readonly winScore: number; readonly loseScore: number};
  readonly teamLives: readonly number[];
  readonly teamScores: readonly number[];
  readonly round: number;
  readonly endedAt: number;
  readonly reason: MatchResult['reason'];
  readonly winnerTeam?: number;
  readonly winnerPlayerId?: string;
}

/** Existing rebuilt outcomes and source-table bonuses; original server policy remains unresolved.
 * The caller owns the once-only phase gate and commits this result with the frozen round.
 */
export function computeMatchResult(input: MatchResultInput): MatchResult {
  const metric = (player: SettlementPlayer): number => input.mode === 5
    ? player.objectivesDestroyed : player.kills;
  const compare = (a: SettlementPlayer, b: SettlementPlayer): number =>
    metric(b) - metric(a) || b.score - a.score;
  const active = [...input.players].sort(compare);
  let {winnerTeam, winnerPlayerId} = input;
  if (winnerTeam === undefined) {
    if (input.mode === 1) {
      winnerTeam = compareTeams(input.teamLives);
    } else if (input.mode === 2) {
      winnerTeam = compareTeams(input.teamScores);
    } else {
      winnerTeam = -1;
    }
  }
  if (winnerPlayerId === undefined && input.mode >= 4) {
    const [first, second] = active;
    winnerPlayerId = first && (!second || metric(first) > metric(second)
      || (metric(first) === metric(second) && first.score > second.score)) ? first.id : '';
  }
  winnerPlayerId ??= '';
  // Departed participants join the frozen list for ranking and outcome, never the winner decision.
  const sorted = [...input.players, ...input.departedPlayers ?? []].sort(compare);
  const players: ResultPlayer[] = sorted.map((player, index) => {
    const draw = winnerTeam < 0 && !winnerPlayerId;
    const won = input.mode <= 3 ? player.team === winnerTeam : player.id === winnerPlayerId;
    const outcome = draw ? 'DRAW' : won ? 'WIN' : 'LOSE';
    const bonus = draw ? input.bonuses.drawScore : won ? input.bonuses.winScore : input.bonuses.loseScore;
    const previous = sorted[index - 1];
    const rank = previous && metric(previous) === metric(player) && previous.score === player.score
      ? sorted.findIndex(value => metric(value) === metric(player) && value.score === player.score) + 1
      : index + 1;
    return {id: player.id, name: player.name, team: player.team, rank,
      kills: player.kills, deaths: player.deaths, objectivesDestroyed: player.objectivesDestroyed,
      combatScore: Math.round(player.score), outcomeBonus: bonus,
      totalScore: Math.round(player.score) + bonus, outcome,
      roundStats: player.roundStats ? {...player.roundStats} : undefined};
  });
  return {round: input.round, endedAt: input.endedAt, reason: input.reason,
    winnerTeam, winnerPlayerId, players};
}

export function matchFinishMessage(result: Pick<MatchResult, 'winnerPlayerId' | 'players'> | undefined,
                                   winnerTeam: number): string {
  if (result?.winnerPlayerId) {
    return `${result.players.find(player => player.id === result.winnerPlayerId)?.name}获胜`;
  }
  return winnerTeam < 0 ? '本局平局' : `${winnerTeam === 0 ? '猫队' : '狗队'}获胜`;
}

function compareTeams(values: readonly number[]): number {
  return Math.abs(values[0] - values[1]) < 0.000001 ? -1 : values[0] > values[1] ? 0 : 1;
}
