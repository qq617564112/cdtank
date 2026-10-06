import type {DatabaseSync} from 'node:sqlite';
import type {MatchHistoryRecord, ResHistory} from '../../../shared/protocols/PtlHistory';
import type {ResultPlayer} from '../../../shared/protocols/MsgRoomSnapshot';

export type HistoryMatch = Omit<MatchHistoryRecord, 'result'>;
export interface HistoryParticipant {accountId: string; result: ResultPlayer;}

/** Rebuilt persistence stores existing settlement scores without assigning rewards. */
export class AccountHistory {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS settled_matches (
        match_id TEXT NOT NULL, round INTEGER NOT NULL, PRIMARY KEY(match_id, round));
      CREATE TABLE IF NOT EXISTS match_history (
        account_id TEXT NOT NULL, match_id TEXT NOT NULL, round INTEGER NOT NULL,
        ended_at INTEGER NOT NULL, record TEXT NOT NULL,
        PRIMARY KEY(account_id, match_id, round));
    `);
  }

  record(match: HistoryMatch, participants: readonly HistoryParticipant[]): boolean {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.database.prepare(
        'SELECT round FROM settled_matches WHERE match_id = ? AND round = ?',
      ).get(match.matchId, match.round);
      if (existing) {
        this.database.exec('COMMIT');
        return false;
      }
      this.database.prepare('INSERT INTO settled_matches VALUES (?, ?)').run(match.matchId, match.round);
      const account = this.database.prepare('SELECT id FROM accounts WHERE id = ?');
      const insert = this.database.prepare('INSERT INTO match_history VALUES (?, ?, ?, ?, ?)');
      for (const participant of participants) {
        if (!account.get(participant.accountId)) throw new Error('对局账户不存在');
        const record: MatchHistoryRecord = {...match, result: participant.result};
        insert.run(participant.accountId, match.matchId, match.round, match.endedAt, JSON.stringify(record));
      }
      this.database.exec('COMMIT');
      return true;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  query(accountId: string, offset = 0, limit = 20): ResHistory {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error('战绩分页应为非负起点和1至50条');
    }
    const total = Number(this.database.prepare(
      'SELECT COUNT(*) AS total FROM match_history WHERE account_id = ?',
    ).get(accountId)!.total);
    const records = this.database.prepare(`
      SELECT record FROM match_history WHERE account_id = ?
      ORDER BY ended_at DESC, match_id DESC, round DESC LIMIT ? OFFSET ?
    `).all(accountId, limit, offset).map(row => JSON.parse(String(row.record)) as MatchHistoryRecord);
    return {records, total, offset, limit};
  }
}
