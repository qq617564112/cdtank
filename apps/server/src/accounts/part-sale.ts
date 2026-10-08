import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../shared/combat/inventory-query';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {ReqPartSale, ResPartSale} from '../../../shared/protocols/PtlPartSale';
import {currentMaintenanceMinutes} from './maintenance-clock';

/** Web settlement follows the original whole-instance request and success1 receipt. */
export class AccountPartSale {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS part_sales (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
      receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqPartSale, catalog: CombatCatalog): ResPartSale {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const response = (sold?: ResPartSale['sold'], replayed?: boolean): ResPartSale => {
      const records = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(accountId).map(row => {
          const record = JSON.parse(String(row.record)) as InventoryWireRecord;
          return {...record, ownedQuantity: currentMaintenanceMinutes(this.database, accountId, 'part',
            record.instanceId, record.ownedQuantity)};
        });
      const hotkeys = Array<number>(7).fill(0);
      for (const row of this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId)) {
        hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
      }
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!saved) return {inventory: {records, hotkeys}, quotes: []};
      const bytes = new Uint8Array(saved.payload as Uint8Array), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const money = view.getUint32(0x70, true);
      const quotes = records.flatMap(record => {
        const category = classifyInventoryCategory(record.itemTableId);
        if (![3, 4, 5].includes(category)) return [];
        const item = catalog.items.find(row => row.itemTableId === record.itemTableId);
        if (item?.moneyPrice === undefined) return [];
        // Original439947 uses unsigned ItemMoney >>1; no remaining-minute multiplier.
        const price = item.moneyPrice >>> 1;
        return [{instanceId: record.instanceId, itemTableId: record.itemTableId, price, canSell: money + price <= 999999999}];
      });
      return {inventory: {records, hotkeys}, quotes, money,
        profile: {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]}, sold, replayed};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation !== 'SELL' || !Number.isInteger(request.instanceId) || request.instanceId! < 0
        || request.instanceId! > 0xffffffff) throw new Error('出售部件实例无效');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('出售请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT instance_id, receipt FROM part_sales WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.instance_id) !== request.instanceId) throw new Error('出售请求ID已用于不同实例');
        const result = response(JSON.parse(String(previous.receipt)) as ResPartSale['sold'], true);
        this.database.exec('COMMIT'); return result;
      }
      const current = response();
      if (!current.profile || current.money === undefined) throw new Error('账户角色资料尚未建立');
      const record = current.inventory.records.find(row => row.instanceId === request.instanceId);
      if (!record) throw new Error('该出售实例不属于当前账户');
      const quote = current.quotes.find(row => row.instanceId === request.instanceId);
      if (!quote) throw new Error('该物品分类或原出售价格不可用');
      if (!quote.canSell) throw new Error('出售后金钱超出上限');
      const bytes = Uint8Array.from(current.profile.bytes), view = new DataView(bytes.buffer);
      view.setUint32(0x70, current.money + quote.price, true);
      // Rebuilt removal clears only qualified cosmetic/part instance references.
      for (const offset of [0x118, 0x13c, 0x140, 0x144, 0x148, 0x14c, 0x150, 0x154, 0x158]) {
        if (view.getUint32(offset, true) === record.instanceId) view.setUint32(offset, 0, true);
      }
      this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND instance_id = ?').run(accountId, record.instanceId);
      this.database.prepare('DELETE FROM inventory WHERE account_id = ? AND instance_id = ?').run(accountId, record.instanceId);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      const sold = {instanceId: record.instanceId, itemTableId: record.itemTableId, price: quote.price, result: 1 as const};
      this.database.prepare('INSERT INTO part_sales VALUES (?, ?, ?, ?)').run(accountId, request.requestId, record.instanceId, JSON.stringify(sold));
      const result = response(sold, false);
      this.database.exec('COMMIT'); return result;
    } catch (error) {this.database.exec('ROLLBACK'); throw error;}
  }
}
