import {TITLE_TABLE} from '../config';

export type TitleTableRow = Readonly<Record<string, string>>;

export type AwardKind =
  | 'perfect'
  | 'mvp'
  | 'savage'
  | 'console'
  | 'brave'
  | 'kind'
  | 'crafty'
  | 'shy'
  | 'greedy';

/** Cumulative account statistics used by the original title predicates. */
export interface TitleStats {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  /** Greatest historical consecutive win/loss run. */
  readonly winStreak: number;
  readonly loseStreak: number;
  readonly kills: number;
  readonly deaths: number;
  readonly battleSeconds: number;
  /** Producer-backed fields stay absent until the account has a real recorded value. */
  readonly hits?: number;
  readonly shots?: number;
  readonly damage?: number;
  readonly killCombo?: number;
  readonly spentMoney?: number;
  readonly spentTokens?: number;
  readonly awardCounts?: Readonly<Record<AwardKind, number>>;
  /** False when legacy history rows lack awards; less-than predicates then stay unavailable. */
  readonly awardCountsComplete?: boolean;
  /** False when legacy history rows lack shots; shot/hit ratio predicates stay unavailable. */
  readonly roundStatsComplete?: boolean;
}

export type TitleCondition =
  | {readonly kind: 'threshold'; readonly selector: number; readonly threshold: number}
  | {readonly kind: 'ratio'; readonly selector: number; readonly denominator: number;
      readonly threshold: number; readonly percent: number; readonly constant: number}
  | {readonly kind: 'sumBelowAndGreater'; readonly left: number; readonly right: number;
      readonly threshold: number; readonly greater: number; readonly greaterThreshold: number}
  | {readonly kind: 'greaterAndLess'; readonly greater: number; readonly greaterThreshold: number;
      readonly less: number; readonly lessThreshold: number}
  | {readonly kind: 'bothGreater'; readonly left: number; readonly leftThreshold: number;
      readonly right: number; readonly rightThreshold: number}
  | {readonly kind: 'maxAward'; readonly threshold: number}
  | {readonly kind: 'allAwards'; readonly threshold: number}
  | {readonly kind: 'ownedTitles'; readonly threshold: number}
  | {readonly kind: 'sourceUnavailable'; readonly sourceType: number; readonly reason: string};

export interface TitleDefinition {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly condition: TitleCondition;
  /** Whether every referenced statistic has a currently wired producer. */
  readonly conditionAvailable: boolean;
}

const AWARD_KINDS: readonly AwardKind[] = ['perfect', 'mvp', 'savage', 'console', 'brave',
  'kind', 'crafty', 'shy', 'greedy'];

const AWARD_SELECTORS: Readonly<Record<number, AwardKind>> = {
  15: 'perfect', 16: 'mvp', 17: 'savage', 18: 'console', 19: 'brave',
  20: 'kind', 21: 'crafty', 22: 'shy', 23: 'greedy',
};

const CURRENT_STAT_SELECTORS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
]);

function knownNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function conditionFor(row: TitleTableRow, id: number): TitleCondition {
  const type = Number(row.FunctionType);
  const x = Number(row.FunctionX);
  const y = Number(row.FunctionY);
  const z = Number(row.FunctionZ);
  const a = Number(row.a);
  const b = Number(row.b);
  const c = Number(row.c);
  switch (type) {
    case 1:
      return {kind: 'threshold', selector: id >= 152 && id <= 154 && x === 13 ? 14 : x, threshold: a};
    case 2:
      return {kind: 'ratio', selector: x, denominator: z, threshold: a, percent: b, constant: c};
    case 5:
      return {kind: 'sumBelowAndGreater', left: x, right: y, threshold: a,
        greater: z, greaterThreshold: b};
    case 6:
      return {kind: 'greaterAndLess', greater: x, greaterThreshold: a,
        less: y, lessThreshold: b};
    case 7:
      return {kind: 'bothGreater', left: x, leftThreshold: a, right: y, rightThreshold: b};
    case 8:
      return {kind: 'maxAward', threshold: a};
    case 9:
      return {kind: 'allAwards', threshold: a};
    case 10:
      return {kind: 'ownedTitles', threshold: a};
    default:
      return {kind: 'sourceUnavailable', sourceType: type, reason: `FunctionType ${type}`};
  }
}

function selectorAvailable(selector: number): boolean {
  return CURRENT_STAT_SELECTORS.has(selector);
}

function selectorComplete(selector: number, stats: TitleStats): boolean {
  if (selector === 9 || selector === 10) return stats.roundStatsComplete !== false;
  return AWARD_SELECTORS[selector] === undefined || stats.awardCountsComplete !== false;
}

function conditionAvailable(condition: TitleCondition): boolean {
  switch (condition.kind) {
    case 'threshold':
      return selectorAvailable(condition.selector);
    case 'ratio':
      return selectorAvailable(condition.selector) && selectorAvailable(condition.denominator);
    case 'sumBelowAndGreater':
      return selectorAvailable(condition.left) && selectorAvailable(condition.right)
        && selectorAvailable(condition.greater);
    case 'greaterAndLess':
      return selectorAvailable(condition.greater) && selectorAvailable(condition.less);
    case 'bothGreater':
      return selectorAvailable(condition.left) && selectorAvailable(condition.right);
    case 'ownedTitles':
      return true;
    case 'maxAward':
    case 'allAwards':
      return true;
    case 'sourceUnavailable':
      return false;
  }
}

