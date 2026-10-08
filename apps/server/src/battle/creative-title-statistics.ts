import type {RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';

interface TitleShot {
  readonly id: string;
  hit: boolean;
  killed: boolean;
}

/** Shot order and actual death attribution for the current round's title conditions. */
export interface CreativeTitleRound {
  shots: TitleShot[];
  killsByOpponent: Map<string, number>;
  openingDeaths: number;
  lethalShotId?: string;
}

export interface CreativeTitleCarrier {
  roundStats?: RoundStats;
  creativeTitleRound?: CreativeTitleRound;
}

export function resetCreativeTitleStatistics(player: CreativeTitleCarrier): void {
  player.creativeTitleRound = {shots: [], killsByOpponent: new Map(), openingDeaths: 0};
}

export function recordTitleShot(player: CreativeTitleCarrier, shotId: string | undefined): void {
  if (shotId !== undefined) {
    player.creativeTitleRound?.shots.push({id: shotId, hit: false, killed: false});
  }
}

export function recordTitleHit(player: CreativeTitleCarrier, shotId: string | undefined): void {
  const shot = player.creativeTitleRound?.shots.find(value => value.id === shotId);
  if (shot) shot.hit = true;
}

export function recordTitleKill(player: CreativeTitleCarrier, opponentId: string | undefined,
  shotId: string | undefined): void {
  const state = player.creativeTitleRound;
  if (!state || opponentId === undefined) return;
  state.killsByOpponent.set(opponentId, (state.killsByOpponent.get(opponentId) ?? 0) + 1);
  const shot = state.shots.find(value => value.id === shotId);
  if (shot) shot.killed = true;
}

export function recordTitleDeath(player: CreativeTitleCarrier): void {
  const state = player.creativeTitleRound;
  if (state && state.killsByOpponent.size === 0) state.openingDeaths++;
}

/** Freeze detached primitive values and opponent IDs before departure or settlement. */
export function freezeTitleRoundStatistics(player: CreativeTitleCarrier): RoundStats | undefined {
  if (!player.roundStats) return undefined;
  const stats = {...player.roundStats};
  const state = player.creativeTitleRound;
  if (!state) return stats;
  let misses = 0, consecutiveKills = 0;
  let maxMissesBeforeShotKill = 0, maxConsecutiveShotKills = 0;
  for (const shot of state.shots) {
    if (shot.killed) maxMissesBeforeShotKill = Math.max(maxMissesBeforeShotKill, misses);
    consecutiveKills = shot.killed ? consecutiveKills + 1 : 0;
    maxConsecutiveShotKills = Math.max(maxConsecutiveShotKills, consecutiveKills);
    misses = shot.hit ? 0 : misses + 1;
  }
  return {...stats,
    shotHits: state.shots.map(shot => shot.hit ? '1' : '0').join(''),
    missesThenKill: maxMissesBeforeShotKill >= 5,
    consecutiveShotKills: maxConsecutiveShotKills >= 2,
    maxMissesBeforeShotKill,
    maxConsecutiveShotKills,
    openingDeaths: state.openingDeaths,
    maxKillsAgainstOpponent: Math.max(0, ...state.killsByOpponent.values()),
    killedOpponentIds: [...state.killsByOpponent.keys()],
  };
}
