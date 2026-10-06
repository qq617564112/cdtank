import {readFileSync} from 'node:fs';
import {sourceTablePath} from '../runtime/content-paths';
import type {AccountGrowth, ResultAward, ResultPlayer} from '../../../shared/protocols/MsgRoomSnapshot';

/** Original level.dat 积分要求 for 阶级ID 1..20; ranked/rank-98/99 tiers stay unearned. */
const LEVEL_THRESHOLDS = [0, 300, 1200, 3000, 6000, 10500, 16800, 25200, 36000, 49500,
  66000, 85800, 109200, 136500, 168000, 204000, 244800, 290700, 342000, 399000] as const;

export const MAX_EARNED_LEVEL = LEVEL_THRESHOLDS.length;

/** Per-outcome DataScale percentages; money/coin/tech/originality read datascale.dat 31..42. */
export interface ResultRewardRate {money: number; coin: number; tech: number; originality: number;}
export type ResultRewardRates = Record<ResultPlayer['outcome'], ResultRewardRate>;

interface SourceTable {rows: {values: Record<string, string>}[];}

/** Original439184 reads these DataScale rows; values are already decoded in the verified table. */
const OUTCOME_SCALE_IDS: Record<ResultPlayer['outcome'], ResultRewardRate> = {
  WIN: {money: 31, coin: 32, tech: 33, originality: 34},
  DRAW: {money: 35, coin: 36, tech: 37, originality: 38},
  LOSE: {money: 39, coin: 40, tech: 41, originality: 42},
};

export function readResultRewardRates(path = sourceTablePath('datascale')): ResultRewardRates {
  const table = JSON.parse(readFileSync(path, 'utf8')) as SourceTable;
  const byId = new Map(table.rows.map(row => [Number(row.values.ID), Number(row.values.Min)]));
  const read = (id: number): number => {
    const value = byId.get(id);
    if (value === undefined || !Number.isFinite(value)) throw new Error(`缺少原始 DataScale ${id}`);
    return value;
  };
  return Object.fromEntries((Object.keys(OUTCOME_SCALE_IDS) as ResultPlayer['outcome'][]).map(outcome => {
    const ids = OUTCOME_SCALE_IDS[outcome];
    return [outcome, {money: read(ids.money), coin: read(ids.coin),
      tech: read(ids.tech), originality: read(ids.originality)}];
  })) as ResultRewardRates;
}

/** Largest 阶级ID 1..20 whose original 积分要求 is met; `>=` is the adopted boundary. */
export function levelFor(rankPoints: number): number {
  let level = 1;
  for (let index = 1; index < LEVEL_THRESHOLDS.length; index++) {
    if (rankPoints >= LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}

/** Progress toward the next original threshold; the top earned tier reports 100. */
export function expPercentFor(rankPoints: number): number {
  const level = levelFor(rankPoints);
  if (level >= MAX_EARNED_LEVEL) return 100;
  const floor = LEVEL_THRESHOLDS[level - 1];
  const ceiling = LEVEL_THRESHOLDS[level];
  return Math.max(0, Math.min(100, Math.round((rankPoints - floor) / (ceiling - floor) * 100)));
}

function rewardValue(base: number, ratePercent: number): number {
  return Math.max(0, Math.round(base * (1 + ratePercent / 100)));
}

export interface RewardInput {
  player: Pick<ResultPlayer, 'combatScore' | 'totalScore' | 'outcome'>;
  previous: Pick<AccountGrowth, 'rankPoints'>;
  rates: ResultRewardRates;
}

/** Rebuild this round's award from the frozen result and the account ledger's prior growth.
 * `base` is the non-negative rounded map combatScore; no unsourced upper clamp is applied.
 * coin stays 0 because no base authorization exists for the premium currency.
 */
export function computeResultAward({player, previous, rates}: RewardInput): ResultAward {
  const rate = rates[player.outcome];
  const base = Math.max(0, Math.round(player.combatScore));
  const money = rewardValue(base, rate.money);
  const coin = rewardValue(0, rate.coin);
  const originality = rewardValue(base / 5, rate.originality);
  const tech = rewardValue(base / 10, rate.tech);
  const rankPoints = Math.max(0, previous.rankPoints + player.totalScore);
  return {money, coin, originality, tech, rankPoints,
    levelBefore: levelFor(previous.rankPoints), levelAfter: levelFor(rankPoints),
    expPercent: expPercentFor(rankPoints)};
}
