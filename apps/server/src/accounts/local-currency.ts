import type {DatabaseSync} from 'node:sqlite';
import {LOCAL_CURRENCY_LIMITS, type LocalCurrencyBalance, type LocalCurrencyCredit}
  from '../../../shared/contracts/local-currency';

/** Called by the desktop host over its private parent-process channel. */
export function creditLocalCurrency(database: DatabaseSync, credit: LocalCurrencyCredit): LocalCurrencyBalance {
  const account = typeof credit?.account === 'string' ? credit.account.trim() : '';
  if (!account || [...account].length > 20 || /[\u0000-\u001f\u007f]/.test(account)) {
    throw new Error('用户名应为1至20字。');
  }
  for (const [key, label] of [['tokens', '星币'], ['money', '金钱']] as const) {
    if (!Number.isSafeInteger(credit[key]) || credit[key] < 0 || credit[key] > LOCAL_CURRENCY_LIMITS[key]) {
      throw new Error(`${label}数量应为0至${LOCAL_CURRENCY_LIMITS[key]}的整数。`);
    }
  }
  if (credit.tokens === 0 && credit.money === 0) throw new Error('请至少填写一项大于0的增加数量。');
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = database.prepare(`SELECT c.account_id, p.payload FROM account_credentials c
      LEFT JOIN role_profiles p ON p.account_id = c.account_id WHERE c.name = ?`).get(account);
    if (!row) throw new Error('用户名不存在，请先在本地模式注册该账号。');
    if (!row.payload) throw new Error('该账户的角色资料尚未建立。');
    const bytes = new Uint8Array(row.payload as Uint8Array);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const money = view.getUint32(0x70, true) + credit.money;
    const tokens = view.getUint32(0x74, true) + credit.tokens;
    if (money > LOCAL_CURRENCY_LIMITS.money || tokens > LOCAL_CURRENCY_LIMITS.tokens) {
      throw new Error('增加后余额超出上限，请减少增加数量。');
    }
    view.setUint32(0x70, money, true);
    view.setUint32(0x74, tokens, true);
    database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, String(row.account_id));
    database.exec('COMMIT');
    return {account, tokens, money};
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
