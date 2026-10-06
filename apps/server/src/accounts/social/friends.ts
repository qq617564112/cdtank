import type {DatabaseSync} from 'node:sqlite';
import type {ReqFriends} from '../../../../shared/protocols/PtlFriends';

export class FriendRequestError extends Error {
  constructor(readonly code: string, message: string) {super(message);}
}

/** Persistent rebuilt unilateral relationships, separate from recovered profile data. */
export class AccountFriends {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS account_friends (
      owner_account_id TEXT NOT NULL, target_account_id TEXT NOT NULL,
      PRIMARY KEY(owner_account_id, target_account_id))`);
  }

  request(ownerAccountId: string, request: ReqFriends): string[] {
    this.requireAccount(ownerAccountId);
    if (request.operation !== 'QUERY') {
      const target = request.targetAccountId;
      if (target === ownerAccountId) throw new FriendRequestError('FRIEND_SELF', '不能将自己添加为好友');
      this.requireAccount(target);
      if (request.operation === 'ADD') {
        this.database.prepare('INSERT OR IGNORE INTO account_friends VALUES (?, ?)').run(ownerAccountId, target);
      } else {
        this.database.prepare('DELETE FROM account_friends WHERE owner_account_id = ? AND target_account_id = ?')
          .run(ownerAccountId, target);
      }
    }
    return this.database.prepare('SELECT target_account_id FROM account_friends WHERE owner_account_id = ? ORDER BY target_account_id')
      .all(ownerAccountId).map(row => String(row.target_account_id));
  }

  private requireAccount(accountId: string): void {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) {
      throw new FriendRequestError('FRIEND_TARGET_NOT_FOUND', '好友账户不存在');
    }
  }
}
