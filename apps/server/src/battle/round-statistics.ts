import type {RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';

/** Real battle participants own these fields; pure damage fixtures may omit them. */
export interface RoundStatsCarrier {
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
  };
}

/** Reset one participant's counters on first start and consensus rematch. */
export function resetRoundStatistics(player: RoundStatsCarrier): void {
  player.roundStats = createRoundStats();
  player.roundCurrentKillCombo = 0;
  player.roundHitShotIds = new Set();
}

/** One accepted, actually fired ordinary ammunition shot. */
export function countShot(player: RoundStatsCarrier): void {
  if (player.roundStats) player.roundStats.shots += 1;
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

/** Real enemy kill while the attacker has not died this round. */
export function recordEnemyKill(attacker: RoundStatsCarrier): void {
  if (!attacker.roundStats) return;
  attacker.roundCurrentKillCombo = (attacker.roundCurrentKillCombo ?? 0) + 1;
  attacker.roundStats.killCombo = Math.max(attacker.roundStats.killCombo, attacker.roundCurrentKillCombo);
}

/** A real death resets the current combo; the frozen maximum stays. */
export function recordPlayerDeath(target: RoundStatsCarrier): void {
  target.roundCurrentKillCombo = 0;
}
