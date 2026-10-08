import type {DatabaseSync} from 'node:sqlite';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {ReqShop, ResShop, ShopItem} from '../../../shared/protocols/PtlShop';
import {anchorMaintenance, removeMaintenanceClock} from './maintenance-clock';
import {initializeAccountSpending, recordAccountSpending} from './spending';

/** Adopted runtime expiry for a newly purchased category5 hat; Durable remains original metadata. */
const DECORATION_PURCHASE_MINUTES = 3 * 24 * 60;

function isDecorationPurchase(itemTableId: number): boolean {
  return itemTableId >= 10001 && itemTableId <= 10040;
}

/** Rebuilt purchase authority; the caller supplies the bounded source catalog. */
export class AccountShop {
  constructor(private readonly database: DatabaseSync) {
    initializeAccountSpending(database);
    database.exec(`CREATE TABLE IF NOT EXISTS shop_purchases (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, item_table_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL, currency TEXT NOT NULL, receipt TEXT NOT NULL,
      PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, items: readonly ShopItem[], request: ReqShop): ResShop {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) {
      throw new Error('账户不存在');
    }
    if (request.operation === 'QUERY') return {items: [...items], ...this.balances(accountId)};
    if (request.operation !== 'BUY') throw new Error('商店操作无效');
    const {itemTableId, quantity, currency, requestId} = request;
    if (!Number.isInteger(itemTableId) || itemTableId! <= 0 || itemTableId! > 0xffffffff) {
      throw new Error('购买物品ID无效');
    }
    if (!Number.isInteger(quantity) || quantity! < 1 || quantity! > 10) {
      throw new Error('购买数量应为1至10');
    }
    if (currency !== 'MONEY' && currency !== 'TOKENS') throw new Error('购买货币无效');
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
      throw new Error('购买请求ID无效');
    }
    const decorationPurchase = isDecorationPurchase(itemTableId!);
    if (decorationPurchase && quantity !== 1) throw new Error('饰品购买数量应为1');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const profile = this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!profile) throw new Error('账户角色资料尚未建立');
      const bytes = new Uint8Array(profile.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const money = view.getUint32(0x70, true), tokens = view.getUint32(0x74, true);
      const previous = this.database.prepare(
        'SELECT item_table_id, quantity, currency, receipt FROM shop_purchases WHERE account_id = ? AND request_id = ?',
      ).get(accountId, requestId);
      if (previous) {
        if (Number(previous.item_table_id) !== itemTableId || Number(previous.quantity) !== quantity ||
            previous.currency !== currency) throw new Error('购买请求ID已用于不同购买');
        const purchased = JSON.parse(String(previous.receipt)) as InventoryWireRecord;
        this.database.exec('COMMIT');
        return {items: [...items], money, tokens, purchased, replayed: true};
      }
      const item = items.find(row => row.itemTableId === itemTableId);
      if (!item) throw new Error('该物品不在商店出售范围');
      const unitPrice = currency === 'MONEY' ? item.moneyPrice : item.tokenPrice;
      const cost = unitPrice * quantity!;
      if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0 || !Number.isSafeInteger(cost)) {
        throw new Error('物品价格无效');
      }
      if (cost > (currency === 'MONEY' ? money : tokens)) {
        throw new Error(currency === 'MONEY' ? '金钱余额不足' : '代币余额不足');
      }
      // Rebuilt allocation chooses the first unused positive uint32 in both owned tables.
      let instanceId = 1;
      for (const row of this.database.prepare(`SELECT instance_id FROM inventory WHERE account_id = ?
        UNION SELECT instance_id FROM role_records WHERE account_id = ? ORDER BY instance_id`).all(accountId, accountId)) {
        const used = Number(row.instance_id);
        if (used === instanceId) instanceId++;
        else if (used > instanceId) break;
      }
      if (instanceId > 0xffffffff) throw new Error('账户物品实例ID已用尽');
      removeMaintenanceClock(this.database, accountId, 'part', instanceId);
      const purchased: InventoryWireRecord = {instanceId, itemTableId: itemTableId!,
        ownedQuantity: decorationPurchase ? DECORATION_PURCHASE_MINUTES : quantity!,
        battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
      const nextMoney = currency === 'MONEY' ? money - cost : money;
      const nextTokens = currency === 'TOKENS' ? tokens - cost : tokens;
      view.setUint32(currency === 'MONEY' ? 0x70 : 0x74, currency === 'MONEY' ? nextMoney : nextTokens, true);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      this.database.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(accountId, instanceId, JSON.stringify(purchased));
      if (decorationPurchase) {
        anchorMaintenance(this.database, accountId, 'part', instanceId, DECORATION_PURCHASE_MINUTES);
      }
      this.database.prepare('INSERT INTO shop_purchases VALUES (?, ?, ?, ?, ?, ?)')
        .run(accountId, requestId, itemTableId!, quantity!, currency, JSON.stringify(purchased));
      recordAccountSpending(this.database, accountId, 'shop', requestId,
        currency === 'MONEY' ? cost : 0, currency === 'TOKENS' ? cost : 0);
      this.database.exec('COMMIT');
      return {items: [...items], money: nextMoney, tokens: nextTokens, purchased, replayed: false};
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private balances(accountId: string): Pick<ResShop, 'money' | 'tokens'> {
    const profile = this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
    if (!profile) return {};
    const bytes = profile.payload as Uint8Array;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {money: view.getUint32(0x70, true), tokens: view.getUint32(0x74, true)};
  }
}
