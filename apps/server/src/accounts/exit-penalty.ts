import type {DatabaseSync} from 'node:sqlite';
import type {LeavePenalty} from '../../../shared/protocols/PtlLeave';
import {levelFor} from '../../../shared/settlement/account-growth';

export interface ExitPenaltyReceipt {
  count: number;
  points: number;
  rankPointsBefore: number;
  rankPointsAfter: number;
  levelAfter: number;
}

/** Account-growth penalty with an exactly-once receipt per explicit departure. */
export class AccountExitPenalty {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS exit_penalty_ledger (
      account_id TEXT NOT NULL,
      room_key TEXT NOT NULL,
      round INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      receipt TEXT NOT NULL,
      PRIMARY KEY(account_id, room_key, round, player_id)
    );`);
  }

  quote(accountId: string, count: number): LeavePenalty {
    const normalized = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    const rankPoints = this.rankPoints(accountId);
    return {
      count: normalized,
      points: normalized > 7 ? Math.min(normalized * 100, rankPoints) : 0,
    };
  }

  apply(accountId: string, roomKey: string, round: number, playerId: string,
      count: number, expectedPoints: number): ExitPenaltyReceipt {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare(`SELECT receipt FROM exit_penalty_ledger
        WHERE account_id = ? AND room_key = ? AND round = ? AND player_id = ?`)
        .get(accountId, roomKey, round, playerId);
      if (previous) {
        const receipt = JSON.parse(String(previous.receipt)) as ExitPenaltyReceipt;
        this.database.exec('COMMIT');
        return receipt;
      }

      const current = this.quote(accountId, count);
      const confirmedPoints = Number.isFinite(expectedPoints)
        ? Math.max(0, Math.trunc(expectedPoints)) : -1;
      if (confirmedPoints !== current.points) throw new Error('退出处罚积分已变化，请重新确认');

      const rankPointsBefore = this.rankPoints(accountId);
      const rankPointsAfter = rankPointsBefore - current.points;
      this.database.prepare(`INSERT INTO account_growth
        (account_id, rank_points, level, originality, skill_points) VALUES (?, ?, ?, 0, 0)
        ON CONFLICT(account_id) DO UPDATE SET rank_points = excluded.rank_points, level = excluded.level`)
        .run(accountId, rankPointsAfter, levelFor(rankPointsAfter));

      const receipt: ExitPenaltyReceipt = {
        count: current.count,
        points: current.points,
        rankPointsBefore,
        rankPointsAfter,
        levelAfter: levelFor(rankPointsAfter),
      };
      this.database.prepare('INSERT INTO exit_penalty_ledger VALUES (?, ?, ?, ?, ?)')
        .run(accountId, roomKey, round, playerId, JSON.stringify(receipt));
      this.database.exec('COMMIT');
      return receipt;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private rankPoints(accountId: string): number {
    const row = this.database.prepare('SELECT rank_points FROM account_growth WHERE account_id = ?')
      .get(accountId) as {rank_points?: number} | undefined;
    return Math.max(0, Math.trunc(Number(row?.rank_points ?? 0)));
  }
}
