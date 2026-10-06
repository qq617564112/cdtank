import type {ModeAwardsConfig, ModeMapConfig} from '../config';
import type {AwardType, RoundAward, RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';

/** The frozen, real round inputs used by the nine-award policy. */
export interface AwardParticipant {
  readonly playerId: string;
  readonly team: number;
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

function positivePerformance(player: AwardParticipant): boolean {
  return player.kills > 0 || player.objectivesDestroyed > 0 || player.roundStats.damage > 0;
}

function compareMvp(left: AwardParticipant, right: AwardParticipant): number {
  return right.totalScore - left.totalScore
    || right.kills - left.kills
    || right.objectivesDestroyed - left.objectivesDestroyed
    || compareIds(left.playerId, right.playerId);
}

function compareGreedy(left: AwardParticipant, right: AwardParticipant): number {
  return right.roundStats.damage - left.roundStats.damage
    || right.kills - left.kills
    || compareIds(left.playerId, right.playerId);
}

function addAward(result: Map<string, RoundAward[]>, playerId: string, value: RoundAward): void {
  const awards = result.get(playerId);
  if (awards) awards.push(value);
  else result.set(playerId, [value]);
}

/**
 * Apply the nine published award rules to frozen round inputs.
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

  for (const player of active) {
    if (enabled(config, 'perfect') && player.deaths === 0
        && player.kills + player.objectivesDestroyed >= 1) {
      addAward(result, player.playerId, award(config, 'perfect'));
    }
    if (enabled(config, 'brave') && player.deaths >= 1 && player.kills >= 1) {
      addAward(result, player.playerId, award(config, 'brave'));
    }
    if (enabled(config, 'shy') && player.roundStats.shots === 0
        && player.roundStats.damageTaken > 0) {
      addAward(result, player.playerId, award(config, 'shy'));
    }
  }

  for (const player of active) {
    const enemyCount = map.mode <= 3
      ? active.filter(other => other.team !== player.team).length
      : active.filter(other => other.playerId !== player.playerId).length;
    if (enabled(config, 'savage')
        && player.roundStats.damage >= threshold(config, 'savage', enemyCount)) {
      addAward(result, player.playerId, award(config, 'savage'));
    }
    if (enabled(config, 'console') && player.deaths >= 1
        && player.roundStats.damageTaken >= threshold(config, 'console', enemyCount)) {
      addAward(result, player.playerId, award(config, 'console'));
    }
    if (enabled(config, 'kind')
        && player.roundStats.healing >= threshold(config, 'kind', enemyCount)) {
      addAward(result, player.playerId, award(config, 'kind'));
    }
    if (enabled(config, 'crafty')
        && player.roundStats.rearDamage >= threshold(config, 'crafty', enemyCount)) {
      addAward(result, player.playerId, award(config, 'crafty'));
    }
  }

  if (enabled(config, 'mvp')) {
    const groups = map.mode <= 3
      ? [...new Set(active.map(player => player.team))].map(team => ({
        team, players: active.filter(player => player.team === team),
      }))
      : [{team: -1, players: active}];
    for (const group of groups) {
      const winner = group.players
        .filter(positivePerformance)
        .sort(compareMvp)[0];
      if (winner) addAward(result, winner.playerId, award(config, 'mvp'));
    }
  }

  if (enabled(config, 'greedy') && map.mode >= 4) {
    const winner = active
      .filter(player => player.roundStats.damage > 0)
      .sort(compareGreedy)[0];
    if (winner) addAward(result, winner.playerId, award(config, 'greedy'));
  }

  for (const awards of result.values()) {
    awards.sort((left, right) => AWARD_ORDER.indexOf(left.type) - AWARD_ORDER.indexOf(right.type));
  }
  return result;
}

/** Explicit settlement-facing alias for callers that name the phase rather than the computation. */
export const settleAwards = computeRoundAwards;
