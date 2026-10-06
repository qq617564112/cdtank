import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {classifyItemId} from '../../../shared/combat/item-hotkeys';
import {calculatePartMaintenanceCost, formatPartMaintenanceCost} from '../../../shared/combat/part-maintenance';
import type {ReqPartMaintenance, ResPartMaintenance, PartMaintenanceQuote} from '../../../shared/protocols/PtlPartMaintenance';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';

/** Rebuilt atomic authority; original49569f adds minutes to the durable item's +10. */
export class AccountPartMaintenance {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS part_maintenance (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
      days INTEGER NOT NULL, currency INTEGER NOT NULL, receipt TEXT NOT NULL,
      PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqPartMaintenance, catalog: CombatCatalog): ResPartMaintenance {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const multiplier = catalog.dataScales.find(row => row.id === 48)?.maximum;
    if (multiplier === undefined) throw new Error('部件维修价格未载入');
    const response = (receipt?: ResPartMaintenance['maintained'], replayed?: boolean): ResPartMaintenance => {
      const records = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(accountId).map(row => JSON.parse(String(row.record)) as InventoryWireRecord);
      const hotkeys = Array<number>(7).fill(0);
      for (const row of this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId)) {
        hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
      }
      const parts = records.flatMap(record => {
        const kind = classifyItemId(record.itemTableId);
        if (kind !== 5 && kind !== 7 && (kind < 8 || kind > 12)) return [];
        const item = catalog.items.find(row => row.itemTableId === record.itemTableId);
        const quotes: PartMaintenanceQuote[] = item?.moneyPrice === undefined || item.tokenPrice === undefined
          || item.breakMode === undefined ? [] : ([0, 1] as const).flatMap(currency => ([1, 7, 30] as const).map(days => {
            const cost = calculatePartMaintenanceCost({itemMoney: item.moneyPrice!, itemCoin: item.tokenPrice!,
              moneyWeekMultiplier: multiplier, currency, days});
            return {currency, days, cost, displayCost: formatPartMaintenanceCost({itemCoin: item.tokenPrice!, currency, days, cost})};
          }));
        return [{instanceId: record.instanceId, itemTableId: record.itemTableId, remainingMinutes: record.ownedQuantity,
          canMaintain: quotes.length > 0 && item?.breakMode !== 3, quotes}];
      });
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!saved) return {parts, inventory: {records, hotkeys}};
      const bytes = new Uint8Array(saved.payload as Uint8Array), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {parts, inventory: {records, hotkeys}, money: view.getUint32(0x70, true), tokens: view.getUint32(0x74, true),
        profile: {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]}, maintained: receipt, replayed};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation !== 'MAINTAIN' || !Number.isInteger(request.instanceId) || request.instanceId! < 0
        || request.instanceId! > 0xffffffff || ![1, 7, 30].includes(request.days!)
        || (request.currency !== 0 && request.currency !== 1)) throw new Error('部件维修请求无效');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('维修请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT instance_id, days, currency, receipt FROM part_maintenance WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.instance_id) !== request.instanceId || Number(previous.days) !== request.days
            || Number(previous.currency) !== request.currency) throw new Error('维修请求ID已用于不同维修');
        const result = response(JSON.parse(String(previous.receipt)) as ResPartMaintenance['maintained'], true);
        this.database.exec('COMMIT'); return result;
      }
      const current = response();
      if (!current.profile || current.money === undefined || current.tokens === undefined) throw new Error('账户角色资料尚未建立');
      const part = current.parts.find(row => row.instanceId === request.instanceId);
      if (!part) throw new Error('该部件实例不属于当前账户');
      if (!part.canMaintain) throw new Error('该部件不能维修');
      const quote = part.quotes.find(row => row.days === request.days && row.currency === request.currency);
      if (!quote) throw new Error('部件维修价格不可用');
      const remainingMinutes = part.remainingMinutes + request.days! * 1440;
      if (remainingMinutes > 367200) throw new Error('部件剩余期限不能超过255天');
      const balance = request.currency === 0 ? current.tokens : current.money;
      if (balance < quote.cost) throw new Error(request.currency === 0 ? '代币余额不足' : '金钱余额不足');
      const record = current.inventory.records.find(row => row.instanceId === request.instanceId)!;
      const bytes = Uint8Array.from(current.profile.bytes), view = new DataView(bytes.buffer);
      view.setUint32(request.currency === 0 ? 0x74 : 0x70, balance - quote.cost, true);
      this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
        .run(JSON.stringify({...record, ownedQuantity: remainingMinutes}), accountId, request.instanceId!);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      const maintained = {instanceId: request.instanceId!, remainingMinutes, cost: quote.cost, currency: request.currency, days: request.days!};
      this.database.prepare('INSERT INTO part_maintenance VALUES (?, ?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, request.instanceId!, request.days!, request.currency, JSON.stringify(maintained));
      const result = response(maintained, false);
      this.database.exec('COMMIT'); return result;
    } catch (error) {this.database.exec('ROLLBACK'); throw error;}
  }
}
