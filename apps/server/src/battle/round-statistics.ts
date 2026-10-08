import type {RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';
import {recordTitleDeath, recordTitleHit, recordTitleKill, recordTitleShot,
  resetCreativeTitleStatistics, type CreativeTitleCarrier} from './creative-title-statistics';

/** Real battle participants own these fields; pure damage fixtures may omit them. */
export interface RoundStatsCarrier extends CreativeTitleCarrier {
  roundStats?: RoundStats;
  roundCurrentKillCombo?: number;
  roundHitShotIds?: Set<string>;
}

/** Fresh zeroed per-round counters; every new round starts from this object. */
export function createRoundStats(): RoundStats {
  return {
    shots: 0,
    hits: 0,
    damage: 0,
    damageTaken: 0,
    killCombo: 0,
    friendlyFireDamage: 0,
    healing: 0,
    rearDamage: 0,
    vipDamage: 0,
    bunkerDamage: 0,
  };
}

/** Reset one participant's counters on first start and consensus rematch. */
export function resetRoundStatistics(player: RoundStatsCarrier): void {
  player.roundStats = createRoundStats();
  player.roundCurrentKillCombo = 0;
  player.roundHitShotIds = new Set();
  resetCreativeTitleStatistics(player);
}

/** One accepted, actually fired ordinary ammunition shot. */
export function countShot(player: RoundStatsCarrier, shotId?: string): void {
  if (player.roundStats) player.roundStats.shots += 1;
  recordTitleShot(player, shotId);
}

/** At most one hit per unique shot identity, only for a real enemy HP reduction. */
export function countHit(player: RoundStatsCarrier, shotId: string | undefined): void {
  if (!player.roundStats) return;
  if (shotId !== undefined) {
    const counted = player.roundHitShotIds ?? (player.roundHitShotIds = new Set());
    if (counted.has(shotId)) return;
    counted.add(shotId);
  }
  player.roundStats.hits += 1;
  recordTitleHit(player, shotId);
}

export function recordEnemyDamage(attacker: RoundStatsCarrier, amount: number): void {
  if (attacker.roundStats && amount > 0) attacker.roundStats.damage += amount;
}

export function recordDamageTaken(target: RoundStatsCarrier, amount: number): void {
  if (target.roundStats && amount > 0) target.roundStats.damageTaken += amount;
}

export function recordFriendlyFireDamage(attacker: RoundStatsCarrier, amount: number): void {
  if (attacker.roundStats && amount > 0) attacker.roundStats.friendlyFireDamage += amount;
}

/** Only a real restoration of a non-self ally's HP reaches the healing counter. */
export function recordHealing(owner: RoundStatsCarrier, amount: number): void {
  if (owner.roundStats && amount > 0) owner.roundStats.healing += amount;
}

export function recordRearDamage(attacker: RoundStatsCarrier, amount: number): void {
  if (attacker.roundStats && amount > 0) attacker.roundStats.rearDamage += amount;
}

export function recordVipDamage(attacker: RoundStatsCarrier, amount: number): void {
  if (attacker.roundStats && amount > 0) {
    attacker.roundStats.vipDamage = (attacker.roundStats.vipDamage ?? 0) + amount;
  }
}

export function recordBunkerDamage(attacker: RoundStatsCarrier, amount: number): void {
  if (attacker.roundStats && amount > 0) {
    attacker.roundStats.bunkerDamage = (attacker.roundStats.bunkerDamage ?? 0) + amount;
  }
}

/** Real enemy kill while the attacker has not died this round. */
export function recordEnemyKill(attacker: RoundStatsCarrier, opponentId?: string, shotId?: string): void {
  if (!attacker.roundStats) return;
  attacker.roundCurrentKillCombo = (attacker.roundCurrentKillCombo ?? 0) + 1;
  attacker.roundStats.killCombo = Math.max(attacker.roundStats.killCombo, attacker.roundCurrentKillCombo);
  recordTitleKill(attacker, opponentId, shotId);
}

/** A real death resets the current combo; the frozen maximum stays. */
export function recordPlayerDeath(target: RoundStatsCarrier): void {
  target.roundCurrentKillCombo = 0;
  recordTitleDeath(target);
}
