import type {DatabaseSync} from 'node:sqlite';
import type {ReqTankShop, ResTankShop} from '../../../shared/protocols/PtlTankShop';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
import {tankShopCatalog} from './tank-shop-catalog';

/** Rebuilt atomic purchase creates owned equipment, independent of item inventory. */
export class AccountTankShop {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS tank_purchases (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, tank_id INTEGER NOT NULL,
      currency TEXT NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqTankShop): ResTankShop {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const catalog = tankShopCatalog();
    const tanks = catalog.map(row => row.product);
    const profile = () => this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
    if (request.operation === 'QUERY') {
      const row = profile();
      if (!row) return {tanks};
      const bytes = row.payload as Uint8Array;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {tanks, money: view.getUint32(0x70, true), tokens: view.getUint32(0x74, true)};
    }
    const definition = catalog.find(row => row.product.tankId === request.tankId);
    if (request.operation !== 'BUY' || !definition) throw new Error('战车不在出售范围');
    if (request.currency !== 'MONEY') throw new Error('此战车只能使用金钱购买');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('购买请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const row = profile();
      if (!row) throw new Error('账户角色资料尚未建立');
      const bytes = new Uint8Array(row.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const money = view.getUint32(0x70, true), tokens = view.getUint32(0x74, true);
      const previous = this.database.prepare('SELECT tank_id, currency, receipt FROM tank_purchases WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.tank_id) !== request.tankId || previous.currency !== request.currency) throw new Error('购买请求ID已用于不同购买');
        const purchased = JSON.parse(String(previous.receipt)) as OwnedRoleRecordData;
        this.database.exec('COMMIT');
        return {tanks, money, tokens, purchased, replayed: true};
      }
      const cost = definition.product.moneyPrice;
      if (money < cost) throw new Error('金钱余额不足');
      let instanceId = 1;
      for (const used of this.database.prepare(`SELECT instance_id FROM inventory WHERE account_id = ?
        UNION SELECT instance_id FROM role_records WHERE account_id = ? ORDER BY instance_id`).all(accountId, accountId)) {
        const id = Number(used.instance_id);
        if (id === instanceId) instanceId++;
        else if (id > instanceId) break;
      }
      if (instanceId > 0xffffffff) throw new Error('账户物品实例ID已用尽');
      // Rebuilt purchase state uses source base values and part capacity.
      const fields = new Map<number, number>();
      for (let offset = 0x1c; offset <= 0x6c; offset += 4) fields.set(offset, 0);
      for (const [offset, value] of [[0x1c, instanceId], [0x24, definition.product.tankId], [0x28, definition.product.textures.U],
        [0x2c, definition.product.textures.M], [0x30, definition.product.textures.XY],
        [0x3c, definition.base.attack], [0x40, definition.base.attackBonus],
        [0x4c, definition.base.defense], [0x50, definition.base.defenseBonus],
        [0x6c, definition.partCapacity]]) fields.set(offset, value);
      const purchased: OwnedRoleRecordData = {name: definition.product.name, fields: [...fields]};
      view.setUint32(0x70, money - cost, true);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      this.database.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(accountId, 'equipment', instanceId, JSON.stringify(purchased));
      this.database.prepare('INSERT INTO tank_purchases VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, definition.product.tankId, request.currency, JSON.stringify(purchased));
      this.database.exec('COMMIT');
      return {tanks, money: money - cost, tokens, purchased, replayed: false};
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
