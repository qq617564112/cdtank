import {useEffect, useRef, useState} from 'react';
import type {AwardType, ResultAward, ResultPlayer} from '../../../../shared/protocols/MsgRoomSnapshot';
import {expPercentAtLevel, LEVEL_THRESHOLDS} from '../../../../shared/settlement/account-growth';

/** Original summary states1..7: panels, rows, outcome, score, awards, growth, currency. */
const PANEL_MS = 700;
const ROW_MS = 700;
const ROW_DELAY_MS = 300;
const OUTCOME_MS = 700;
const SCORE_MS = 3000;
const AWARD_MS = 2000;
const LEVEL_MS = 1000;
const REWARD_MS = 3200;

export type SummaryStage = 'panels' | 'rows' | 'outcome' | 'scores' | 'awards' | 'growth' | 'rewards' | 'notices' | 'done';
export interface SummarySequence {
  stage: SummaryStage;
  scoreElapsed: number;
  awardIndex: number;
  growthElapsed: number;
  outcomeVisible: boolean;
}
interface SummaryClock {
  round: number;
  startedAt: number;
  growthStartedAt?: number;
}

export function summaryGrowthDuration(award: ResultAward): number {
  return award.rankPointsBefore === undefined ? 0
    : (Math.abs(award.levelAfter - award.levelBefore) + 1) * LEVEL_MS;
}

/** One clock survives snapshot refreshes; a late committed receipt starts growth without replaying awards. */
export function useSummarySequence(round: number, ready: boolean, rowCount: number,
    awardCount: number, award?: ResultAward): SummarySequence {
  const rowsEnd = PANEL_MS + (rowCount ? ROW_MS + (rowCount - 1) * ROW_DELAY_MS : 0);
  const outcomeEnd = rowsEnd + OUTCOME_MS;
  const scoreEnd = outcomeEnd + SCORE_MS;
  const prelude = scoreEnd + awardCount * AWARD_MS;
  const hasAward = award !== undefined;
  const growthDuration = award ? summaryGrowthDuration(award) : 0;
  const clock = useRef<SummaryClock | undefined>(undefined);
  const [tick, setTick] = useState({round, elapsed: 0, growthElapsed: 0});
  useEffect(() => {
    if (!ready) return;
    const now = performance.now();
    const current: SummaryClock = clock.current?.round === round ? clock.current : {round, startedAt: now};
    clock.current = current;
    if (hasAward && current.growthStartedAt === undefined) {
      current.growthStartedAt = Math.max(current.startedAt + prelude, now);
    }
    let frame = 0;
    let lastTick = -Infinity;
    const update = (time: number) => {
      const elapsed = time - current.startedAt;
      const growthElapsed = current.growthStartedAt === undefined ? 0
        : Math.max(0, time - current.growthStartedAt);
      const done = elapsed >= prelude && (!hasAward || growthElapsed >= growthDuration + REWARD_MS);
      if (time - lastTick >= 50 || done) {
        setTick({round, elapsed, growthElapsed});
        lastTick = time;
      }
      if (!done) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [round, ready, prelude, hasAward, growthDuration]);
  const elapsed = tick.round === round ? tick.elapsed : 0;
  const growthElapsed = tick.round === round ? tick.growthElapsed : 0;
  const stage: SummaryStage = elapsed < PANEL_MS ? 'panels'
    : elapsed < rowsEnd ? 'rows'
    : elapsed < outcomeEnd ? 'outcome'
    : elapsed < scoreEnd ? 'scores'
    : elapsed < prelude ? 'awards'
    : !hasAward ? 'done'
    : growthElapsed < growthDuration ? 'growth'
    : growthElapsed < growthDuration + REWARD_MS ? 'rewards' : 'notices';
  return {stage, outcomeVisible: elapsed >= rowsEnd,
    scoreElapsed: Math.max(0, Math.min(SCORE_MS, elapsed - outcomeEnd)),
    awardIndex: elapsed < scoreEnd ? -1 : Math.min(awardCount, Math.floor((elapsed - scoreEnd) / AWARD_MS)),
    growthElapsed};
}

/** Original rolling score uses the largest positive/smallest negative row as the shared rate. */
export function summaryScore(player: ResultPlayer, players: readonly ResultPlayer[],
    elapsed: number, revealed: ReadonlySet<AwardType>): number {
  const base = (row: ResultPlayer) => row.combatScore - (row.awards ?? [])
    .reduce((score, award) => score + award.score, 0);
  const target = base(player);
  const limit = target >= 0 ? Math.max(0, ...players.map(base)) : Math.min(0, ...players.map(base));
  const rolling = Math.trunc(limit * Math.min(1, elapsed / SCORE_MS));
  const score = target >= 0 ? Math.min(target, rolling) : Math.max(target, rolling);
  return score + (player.awards ?? []).filter(award => revealed.has(award.type))
    .reduce((value, award) => value + award.score, 0);
}

/** Every crossed tier gets a one-second fill/drain segment, followed by the final partial tier. */
export function summaryGrowth(award: ResultAward, elapsed: number) {
  if (award.rankPointsBefore === undefined || elapsed >= summaryGrowthDuration(award)) {
    return {level: award.levelAfter, percent: award.expPercent,
      change: Math.sign(award.levelAfter - award.levelBefore), pulse: false};
  }
  const steps = Math.abs(award.levelAfter - award.levelBefore);
  const direction = Math.sign(award.levelAfter - award.levelBefore);
  const step = Math.min(steps, Math.floor(elapsed / LEVEL_MS));
  const level = award.levelBefore + direction * step;
  const start = step === 0 ? award.rankPointsBefore
    : LEVEL_THRESHOLDS[level - (direction > 0 ? 1 : 0)];
  const end = step === steps ? award.rankPoints
    : LEVEL_THRESHOLDS[level - (direction > 0 ? 0 : 1)];
  const progress = elapsed / LEVEL_MS - step;
  const points = start + (end - start) * progress;
  return {level, percent: Math.round(expPercentAtLevel(points, level)),
    change: step > 0 ? direction : 0, pulse: step > 0};
}
