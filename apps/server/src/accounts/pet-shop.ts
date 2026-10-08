import type {DatabaseSync} from 'node:sqlite';
import type {ReqPetShop, ResPetShop} from '../../../shared/protocols/PtlPetShop';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
import {petShopCatalog} from './pet-shop-catalog';
import {initializeAccountSpending, recordAccountSpending} from './spending';

/** Rebuilt atomic purchase creates a complete owned base record and a replay receipt. */
export class AccountPetShop {
  constructor(private readonly database: DatabaseSync) {
    initializeAccountSpending(database);
    database.exec(`CREATE TABLE IF NOT EXISTS pet_purchases (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, pet_id INTEGER NOT NULL,
      currency TEXT NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqPetShop): ResPetShop {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const catalog = petShopCatalog();
    const availablePets = () => {
      const records = this.database.prepare("SELECT record FROM role_records WHERE account_id = ? AND kind = 'base'").all(accountId);
      const owned = new Set(records.map(row => {
        const record = JSON.parse(String(row.record)) as OwnedRoleRecordData;
        return new Map(record.fields).get(8);
      }));
      return catalog.map(row => row.product).filter(pet => !owned.has(pet.petId));
    };
    const profile = () => this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
    if (request.operation === 'QUERY') {
      const pets = availablePets();
      const row = profile();
      if (!row) return {pets};
      const bytes = row.payload as Uint8Array;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {pets, money: view.getUint32(0x70, true), tokens: view.getUint32(0x74, true)};
    }
    const definition = catalog.find(row => row.product.petId === request.petId);
    if (request.operation !== 'BUY' || !definition) throw new Error('宠物不在出售范围');
    if (request.currency !== 'MONEY') throw new Error('此宠物只能使用金钱购买');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('购买请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const row = profile();
      if (!row) throw new Error('账户角色资料尚未建立');
      const bytes = new Uint8Array(row.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const money = view.getUint32(0x70, true), tokens = view.getUint32(0x74, true);
      const previous = this.database.prepare('SELECT pet_id, currency, receipt FROM pet_purchases WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      const pets = availablePets();
      if (previous) {
        if (Number(previous.pet_id) !== request.petId || previous.currency !== request.currency) throw new Error('购买请求ID已用于不同购买');
        const purchased = JSON.parse(String(previous.receipt)) as OwnedRoleRecordData;
        this.database.exec('COMMIT');
        return {pets, money, tokens, purchased, replayed: true};
      }
      if (!pets.some(pet => pet.petId === definition.product.petId)) throw new Error('已拥有此宠物，不能重复购买');
      const count = this.database.prepare("SELECT count(*) AS n FROM role_records WHERE account_id = ? AND kind = 'base'").get(accountId)!;
      if (Number(count.n) >= 10) throw new Error('拥有宠物数量已达10只');
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
      // Explicit rebuilt unmodified purchase state; unknown fields stay0.
      const fields = new Map<number, number>();
      for (const offset of [4, 0, 8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c,
        0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90, 0x74, 0x78]) fields.set(offset, 0);
      fields.set(0, instanceId); fields.set(8, definition.product.petId);
      fields.set(0x2c, definition.product.maxHp);
      fields.set(0x34, definition.base.critical); fields.set(0x3c, definition.base.lucky);
      for (let index = 0; index < 6; index++) {
        fields.set(0x44 + index * 4, definition.base.skills[index]);
        // Web newborn policy: source levels are caps; existing records are preserved.
        fields.set(0x5c + index * 4, definition.base.levels[index]);
      }
      const purchased: OwnedRoleRecordData = {name: definition.product.name, fields: [...fields]};
      view.setUint32(0x70, money - cost, true);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
      this.database.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(accountId, 'base', instanceId, JSON.stringify(purchased));
      this.database.prepare('INSERT INTO pet_purchases VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, definition.product.petId, request.currency, JSON.stringify(purchased));
      recordAccountSpending(this.database, accountId, 'pet-shop', request.requestId, cost, 0);
      this.database.exec('COMMIT');
      return {pets: pets.filter(pet => pet.petId !== definition.product.petId), money: money - cost, tokens, purchased, replayed: false};
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
