import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {ReqValuableItemSale, ResValuableItemSale} from '../../../shared/protocols/PtlValuableItemSale';

const VALUABLE_ITEM_IDS = new Set([20001, 20002]);
const MONEY_LIMIT = 999999999;
const MAX_QUANTITY = 0xffffff;

/** Persistent authority for original kind5 valuable partial/full inventory sale. */
export class AccountValuableItemSale {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS valuable_item_sale_receipts (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqValuableItemSale, catalog: CombatCatalog): ResValuableItemSale {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const response = (sold?: ResValuableItemSale['sold'], replayed?: boolean): ResValuableItemSale => {
      const records = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(accountId).map(row => JSON.parse(String(row.record)) as InventoryWireRecord);
      const hotkeys = Array<number>(7).fill(0);
      for (const row of this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId)) {
        hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
      }
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!saved) return {inventory: {records, hotkeys}, quotes: []};
      const bytes = new Uint8Array(saved.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const money = view.getUint32(0x70, true);
      const quotes = records.flatMap(record => {
        if (!VALUABLE_ITEM_IDS.has(record.itemTableId)) return [];
        const item = catalog.items.find(row => row.itemTableId === record.itemTableId);
        if (item?.moneyPrice === undefined) return [];
        const unitPrice = item.moneyPrice >>> 1;
        return [{instanceId: record.instanceId, itemTableId: record.itemTableId, ownedQuantity: record.ownedQuantity,
          unitPrice, canSell: record.ownedQuantity > 0 && money + unitPrice <= MONEY_LIMIT}];
      });
      return {inventory: {records, hotkeys}, quotes, money,
        profile: {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]}, sold, replayed};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation !== 'SELL' || !Number.isInteger(request.instanceId) || request.instanceId! <= 0
        || request.instanceId! > 0xffffffff) throw new Error('出售贵重品实例无效');
    if (!Number.isInteger(request.quantity) || request.quantity! < 1 || request.quantity! > MAX_QUANTITY) {
      throw new Error('出售数量须为正整数且不超过16777215');
    }
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) {
      throw new Error('出售请求ID无效');
    }
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare(
        'SELECT instance_id, quantity, receipt FROM valuable_item_sale_receipts WHERE account_id = ? AND request_id = ?',
      ).get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.instance_id) !== request.instanceId || Number(previous.quantity) !== request.quantity) {
          throw new Error('出售请求ID已用于不同实例或数量');
        }
        const result = response(JSON.parse(String(previous.receipt)) as ResValuableItemSale['sold'], true);
        this.database.exec('COMMIT');
        return result;
      }
      const current = response();
      if (!current.profile || current.money === undefined) throw new Error('账户角色资料尚未建立');
      const record = current.inventory.records.find(row => row.instanceId === request.instanceId);
      if (!record || !VALUABLE_ITEM_IDS.has(record.itemTableId)) throw new Error('该出售实例不属于当前贵重品账户');
      if (request.quantity! > record.ownedQuantity) throw new Error('出售数量超过拥有量');
      const quote = current.quotes.find(row => row.instanceId === request.instanceId);
      if (!quote) throw new Error('该贵重品原出售价格不可用');
      const price = quote.unitPrice * request.quantity!;
      if (current.money + price > MONEY_LIMIT) throw new Error('出售后金钱超出上限');
      const remaining = record.ownedQuantity - request.quantity!;
      if (remaining > 0) {
        const bound = current.inventory.hotkeys.some(instanceId => instanceId === record.instanceId);
        const updated = {...record, ownedQuantity: remaining, battleQuantity: bound ? remaining : 0};
        this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
          .run(JSON.stringify(updated), accountId, record.instanceId);
      } else {
        this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND instance_id = ?').run(accountId, record.instanceId);
        this.database.prepare('DELETE FROM inventory WHERE account_id = ? AND instance_id = ?').run(accountId, record.instanceId);
      }
      const sold = {instanceId: record.instanceId, itemTableId: record.itemTableId,
        quantity: request.quantity!, price, result: 2 as const};
      this.database.prepare('INSERT INTO valuable_item_sale_receipts VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, record.instanceId, request.quantity!, JSON.stringify(sold));
      const result = response(sold, false);
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
