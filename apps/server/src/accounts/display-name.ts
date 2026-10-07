import type {DatabaseSync} from 'node:sqlite';

/** Dedicated invalid-name rejection for the nickname lookup; mapped to PLAYER_SEARCH_NAME_INVALID. */
export class PlayerSearchNameError extends Error {
  readonly code = 'PLAYER_SEARCH_NAME_INVALID';
  constructor(message: string) {super(message);}
}

/** Independent rebuilt account nickname; original profile strings remain untouched. */
export class AccountDisplayName {
  constructor(private readonly database: DatabaseSync) {
    database.exec('CREATE TABLE IF NOT EXISTS account_display_names (account_id TEXT PRIMARY KEY, name TEXT NOT NULL)');
  }

  get(accountId: string): string {
    this.requireAccount(accountId);
    const row = this.database.prepare('SELECT name FROM account_display_names WHERE account_id = ?').get(accountId);
    return row ? String(row.name) : `坦克手-${accountId.slice(0, 6)}`;
  }

  set(accountId: string, name: string): string {
    this.requireAccount(accountId);
    if (typeof name !== 'string' || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('昵称不能包含控制字符');
    const trimmed = name.trim();
    if (!trimmed || [...trimmed].length > 16) throw new Error('昵称应为1至16字');
    this.database.prepare(`INSERT INTO account_display_names (account_id, name) VALUES (?, ?)
      ON CONFLICT(account_id) DO UPDATE SET name = excluded.name`).run(accountId, trimmed);
    return trimmed;
  }

  /** Persistent accounts whose effective nickname equals the trimmed input, ordered by account id. */
  find(name: string): string[] {
    if (typeof name !== 'string' || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new PlayerSearchNameError('昵称不能包含控制字符');
    }
    const trimmed = name.trim();
    if (!trimmed || [...trimmed].length > 16) throw new PlayerSearchNameError('昵称应为1至16字');
    return this.database.prepare(`SELECT a.id AS id FROM accounts a
      LEFT JOIN account_display_names d ON d.account_id = a.id
      WHERE COALESCE(d.name, '坦克手-' || substr(a.id, 1, 6)) = ?
      ORDER BY a.id`).all(trimmed).map(row => String(row.id));
  }

  private requireAccount(accountId: string): void {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
  }
}
