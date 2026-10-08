import type {DatabaseSync} from 'node:sqlite';
import type {AccountGrowth, ResultAward, ResultPlayer} from '../../../shared/protocols/MsgRoomSnapshot';
import {computeResultAward, readResultRewardRates, type ResultRewardRates} from '../settlement/reward';
import type {ResultRewardModifiers} from '../settlement/reward-modifiers';
import {grantEquipmentReward, type EquipmentRewardRoll} from './equipment-reward';

export type {EquipmentRewardRoll} from './equipment-reward';

/** Original MyPlayer money field; existing shop/sale helpers already write this balance. */
const MONEY_OFFSET = 0x70;
const MONEY_CAP = 999999999;

const DEFAULT_GROWTH: AccountGrowth = {rankPoints: 0, level: 1, originality: 0, tech: 0};

/** Explicit account-growth columns and the exactly-once reward ledger.
 * Both tables are created with ordinary CREATE TABLE IF NOT EXISTS; no migration framework.
 */
export class AccountReward {
  private rates?: ResultRewardRates;

  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS account_growth (
        account_id TEXT PRIMARY KEY,
        rank_points INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        originality INTEGER NOT NULL DEFAULT 0,
        skill_points INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS account_reward_ledger (
        account_id TEXT NOT NULL, match_id TEXT NOT NULL, round INTEGER NOT NULL,
        receipt TEXT NOT NULL, PRIMARY KEY(account_id, match_id, round)
      );
    `);
  }

  /** Current authoritative growth; new accounts start at the independent ledger's zero.
   * Original raw profile 0x5c/0x9c/0xa0/0x80 are never read or overwritten as earned growth.
   */
  growth(accountId: string): AccountGrowth {
    const row = this.database.prepare(`SELECT rank_points, level, originality, skill_points
      FROM account_growth WHERE account_id = ?`).get(accountId);
    if (!row) return {...DEFAULT_GROWTH};
    return {rankPoints: Number(row.rank_points), level: Number(row.level),
      originality: Number(row.originality), tech: Number(row.skill_points)};
  }

  /** Stored receipt for an already-committed (account, match, round); duplicate returns it unchanged. */
  receipt(accountId: string, matchId: string, round: number): ResultAward | undefined {
    const row = this.database.prepare(`SELECT receipt FROM account_reward_ledger
      WHERE account_id = ? AND match_id = ? AND round = ?`).get(accountId, matchId, round);
    return row ? JSON.parse(String(row.receipt)) as ResultAward : undefined;
  }

  /** Apply one round inside the caller's BEGIN IMMEDIATE. Reads prior growth, credits spendable
   * money to the existing profile, advances the typed growth columns and writes the receipt.
   */
  apply(accountId: string, matchId: string, round: number,
      result: Pick<ResultPlayer, 'combatScore' | 'totalScore' | 'outcome'>
        & {rewardModifiers?: ResultRewardModifiers; equipmentRewardRoll?: EquipmentRewardRoll}): ResultAward {
    const existing = this.receipt(accountId, matchId, round);
    if (existing) return existing;
    const previous = this.growth(accountId);
    const computed = computeResultAward({player: result, previous, rates: this.resultRewardRates()});
    const money = this.creditMoney(accountId, computed.money);
    const equipment = result.equipmentRewardRoll
      ? grantEquipmentReward(this.database, accountId, result.equipmentRewardRoll)
      : {items: [], tanks: []};
    const award: ResultAward = {...computed, money,
      ...(equipment.items.length ? {grantedItems: equipment.items} : {}),
      ...(equipment.tanks.length ? {grantedTanks: equipment.tanks} : {})};
    this.database.prepare(`INSERT INTO account_growth
      (account_id, rank_points, level, originality, skill_points) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET rank_points = excluded.rank_points, level = excluded.level,
        originality = excluded.originality, skill_points = excluded.skill_points`)
      .run(accountId, award.rankPoints, award.levelAfter,
        previous.originality + award.originality, previous.tech + award.tech);
    this.database.prepare('INSERT INTO account_reward_ledger VALUES (?, ?, ?, ?)')
      .run(accountId, matchId, round, JSON.stringify(award));
    return award;
  }

  /** Credit up to the balance cap and return the amount actually received. */
  private creditMoney(accountId: string, amount: number): number {
    if (amount <= 0) return 0;
    const row = this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
    if (!row) return 0;
    const bytes = new Uint8Array(row.payload as Uint8Array);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const money = view.getUint32(MONEY_OFFSET, true);
    const credited = Math.min(amount, Math.max(0, MONEY_CAP - money));
    if (credited === 0) return 0;
    view.setUint32(MONEY_OFFSET, money + credited, true);
    this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
    return credited;
  }

  private resultRewardRates(): ResultRewardRates {
    this.rates ??= readResultRewardRates();
    return this.rates;
  }
}
