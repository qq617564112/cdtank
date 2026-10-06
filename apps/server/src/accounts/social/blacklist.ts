import type {DatabaseSync} from 'node:sqlite';
import type {ReqBlacklist} from '../../../../shared/protocols/PtlBlacklist';

export class BlacklistRequestError extends Error {
  constructor(readonly code: string, message: string) {super(message);}
}

/** Persistent rebuilt unilateral relationships, separate from recovered profile data. */
export class AccountBlacklist {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS account_blacklist (
      owner_account_id TEXT NOT NULL, target_account_id TEXT NOT NULL,
      PRIMARY KEY(owner_account_id, target_account_id))`);
  }

  request(ownerAccountId: string, request: ReqBlacklist): string[] {
    this.requireAccount(ownerAccountId);
    if (request.operation !== 'QUERY') {
      const target = request.targetAccountId;
      if (target === ownerAccountId) throw new BlacklistRequestError('BLACKLIST_SELF', '不能屏蔽自己');
      this.requireAccount(target);
      if (request.operation === 'ADD') {
        this.database.prepare('INSERT OR IGNORE INTO account_blacklist VALUES (?, ?)').run(ownerAccountId, target);
      } else {
        this.database.prepare('DELETE FROM account_blacklist WHERE owner_account_id = ? AND target_account_id = ?')
          .run(ownerAccountId, target);
      }
    }
    return this.database.prepare('SELECT target_account_id FROM account_blacklist WHERE owner_account_id = ? ORDER BY target_account_id')
      .all(ownerAccountId).map(row => String(row.target_account_id));
  }

  isBlocked(ownerAccountId: string, targetAccountId: string): boolean {
    return !!this.database.prepare('SELECT 1 FROM account_blacklist WHERE owner_account_id = ? AND target_account_id = ?')
      .get(ownerAccountId, targetAccountId);
  }

  private requireAccount(accountId: string): void {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) {
      throw new BlacklistRequestError('BLACKLIST_TARGET_NOT_FOUND', '屏蔽账户不存在');
    }
  }
}