function maxAward(stats: TitleStats): number | undefined {
  const counts = AWARD_KINDS.map(kind => stats.awardCounts?.[kind]);
  if (counts.some(count => !knownNumber(count))) return undefined;
  return Math.max(...counts.filter((count): count is number => knownNumber(count)));
}

function minAward(stats: TitleStats): number | undefined {
  const counts = AWARD_KINDS.map(kind => stats.awardCounts?.[kind]);
  if (counts.some(count => !knownNumber(count))) return undefined;
  return Math.min(...counts.filter((count): count is number => knownNumber(count)));
}

function readTitleDefinition(row: TitleTableRow): TitleDefinition {
  const id = Number(row['称号ID']);
  const condition = conditionFor(row, id);
  return {
    id,
    name: row['称号名称'],
    description: row['说明'],
    condition,
    conditionAvailable: conditionAvailable(condition),
  };
}

/** Parse the complete published title catalog without truncating conditions that lack producers. */
export function readTitleDefinitions(rows: readonly TitleTableRow[] = TITLE_TABLE): readonly TitleDefinition[] {
  return rows.map(readTitleDefinition);
}

/** Complete original 158-row catalog, parsed from the normal readTable('title') chain. */
export const TITLE_DEFINITIONS: readonly TitleDefinition[] = readTitleDefinitions(TITLE_TABLE);

function statValue(selector: number, stats: TitleStats): number | undefined {
  switch (selector) {
    case 1: return stats.wins;
    case 2: return stats.losses;
    case 3: return stats.draws;
    case 4: return stats.winStreak;
    case 5: return stats.loseStreak;
    case 6: return stats.battleSeconds;
    case 7: return stats.kills;
    case 8: return stats.deaths;
    case 9: return stats.shots;
    case 10: return stats.hits;
    case 11: return stats.killCombo;
    case 12: return stats.damage;
    case 13: return stats.spentMoney;
    case 14: return stats.spentTokens;
    default: {
      const award = AWARD_SELECTORS[selector];
      return award === undefined ? undefined : stats.awardCounts?.[award];
    }
  }
}

function conditionMatches(condition: TitleCondition, stats: TitleStats, ownedTitleCount: number): boolean {
  switch (condition.kind) {
    case 'threshold': {
      const value = statValue(condition.selector, stats);
      return knownNumber(value) && value > condition.threshold;
    }
    case 'ratio': {
      const value = statValue(condition.selector, stats);
      const denominator = statValue(condition.denominator, stats);
      return knownNumber(value) && knownNumber(denominator)
        && selectorComplete(condition.selector, stats) && selectorComplete(condition.denominator, stats)
        && value > condition.threshold && value * 100 > denominator * condition.percent;
    }
    case 'sumBelowAndGreater': {
      const left = statValue(condition.left, stats);
      const right = statValue(condition.right, stats);
      const greater = statValue(condition.greater, stats);
      return knownNumber(left) && knownNumber(right) && knownNumber(greater)
        && selectorComplete(condition.left, stats) && selectorComplete(condition.right, stats)
        && left + right < condition.threshold && greater > condition.greaterThreshold;
    }
    case 'greaterAndLess': {
      const greater = statValue(condition.greater, stats);
      const less = statValue(condition.less, stats);
      return knownNumber(greater) && knownNumber(less) && selectorComplete(condition.less, stats)
        && greater > condition.greaterThreshold && less < condition.lessThreshold;
    }
    case 'bothGreater': {
      const left = statValue(condition.left, stats);
      const right = statValue(condition.right, stats);
      return knownNumber(left) && knownNumber(right)
        && left > condition.leftThreshold && right > condition.rightThreshold;
    }
    case 'maxAward': {
      const maximum = maxAward(stats);
      return knownNumber(maximum) && maximum >= condition.threshold;
    }
    case 'allAwards': {
      const minimum = minAward(stats);
      return knownNumber(minimum) && minimum >= condition.threshold;
    }
    case 'ownedTitles':
      return ownedTitleCount > condition.threshold;
    case 'sourceUnavailable':
      return false;
  }
}

/**
 * Evaluate only conditions whose actual statistics are present.
 * Known-owned titles stay owned; title 158 sees the real owned set plus grants from this evaluation.
 */
export function evaluateTitleGrants(stats: TitleStats, ownedIds: Iterable<number>): number[] {
  const owned = new Set(ownedIds);
  const granted = new Set<number>();
  const grants: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const ownedTitleCount = owned.size + granted.size;
    for (const title of TITLE_DEFINITIONS) {
      if (owned.has(title.id) || granted.has(title.id)
          || !conditionMatches(title.condition, stats, ownedTitleCount)) continue;
      granted.add(title.id);
      grants.push(title.id);
      changed = true;
    }
  }
  return grants;
}
