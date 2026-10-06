import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../shared/combat/inventory-query';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {ReqStackItemSale, ResStackItemSale} from '../../../shared/protocols/PtlStackItemSale';

/** Persistent authority for original kind3 partial/full inventory sale. */
export class AccountStackItemSale {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS stack_item_sales (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqStackItemSale, catalog: CombatCatalog): ResStackItemSale {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const response = (sold?: ResStackItemSale['sold'], replayed?: boolean): ResStackItemSale => {
      const records = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(accountId).map(row => JSON.parse(String(row.record)) as InventoryWireRecord);
      const hotkeys = Array<number>(7).fill(0);
      for (const row of this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId)) {
        hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
      }
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!saved) return {inventory: {records, hotkeys}, quotes: []};
      const bytes = new Uint8Array(saved.payload as Uint8Array), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const money = view.getUint32(0x70, true);
      const quotes = records.flatMap(record => {
        if (![1, 2].includes(classifyInventoryCategory(record.itemTableId))) return [];
        const item = catalog.items.find(row => row.itemTableId === record.itemTableId);
        if (item?.moneyPrice === undefined) return [];
        const unitPrice = item.moneyPrice >>> 1;
        return [{instanceId: record.instanceId, itemTableId: record.itemTableId, ownedQuantity: record.ownedQuantity,
          unitPrice, canSell: record.ownedQuantity > 0 && money + unitPrice <= 999999999}];
      });
      return {inventory: {records, hotkeys}, quotes, money,
        profile: {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]}, sold, replayed};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation !== 'SELL' || !Number.isInteger(request.instanceId) || request.instanceId! <= 0
        || request.instanceId! > 0xffffffff) throw new Error('出售物品实例无效');
    if (!Number.isInteger(request.quantity) || request.quantity! < 1 || request.quantity! > 0xffffff) throw new Error('出售数量须为正整数且不超过16777215');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('出售请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT instance_id, quantity, receipt FROM stack_item_sales WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.instance_id) !== request.instanceId || Number(previous.quantity) !== request.quantity) throw new Error('出售请求ID已用于不同实例或数量');
        const result = response(JSON.parse(String(previous.receipt)) as ResStackItemSale['sold'], true);
        this.database.exec('COMMIT'); return result;
      }
      const current = response();
      if (!current.profile || current.money === undefined) throw new Error('账户角色资料尚未建立');
      const record = current.inventory.records.find(row => row.instanceId === request.instanceId);
      if (!record) throw new Error('该出售实例不属于当前账户');
      const quote = current.quotes.find(row => row.instanceId === request.instanceId);
      if (!quote) throw new Error('该物品分类或原出售价格不可用');
      if (request.quantity! > record.ownedQuantity) throw new Error('出售数量超过拥有量');
      const price = quote.unitPrice * request.quantity!;
      // Web authority checks the mathematical total instead of wrapping original low32 arithmetic.
      if (current.money + price > 999999999) throw new Error('出售后金钱超出上限');
      const remaining = record.ownedQuantity - request.quantity!;
      if (remaining > 0) {
        const item = catalog.items.find(row => row.itemTableId === record.itemTableId)!;
        const updated = {...record, ownedQuantity: remaining, battleQuantity: Math.min(remaining, item.battleUseMax)};
        this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
          .run(JSON.stringify(updated), accountId, record.instanceId);
      } else {
        this.database.prepare('DELETE FROM inventory WHERE account_id = ? AND instance_id = ?').run(accountId, record.instanceId);
        // The supported Web configuration permits an instance in several slots; clear every reference.
        this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND instance_id = ?').run(accountId, record.instanceId);
      }
      const bytes = Uint8Array.from(current.profile.bytes);
      new DataView(bytes.buffer).setUint32(0x70, current.money + price, true);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      const sold = {instanceId: record.instanceId, itemTableId: record.itemTableId, quantity: request.quantity!, price, result: 2 as const};
      this.database.prepare('INSERT INTO stack_item_sales VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, record.instanceId, request.quantity!, JSON.stringify(sold));
      const result = response(sold, false);
      this.database.exec('COMMIT'); return result;
    } catch (error) {this.database.exec('ROLLBACK'); throw error;}
  }
}
