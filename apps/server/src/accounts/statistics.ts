import type {DatabaseSync} from 'node:sqlite';
import type {AccountStatistics, AwardCounts} from '../../../shared/protocols/PtlRoleProfile';
import type {AwardType, ResultPlayer, RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';
import type {AwardKind, TitleStats} from '../settlement/title';
import {readAccountSpending} from './spending';

const AWARD_KINDS: readonly AwardKind[] = ['perfect', 'mvp', 'savage', 'console', 'brave',
  'kind', 'crafty', 'shy', 'greedy'];

interface HistoryAggregate {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winStreak: number;
  readonly loseStreak: number;
  readonly kills: number;
  readonly deaths: number;
  readonly roundStats?: {
    readonly shots: number;
    readonly hits: number;
    readonly damage: number;
    readonly killCombo: number;
  };
  readonly awardCounts?: AwardCounts;
  readonly roundStatsComplete: boolean;
  readonly awardCountsComplete: boolean;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function readRoundStats(value: unknown): RoundStats | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const stats = value as Partial<RoundStats>;
  if (!finiteNonNegative(stats.shots) || !finiteNonNegative(stats.hits)
      || !finiteNonNegative(stats.damage) || !finiteNonNegative(stats.damageTaken)
      || !finiteNonNegative(stats.killCombo) || !finiteNonNegative(stats.friendlyFireDamage)
      || !finiteNonNegative(stats.healing) || !finiteNonNegative(stats.rearDamage)) return undefined;
  return stats as RoundStats;
}

function readAwards(value: unknown): AwardType[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<AwardType>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const type = (entry as {type?: unknown}).type;
    if (typeof type === 'string' && AWARD_KINDS.includes(type as AwardKind)) {
      seen.add(type as AwardType);
    }
  }
  return [...seen];
}

function aggregateHistory(database: DatabaseSync, accountId: string): HistoryAggregate {
  const rows = database.prepare(`SELECT record FROM match_history WHERE account_id = ?
    ORDER BY ended_at ASC, match_id ASC, round ASC`).all(accountId);
  let wins = 0, losses = 0, draws = 0, kills = 0, deaths = 0;
  let currentWins = 0, currentLosses = 0, winStreak = 0, loseStreak = 0;
  let statsRows = 0, awardRows = 0;
  let shots = 0, hits = 0, damage = 0, killCombo = 0;
  const counts: Record<AwardKind, number> = {
    perfect: 0, mvp: 0, savage: 0, console: 0, brave: 0,
    kind: 0, crafty: 0, shy: 0, greedy: 0,
  };

  for (const row of rows) {
    const {result} = JSON.parse(String(row.record)) as {result: ResultPlayer};
    if (result.outcome === 'WIN') {wins++; currentWins++; currentLosses = 0;}
    else if (result.outcome === 'LOSE') {losses++; currentLosses++; currentWins = 0;}
    else {draws++; currentWins = 0; currentLosses = 0;}
    winStreak = Math.max(winStreak, currentWins);
    loseStreak = Math.max(loseStreak, currentLosses);
    kills += result.kills;
    deaths += result.deaths;

    const roundStats = readRoundStats(result.roundStats);
    if (roundStats) {
      statsRows++;
      shots += roundStats.shots;
      hits += roundStats.hits;
      damage += roundStats.damage;
      killCombo = Math.max(killCombo, roundStats.killCombo);
    }
    const awards = readAwards(result.awards);
    if (awards) {
      awardRows++;
      for (const award of awards) counts[award]++;
    }
  }

  return {
    wins, losses, draws, winStreak, loseStreak, kills, deaths,
    roundStats: statsRows > 0 ? {shots, hits, damage, killCombo} : undefined,
    awardCounts: awardRows > 0 ? counts : undefined,
    roundStatsComplete: statsRows === rows.length,
    awardCountsComplete: awardRows === rows.length,
  };
}

function battleSeconds(database: DatabaseSync, accountId: string): number {
  return Number(database.prepare(
    'SELECT COALESCE(SUM(seconds), 0) AS total FROM account_title_playtime WHERE account_id = ?',
  ).get(accountId)!.total);
}

/** Lifetime settlement fields aggregate all history; typed round producers contribute only
 * records that actually carry them, so legacy rows remain unknown rather than zero. */
export function readAccountStatistics(database: DatabaseSync, accountId: string): AccountStatistics {
  const aggregate = aggregateHistory(database, accountId);
  const spending = readAccountSpending(database, accountId);
  return {
    wins: aggregate.wins,
    losses: aggregate.losses,
    draws: aggregate.draws,
    winStreak: aggregate.winStreak,
    loseStreak: aggregate.loseStreak,
    battleSeconds: battleSeconds(database, accountId),
    kills: aggregate.kills,
    deaths: aggregate.deaths,
    ...(aggregate.roundStats ? {
      shots: aggregate.roundStats.shots,
      hits: aggregate.roundStats.hits,
      damage: aggregate.roundStats.damage,
      killCombo: aggregate.roundStats.killCombo,
    } : {}),
    ...(spending.spentMoney !== undefined ? {spentMoney: spending.spentMoney} : {}),
    ...(spending.spentTokens !== undefined ? {spentTokens: spending.spentTokens} : {}),
  };
}

/** Complete nine-award counts over every history row carrying the real award producer. */
export function readAccountAwardCounts(database: DatabaseSync, accountId: string): AwardCounts | undefined {
  return aggregateHistory(database, accountId).awardCounts;
}

/** Unified title input: identical lifetime/round/spending window plus complete award counts. */
export function readTitleStats(database: DatabaseSync, accountId: string): TitleStats {
  const aggregate = aggregateHistory(database, accountId);
  const spending = readAccountSpending(database, accountId);
  return {
    wins: aggregate.wins,
    losses: aggregate.losses,
    draws: aggregate.draws,
    winStreak: aggregate.winStreak,
    loseStreak: aggregate.loseStreak,
    kills: aggregate.kills,
    deaths: aggregate.deaths,
    battleSeconds: battleSeconds(database, accountId),
    ...(aggregate.roundStats ? {
      shots: aggregate.roundStats.shots,
      hits: aggregate.roundStats.hits,
      damage: aggregate.roundStats.damage,
      killCombo: aggregate.roundStats.killCombo,
    } : {}),
    ...(spending.spentMoney !== undefined ? {spentMoney: spending.spentMoney} : {}),
    ...(spending.spentTokens !== undefined ? {spentTokens: spending.spentTokens} : {}),
    roundStatsComplete: aggregate.roundStatsComplete,
    awardCountsComplete: aggregate.awardCountsComplete,
    ...(aggregate.awardCounts ? {awardCounts: aggregate.awardCounts} : {}),
  };
}
