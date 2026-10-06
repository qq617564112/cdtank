import type {DatabaseSync} from 'node:sqlite';

/** Create the append-only spending capture table. Callers supply every receipt key. */
export function initializeAccountSpending(database: DatabaseSync): void {
  database.exec(`CREATE TABLE IF NOT EXISTS account_spending_ledger (
    account_id TEXT NOT NULL,
    source TEXT NOT NULL,
    receipt_id TEXT NOT NULL,
    money INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    PRIMARY KEY(account_id, source, receipt_id));`);
}

/** Record one committed monetary receipt inside the producer's existing transaction. */
export function recordAccountSpending(database: DatabaseSync, accountId: string, source: string,
    receiptId: string, money: number, tokens: number): void {
  if (typeof accountId !== 'string' || accountId.length === 0) throw new Error('支出账户无效');
  if (typeof source !== 'string' || source.length === 0) throw new Error('支出来源无效');
  if (typeof receiptId !== 'string' || receiptId.length === 0) throw new Error('支出回执ID无效');
  if (!Number.isSafeInteger(money) || money < 0 || !Number.isSafeInteger(tokens) || tokens < 0) {
    throw new Error('支出金额无效');
  }
  database.prepare('INSERT INTO account_spending_ledger VALUES (?, ?, ?, ?, ?)')
    .run(accountId, source, receiptId, money, tokens);
}

/** Sum committed capture-window spending; accounts without a receipt remain unknown. */
export function readAccountSpending(database: DatabaseSync, accountId: string): {
  spentMoney?: number; spentTokens?: number;
} {
  const row = database.prepare(`SELECT count(*) AS receipt_count,
    coalesce(sum(money), 0) AS spent_money, coalesce(sum(tokens), 0) AS spent_tokens
    FROM account_spending_ledger WHERE account_id = ?`).get(accountId);
  if (!row || Number(row.receipt_count) === 0) return {};
  return {spentMoney: Number(row.spent_money), spentTokens: Number(row.spent_tokens)};
}
