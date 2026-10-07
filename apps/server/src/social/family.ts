import type {DatabaseSync} from 'node:sqlite';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';

export interface FamilyMembership {
  accountId: string;
  familyId: string;
  familyName: string;
  assignedAt: number;
}

/** Persistent operator-managed family membership in the account database. */
export class FamilyStore {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS family_memberships (
      account_id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      family_name TEXT NOT NULL,
      assigned_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS family_memberships_family_id
      ON family_memberships(family_id);`);
  }

  family(accountId: string): {id: string; name: string} | undefined {
    const row = this.database.prepare(
      'SELECT family_id, family_name FROM family_memberships WHERE account_id = ?').get(accountId);
    return row ? {id: String(row.family_id), name: String(row.family_name)} : undefined;
  }

  familyAccounts(familyId: string): string[] {
    return this.database.prepare(
      'SELECT account_id FROM family_memberships WHERE family_id = ? ORDER BY account_id')
      .all(familyId).map(row => String(row.account_id));
  }

  assign(accountId: string, familyId: string, familyName: string): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) {
        throw new Error('账户不存在');
      }
      this.database.prepare('UPDATE family_memberships SET family_name = ? WHERE family_id = ?')
        .run(familyName, familyId);
      this.database.prepare(`INSERT INTO family_memberships
        (account_id, family_id, family_name, assigned_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          family_id = excluded.family_id,
          family_name = excluded.family_name,
          assigned_at = excluded.assigned_at`)
        .run(accountId, familyId, familyName, Date.now());
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  remove(accountId: string): boolean {
    const result = this.database.prepare(
      'DELETE FROM family_memberships WHERE account_id = ?').run(accountId);
    return result.changes > 0;
  }

  list(familyId?: string): FamilyMembership[] {
    const rows = familyId === undefined
      ? this.database.prepare(`SELECT account_id, family_id, family_name, assigned_at
          FROM family_memberships ORDER BY family_id, account_id`).all()
      : this.database.prepare(`SELECT account_id, family_id, family_name, assigned_at
          FROM family_memberships WHERE family_id = ? ORDER BY account_id`).all(familyId);
    return rows.map(row => ({
      accountId: String(row.account_id),
      familyId: String(row.family_id),
      familyName: String(row.family_name),
      assignedAt: Number(row.assigned_at),
    }));
  }
}

/** Read-only current-account family identity; family mutations stay in the operator CLI. */
export function registerFamilyApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>): void {
  server.implementApi('Family', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    await call.succ({accountId, family: accounts.family(accountId)});
  });
}
