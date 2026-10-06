import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {ReqAccount, ResAccount} from '../../../shared/protocols/PtlAccount';

/** Named credentials bind to the same persistent identity used by token sessions. */
export class AccountCredentials {
  constructor(private readonly database: DatabaseSync, private readonly open: (token?: string) => ResAccount) {
    database.exec(`CREATE TABLE IF NOT EXISTS account_credentials (
      account_id TEXT NOT NULL UNIQUE, name TEXT PRIMARY KEY, salt BLOB NOT NULL, password_key BLOB NOT NULL)`);
  }

  accountName(accountId: string): string | undefined {
    const row = this.database.prepare('SELECT name FROM account_credentials WHERE account_id = ?').get(accountId);
    return row ? String(row.name) : undefined;
  }

  authenticate(request: ReqAccount): ResAccount {
    const credentials = request.credentials;
    if (!credentials) {
      const session = this.open(request.token);
      return {...session, accountName: this.accountName(session.accountId)};
    }
    const name = credentials.account.trim();
    if (!name || [...name].length > 20 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new Error('账号应为1至20字');
    }
    if (!credentials.password || [...credentials.password].length > 20) throw new Error('密码应为1至20字');
    if (credentials.operation === 'LOGIN') {
      const row = this.database.prepare(`SELECT a.id, a.token, c.salt, c.password_key
        FROM account_credentials c JOIN accounts a ON a.id = c.account_id WHERE c.name = ?`).get(name);
      if (!row || !timingSafeEqual(scryptSync(credentials.password, row.salt as Uint8Array, 64),
          Buffer.from(row.password_key as Uint8Array))) throw new Error('账号或密码错误');
      return {accountId: String(row.id), token: String(row.token), accountName: name};
    }
    const salt = randomBytes(16);
    const key = scryptSync(credentials.password, salt, 64);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (this.database.prepare('SELECT name FROM account_credentials WHERE name = ?').get(name)) {
        throw new Error('账号已注册');
      }
      const session = this.open(request.token);
      if (this.accountName(session.accountId)) throw new Error('当前账户已绑定账号，请使用登录');
      this.database.prepare('INSERT INTO account_credentials VALUES (?, ?, ?, ?)').run(session.accountId, name, salt, key);
      this.database.exec('COMMIT');
      return {...session, accountName: name};
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
