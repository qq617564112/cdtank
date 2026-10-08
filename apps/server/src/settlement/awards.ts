import type {ModeAwardsConfig, ModeMapConfig} from '../config';
import type {AwardType, ResultPlayer, RoundAward, RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';

/** The frozen, real round inputs used by the nine-award policy. */
export interface AwardParticipant {
  readonly playerId: string;
  readonly team: number;
  readonly outcome: ResultPlayer['outcome'];
  readonly playedSeconds: number;
  readonly roundStats: RoundStats;
  readonly kills: number;
  readonly deaths: number;
  readonly objectivesDestroyed: number;
  readonly combatScore: number;
  readonly outcomeBonus: number;
  readonly totalScore: number;
}

const AWARD_ORDER: readonly AwardType[] = ['perfect', 'mvp', 'savage', 'console',
  'brave', 'kind', 'crafty', 'shy', 'greedy'];

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function enabled(config: ModeAwardsConfig, type: keyof ModeAwardsConfig): boolean {
  return config[type].enable === 1;
}

function award(config: ModeAwardsConfig, type: keyof ModeAwardsConfig): RoundAward {
  return {type, score: config[type].score};
}

function threshold(config: ModeAwardsConfig, type: keyof ModeAwardsConfig, enemyCount: number): number {
  const {damage = 0, damagePlus = 0} = config[type];
  return damage + damagePlus * Math.max(0, enemyCount - 1);
}

function compareMvp(left: AwardParticipant, right: AwardParticipant): number {
  return right.totalScore - left.totalScore
    || right.kills - left.kills
    || right.objectivesDestroyed - left.objectivesDestroyed
    || compareIds(left.playerId, right.playerId);
}

function compareDamage(left: AwardParticipant, right: AwardParticipant): number {
  return right.roundStats.damage - left.roundStats.damage
    || right.kills - left.kills
    || compareIds(left.playerId, right.playerId);
}

function comparePerfect(left: AwardParticipant, right: AwardParticipant): number {
  return (right.kills + right.objectivesDestroyed) - (left.kills + left.objectivesDestroyed)
    || compareDamage(left, right);
}

function compareBrave(left: AwardParticipant, right: AwardParticipant): number {
  return right.roundStats.killCombo - left.roundStats.killCombo
    || right.kills - left.kills
    || left.deaths - right.deaths
    || compareIds(left.playerId, right.playerId);
}

function compareConsole(left: AwardParticipant, right: AwardParticipant): number {
  return right.roundStats.damageTaken - left.roundStats.damageTaken
    || right.deaths - left.deaths
    || compareIds(left.playerId, right.playerId);
}

function compareKind(left: AwardParticipant, right: AwardParticipant): number {
  return right.roundStats.healing - left.roundStats.healing
    || left.deaths - right.deaths
    || compareIds(left.playerId, right.playerId);
}

function compareCrafty(left: AwardParticipant, right: AwardParticipant): number {
  return right.roundStats.rearDamage - left.roundStats.rearDamage
    || compareDamage(left, right);
}

function compareGreedy(left: AwardParticipant, right: AwardParticipant): number {
  return right.kills - left.kills
    || left.deaths - right.deaths
    || right.objectivesDestroyed - left.objectivesDestroyed
    || compareIds(left.playerId, right.playerId);
}

function addAward(result: Map<string, RoundAward[]>, playerId: string, value: RoundAward): void {
  const awards = result.get(playerId);
  if (awards) awards.push(value);
  else result.set(playerId, [value]);
}

/**
 * Select distinct round performances using the project's competitive award policy.
 *
 * This function only reads the supplied map and participant data. It does not
 * mutate either input, and it does not depend on World state, a database, or
 * account identity. Returned scores are the source map scores; the caller adds
 * them to the frozen combat result once.
 */
export function computeRoundAwards(
  map: ModeMapConfig,
  participants: readonly AwardParticipant[],
): Map<string, RoundAward[]> {
  const result = new Map<string, RoundAward[]>();
  const active = participants.filter(player => player.playedSeconds > 0);
  const config = map.awards;

  const reachesThreshold = (player: AwardParticipant, type: keyof ModeAwardsConfig, value: number): boolean => {
    const enemyCount = map.mode <= 3
      ? active.filter(other => other.team !== player.team).length
      : active.filter(other => other.playerId !== player.playerId).length;
    return value >= threshold(config, type, enemyCount);
  };
  const grantBest = (type: keyof ModeAwardsConfig, candidates: readonly AwardParticipant[],
    compare: (left: AwardParticipant, right: AwardParticipant) => number): void => {
    if (!enabled(config, type)) return;
    const winner = [...candidates].sort(compare)[0];
    if (winner) addAward(result, winner.playerId, award(config, type));
  };

  grantBest('perfect', active.filter(player => player.deaths === 0
    && player.kills + player.objectivesDestroyed >= 3), comparePerfect);
  grantBest('brave', active.filter(player => player.deaths >= 1
    && player.roundStats.killCombo >= 3), compareBrave);
  grantBest('shy', active.filter(player => player.roundStats.shots === 0 && player.deaths >= 1
    && reachesThreshold(player, 'console', player.roundStats.damageTaken)), compareConsole);

  grantBest('savage', active.filter(player =>
    reachesThreshold(player, 'savage', player.roundStats.damage)), compareDamage);
  grantBest('console', active.filter(player => player.deaths >= 3 && player.deaths > player.kills
    && reachesThreshold(player, 'console', player.roundStats.damageTaken)), compareConsole);
  if (map.mode <= 3) {
    grantBest('kind', active.filter(player =>
      reachesThreshold(player, 'kind', player.roundStats.healing)), compareKind);
  }
  grantBest('crafty', active.filter(player => player.roundStats.rearDamage * 2 >= player.roundStats.damage
    && reachesThreshold(player, 'crafty', player.roundStats.rearDamage)), compareCrafty);

  grantBest('mvp', active.filter(player => player.outcome === 'WIN' && player.kills > 0), compareMvp);

  if (map.mode >= 4) {
    grantBest('greedy', active.filter(player => player.kills >= 3 && player.kills > player.deaths), compareGreedy);
  }

  for (const awards of result.values()) {
    awards.sort((left, right) => AWARD_ORDER.indexOf(left.type) - AWARD_ORDER.indexOf(right.type));
  }
  return result;
}

/** Explicit settlement-facing alias for callers that name the phase rather than the computation. */
export const settleAwards = computeRoundAwards;
