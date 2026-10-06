import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {calculateTankMaintenanceCost, formatTankMaintenanceCost} from '../../../shared/combat/tank-maintenance';
import type {ReqTankMaintenance, ResTankMaintenance, TankMaintenanceQuote} from '../../../shared/protocols/PtlTankMaintenance';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
import {initializeAccountSpending, recordAccountSpending} from './spending';

/** Rebuilt atomic account settlement; original495612 adds days*1440 to owned+34. */
export class AccountTankMaintenance {
  constructor(private readonly database: DatabaseSync) {
    initializeAccountSpending(database);
    database.exec(`CREATE TABLE IF NOT EXISTS tank_maintenance (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
      days INTEGER NOT NULL, currency INTEGER NOT NULL, receipt TEXT NOT NULL,
      PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqTankMaintenance, catalog: CombatCatalog): ResTankMaintenance {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const multiplier = catalog.dataScales.find(row => row.id === 48)?.maximum;
    if (multiplier === undefined) throw new Error('战车保养价格未载入');
    const quotes = (tankId: number): TankMaintenanceQuote[] => {
      const tank = catalog.tankTypes?.find(row => row.tankId === tankId);
      if (tank?.tankMoney === undefined || tank.tankCoin === undefined) return [];
      return ([0, 1] as const).flatMap(currency => ([1, 7, 30] as const).map(days => {
        const cost = calculateTankMaintenanceCost({tankMoney: tank.tankMoney!, tankCoin: tank.tankCoin!,
          moneyWeekMultiplier: multiplier, currency, days});
        return {currency, days, cost, displayCost: formatTankMaintenanceCost({tankCoin: tank.tankCoin!, currency, days, cost})};
      }));
    };
    const response = (receipt?: ResTankMaintenance['maintained'], replayed?: boolean): ResTankMaintenance => {
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      const owned: ResTankMaintenance['owned'] = {base: [], equipment: []};
      for (const row of this.database.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(accountId)) {
        owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)) as OwnedRoleRecordData);
      }
      const tanks = owned.equipment.flatMap(record => {
        const fields = new Map(record.fields), instanceId = fields.get(0x1c), tankId = fields.get(0x24), remainingMinutes = fields.get(0x34);
        return instanceId === undefined || tankId === undefined || remainingMinutes === undefined ? []
          : [{instanceId, tankId, remainingMinutes, quotes: quotes(tankId)}];
      });
      if (!saved) return {tanks, owned};
      const bytes = new Uint8Array(saved.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {tanks, money: view.getUint32(0x70, true), tokens: view.getUint32(0x74, true), owned,
        profile: {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]}, maintained: receipt, replayed};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation !== 'MAINTAIN' || !Number.isInteger(request.instanceId) || request.instanceId! < 0
        || request.instanceId! > 0xffffffff || ![1, 7, 30].includes(request.days!)
        || (request.currency !== 0 && request.currency !== 1)) throw new Error('战车保养请求无效');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('保养请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT instance_id, days, currency, receipt FROM tank_maintenance WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.instance_id) !== request.instanceId || Number(previous.days) !== request.days
            || Number(previous.currency) !== request.currency) throw new Error('保养请求ID已用于不同保养');
        const result = response(JSON.parse(String(previous.receipt)) as ResTankMaintenance['maintained'], true);
        this.database.exec('COMMIT');
        return result;
      }
      const current = response();
      if (!current.profile || current.money === undefined || current.tokens === undefined) throw new Error('账户角色资料尚未建立');
      const tank = current.tanks.find(row => row.instanceId === request.instanceId);
      if (!tank) throw new Error('该战车实例不属于当前账户');
      const quote = tank.quotes.find(row => row.days === request.days && row.currency === request.currency);
      if (!quote || quote.cost < 0) throw new Error('战车保养价格不可用');
      const remainingMinutes = tank.remainingMinutes + request.days! * 1440;
      if (remainingMinutes > 367200) throw new Error('战车剩余期限不能超过255天');
      const balance = request.currency === 0 ? current.tokens : current.money;
      if (balance < quote.cost) throw new Error(request.currency === 0 ? '代币余额不足' : '金钱余额不足');
      const record = current.owned.equipment.find(row => new Map(row.fields).get(0x1c) === request.instanceId)!;
      const fields = new Map(record.fields); fields.set(0x34, remainingMinutes);
      const bytes = Uint8Array.from(current.profile.bytes), view = new DataView(bytes.buffer);
      view.setUint32(request.currency === 0 ? 0x74 : 0x70, balance - quote.cost, true);
      this.database.prepare('UPDATE role_records SET record = ? WHERE account_id = ? AND kind = ? AND instance_id = ?')
        .run(JSON.stringify({name: record.name, fields: [...fields]}), accountId, 'equipment', request.instanceId!);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      const maintained = {instanceId: request.instanceId!, remainingMinutes, cost: quote.cost, currency: request.currency, days: request.days!};
      this.database.prepare('INSERT INTO tank_maintenance VALUES (?, ?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, request.instanceId!, request.days!, request.currency, JSON.stringify(maintained));
      recordAccountSpending(this.database, accountId, 'tank-maintenance', request.requestId,
        request.currency === 1 ? quote.cost : 0, request.currency === 0 ? quote.cost : 0);
      const result = response(maintained, false);
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
