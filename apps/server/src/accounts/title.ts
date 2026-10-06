import type {DatabaseSync} from 'node:sqlite';
import type {AccountTitles} from '../../../shared/protocols/PtlRoleProfile';
import type {PlayerTitle, ResultPlayer} from '../../../shared/protocols/MsgRoomSnapshot';
import {TITLE_DEFINITIONS, evaluateTitleGrants, type TitleStats} from '../settlement/title';

const TITLE_BY_ID = new Map(TITLE_DEFINITIONS.map(title => [title.id, title]));

/** Account-owned titles, explicit selection and the per-round play time used by title predicates.
 * Ownership and selection are typed columns; cumulative wins/losses/draws/streaks/kills/deaths are
 * aggregated from the authoritative match_history rows on every grant so pre-existing records count.
 * Play time is stored once per (account, match, round) as the real frozen round duration; rounds
 * without a captured duration stay unknown instead of borrowing the map time limit.
 */
export class AccountTitle {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS account_titles (
        account_id TEXT NOT NULL, title_id INTEGER NOT NULL,
        granted_match_id TEXT NOT NULL, granted_round INTEGER NOT NULL, granted_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, title_id));
      CREATE TABLE IF NOT EXISTS account_title_selection (
        account_id TEXT PRIMARY KEY, title_id INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS account_title_playtime (
        account_id TEXT NOT NULL, match_id TEXT NOT NULL, round INTEGER NOT NULL, seconds INTEGER NOT NULL,
        PRIMARY KEY(account_id, match_id, round));
    `);
  }

  /** Runs inside AccountHistory.record's BEGIN IMMEDIATE after this participant's match_history row;
   * a thrown error rolls the whole match, reward and title grant back together.
   */
  grant(accountId: string, matchId: string, round: number, endedAt: number,
      elapsedSeconds?: number): void {
    if (elapsedSeconds !== undefined && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
      this.database.prepare('INSERT OR IGNORE INTO account_title_playtime VALUES (?, ?, ?, ?)')
        .run(accountId, matchId, round, Math.round(elapsedSeconds));
    }
    const owned = this.ownedIds(accountId);
    const granted = evaluateTitleGrants(this.stats(accountId), owned);
    if (!granted.length) return;
    const insert = this.database.prepare(
      'INSERT OR IGNORE INTO account_titles VALUES (?, ?, ?, ?, ?)');
    for (const titleId of granted) insert.run(accountId, titleId, matchId, round, endedAt);
  }

  /** Authoritative owned catalog plus the worn id; selection row 0 stays a deliberate clear. */
  titles(accountId: string): AccountTitles {
    const owned = this.ownedIds(accountId).flatMap(id => {
      const title = TITLE_BY_ID.get(id);
      return title ? [{id, name: title.name, description: title.description}] : [];
    });
    const row = this.database.prepare('SELECT title_id FROM account_title_selection WHERE account_id = ?')
      .get(accountId);
    const selectedTitleId = row
      ? Number(row.title_id)
      : owned.length ? Math.max(...owned.map(title => title.id)) : 0;
    return {owned, selectedTitleId};
  }

  /** Worn badge for the current authenticated account; 0/absent means no title is shown. */
  currentTitle(accountId: string): PlayerTitle | undefined {
    const {selectedTitleId} = this.titles(accountId);
    if (selectedTitleId <= 0) return undefined;
    const title = TITLE_BY_ID.get(selectedTitleId);
    return title ? {id: title.id, name: title.name} : undefined;
  }

  /** Explicit selection; 0 clears. Any other id must already be permanently owned by this account. */
  select(accountId: string, titleId: number): void {
    if (!Number.isInteger(titleId) || titleId < 0 || titleId > 0x7fffffff) {
      throw new Error('称号ID无效');
    }
    if (titleId > 0 && !this.database.prepare(
      'SELECT title_id FROM account_titles WHERE account_id = ? AND title_id = ?').get(accountId, titleId)) {
      throw new Error('该称号不属于当前账户');
    }
    this.database.prepare(`INSERT INTO account_title_selection VALUES (?, ?)
      ON CONFLICT(account_id) DO UPDATE SET title_id = excluded.title_id`).run(accountId, titleId);
  }

  private ownedIds(accountId: string): number[] {
    return this.database.prepare('SELECT title_id FROM account_titles WHERE account_id = ? ORDER BY title_id')
      .all(accountId).map(row => Number(row.title_id));
  }

  /** Real cumulative statistics: every stored history row plus the captured play time. */
  private stats(accountId: string): TitleStats {
    const rows = this.database.prepare(`SELECT record FROM match_history WHERE account_id = ?
      ORDER BY ended_at ASC, match_id ASC, round ASC`).all(accountId);
    let wins = 0, losses = 0, draws = 0, kills = 0, deaths = 0;
    let currentWins = 0, currentLosses = 0, winStreak = 0, loseStreak = 0;
    for (const row of rows) {
      const {result} = JSON.parse(String(row.record)) as {result: ResultPlayer};
      if (result.outcome === 'WIN') {wins++; currentWins++; currentLosses = 0;}
      else if (result.outcome === 'LOSE') {losses++; currentLosses++; currentWins = 0;}
      else {draws++; currentWins = 0; currentLosses = 0;}
      winStreak = Math.max(winStreak, currentWins);
      loseStreak = Math.max(loseStreak, currentLosses);
      kills += result.kills;
      deaths += result.deaths;
    }
    const battleSeconds = Number(this.database.prepare(
      'SELECT COALESCE(SUM(seconds), 0) AS total FROM account_title_playtime WHERE account_id = ?',
    ).get(accountId)!.total);
    return {wins, losses, draws, winStreak, loseStreak, kills, deaths, battleSeconds};
  }
}
