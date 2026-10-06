import type {DatabaseSync} from 'node:sqlite';
import {isDeepStrictEqual} from 'node:util';
import {classifyInventoryCategory} from '../../../shared/combat/inventory-query';
import type {TradeAccount, TradeOffer, TradeRecordView} from '../../../shared/protocols/PtlTrade';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';

export interface PreparedTradeOffer {offer: TradeOffer; records: TradeRecordView[];}

/** Web settlement authority preserves the recovered full-record and scalar transfer contracts. */
export class AccountTrade {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS trade_receipts (
      session_id TEXT PRIMARY KEY, account_a TEXT NOT NULL, account_b TEXT NOT NULL,
      offers TEXT NOT NULL, receipt TEXT NOT NULL);`);
  }

  account(accountId: string): TradeAccount {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const owned: TradeAccount['owned'] = {base: [], equipment: []};
    for (const row of this.database.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(accountId)) {
      owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)) as OwnedRoleRecordData);
    }
    const records = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id').all(accountId)
      .map(row => JSON.parse(String(row.record)) as InventoryWireRecord);
    const hotkeys = Array<number>(7).fill(0);
    for (const row of this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId)) hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
    const result: TradeAccount = {accountId, owned, inventory: {records, hotkeys}};
    const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
    if (saved) {
      const bytes = new Uint8Array(saved.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      result.wallet = {money: view.getUint32(0x70, true), originality: view.getUint32(0x7c, true), skillPoints: view.getUint32(0x80, true)};
      result.profile = {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]};
    }
    return result;
  }

  prepare(accountId: string, offered: TradeOffer): PreparedTradeOffer {
    const current = this.account(accountId);
    if (!current.wallet) throw new Error('账户角色资料尚未建立');
    for (const key of ['money', 'originality', 'skillPoints'] as const) {
      const value = offered[key], maximum = key === 'money' ? 0xffffffff : 0xffff;
      if (!Number.isInteger(value) || value < 0 || value > maximum) throw new Error('交易金额无效');
      if (value > current.wallet[key]) throw new Error('交易余额不足');
    }
    if (!Array.isArray(offered.records) || offered.records.length > 12) throw new Error('交易提供物最多12项');
    const seen = new Set<string>();
    const records = offered.records.map(ref => {
      if (!['pet', 'tank', 'item'].includes(ref.kind) || !Number.isInteger(ref.instanceId) || ref.instanceId <= 0 || ref.instanceId > 0xffffffff) throw new Error('交易实例无效');
      const key = `${ref.kind}/${ref.instanceId}`;
      if (seen.has(key)) throw new Error('同一实例不能重复提供');
      seen.add(key);
      if (ref.kind !== 'item') {
        const role = current.owned[ref.kind === 'pet' ? 'base' : 'equipment']
          .find(row => new Map(row.fields).get(ref.kind === 'pet' ? 0 : 0x1c) === ref.instanceId);
        if (!role) throw new Error('该交易实例不属于当前账户');
        if (ref.quantity !== undefined && ref.quantity !== 1) throw new Error('角色必须整实例交易');
        return {kind: ref.kind, instanceId: ref.instanceId, quantity: 1, role};
      }
      const item = current.inventory.records.find(row => row.instanceId === ref.instanceId);
      const category = item && classifyInventoryCategory(item.itemTableId);
      if (!item || !category) throw new Error('该交易物品不属于当前账户或没有原类别');
      const quantity = ref.quantity ?? (category <= 2 ? item.ownedQuantity : 1);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 0xffffff
          || (category <= 2 ? quantity > item.ownedQuantity : quantity !== 1)) throw new Error('交易物品数量无效');
      return {kind: ref.kind, instanceId: ref.instanceId, quantity, item};
    });
    return {offer: {money: offered.money, originality: offered.originality, skillPoints: offered.skillPoints,
      records: records.map(({kind, instanceId, quantity}) => ({kind, instanceId, quantity}))}, records};
  }

  settle(sessionId: string, accountIds: [string, string], prepared: [PreparedTradeOffer, PreparedTradeOffer]): void {
    if (accountIds[0] === accountIds[1]) throw new Error('不能与自己交易');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT account_a, account_b, offers FROM trade_receipts WHERE session_id = ?').get(sessionId);
      if (previous) {
        if (previous.account_a !== accountIds[0] || previous.account_b !== accountIds[1]
            || !isDeepStrictEqual(JSON.parse(String(previous.offers)), prepared)) throw new Error('交易确认已用于不同内容');
        this.database.exec('COMMIT'); return;
      }
      const current = accountIds.map(id => this.account(id));
      for (let index = 0; index < 2; index++) {
        if (!isDeepStrictEqual(this.prepare(accountIds[index], prepared[index].offer), prepared[index])) throw new Error('拥有资料已改变，请重新展示交易');
      }
      const profiles = current.map(account => Uint8Array.from(account.profile!.bytes));
      for (let index = 0; index < 2; index++) {
        const view = new DataView(profiles[index].buffer), wallet = current[index].wallet!;
        for (const [key, offset] of [['money', 0x70], ['originality', 0x7c], ['skillPoints', 0x80]] as const) {
          const balance = wallet[key] - prepared[index].offer[key] + prepared[1 - index].offer[key];
          if (balance < 0 || balance > 0xffffffff) throw new Error('交易余额超出范围');
          view.setUint32(offset, balance, true);
        }
      }
      // Remove both sides first. Receiving accounts allocate independent local instance IDs.
      for (let index = 0; index < 2; index++) {
        const id = accountIds[index], view = new DataView(profiles[index].buffer);
        for (const record of prepared[index].records) {
          if (record.role) {
            this.database.prepare('DELETE FROM role_records WHERE account_id = ? AND kind = ? AND instance_id = ?')
              .run(id, record.kind === 'pet' ? 'base' : 'equipment', record.instanceId);
            const offset = record.kind === 'pet' ? 0xa4 : 0xa8;
            if (view.getUint32(offset, true) === record.instanceId) view.setUint32(offset, 0, true);
          } else {
            const item = record.item!, stack = classifyInventoryCategory(item.itemTableId) <= 2;
            if (stack && item.ownedQuantity > record.quantity!) {
              this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
                .run(JSON.stringify({...item, ownedQuantity: item.ownedQuantity - record.quantity!}), id, record.instanceId);
            } else {
              this.database.prepare('DELETE FROM inventory WHERE account_id = ? AND instance_id = ?').run(id, record.instanceId);
              this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND instance_id = ?').run(id, record.instanceId);
              for (const offset of [0x118, 0x13c, 0x140, 0x144, 0x148, 0x14c, 0x150, 0x154, 0x158]) {
                if (view.getUint32(offset, true) === record.instanceId) view.setUint32(offset, 0, true);
              }
            }
          }
        }
      }
      const received: {accountId: string; kind: string; fromInstanceId: number; instanceId: number}[] = [];
      for (let index = 0; index < 2; index++) {
        const recipient = accountIds[1 - index];
        for (const record of prepared[index].records) {
          if (record.item && classifyInventoryCategory(record.item.itemTableId) <= 2) {
            const existing = this.account(recipient).inventory.records.find(item => item.itemTableId === record.item!.itemTableId);
            if (existing) {
              const ownedQuantity = existing.ownedQuantity + record.quantity!;
              if (ownedQuantity > 0xffffff) throw new Error('交易物品数量超出范围');
              this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
                .run(JSON.stringify({...existing, ownedQuantity}), recipient, existing.instanceId);
              received.push({accountId: recipient, kind: record.kind, fromInstanceId: record.instanceId, instanceId: existing.instanceId});
              continue;
            }
          }
          let instanceId = 1;
          for (const row of this.database.prepare('SELECT instance_id FROM inventory WHERE account_id = ? UNION SELECT instance_id FROM role_records WHERE account_id = ? ORDER BY instance_id').all(recipient, recipient)) {
            if (Number(row.instance_id) === instanceId) instanceId++;
            else if (Number(row.instance_id) > instanceId) break;
          }
          if (instanceId > 0xffffffff) throw new Error('账户物品实例ID已用尽');
          if (record.role) {
            const fields = new Map(record.role.fields); fields.set(record.kind === 'pet' ? 0 : 0x1c, instanceId);
            this.database.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(recipient,
              record.kind === 'pet' ? 'base' : 'equipment', instanceId, JSON.stringify({name: record.role.name, fields: [...fields]}));
          } else {
            const item = record.item!, stack = classifyInventoryCategory(item.itemTableId) <= 2;
            this.database.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(recipient, instanceId,
              JSON.stringify({...item, instanceId, state: 0, battleQuantity: 0, ownedQuantity: stack ? record.quantity! : item.ownedQuantity}));
          }
          received.push({accountId: recipient, kind: record.kind, fromInstanceId: record.instanceId, instanceId});
        }
      }
      for (let index = 0; index < 2; index++) this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(profiles[index], accountIds[index]);
      this.database.prepare('INSERT INTO trade_receipts VALUES (?, ?, ?, ?, ?)').run(sessionId, ...accountIds, JSON.stringify(prepared), JSON.stringify(received));
      this.database.exec('COMMIT');
    } catch (error) {this.database.exec('ROLLBACK'); throw error;}
  }
}
