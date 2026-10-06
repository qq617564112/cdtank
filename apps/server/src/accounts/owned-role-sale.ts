import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../shared/protocols/PtlOwnedRoleSale';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';

/** Web atomic sale preserves the original selected-role gate and signed Money/2 price. */
export class AccountOwnedRoleSale {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS owned_role_sales (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, kind TEXT NOT NULL,
      instance_id INTEGER NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqOwnedRoleSale, catalog: CombatCatalog): ResOwnedRoleSale {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const response = (sold?: ResOwnedRoleSale['sold'], replayed?: boolean): ResOwnedRoleSale => {
      const owned: ResOwnedRoleSale['owned'] = {base: [], equipment: []};
      for (const row of this.database.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(accountId)) {
        owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)) as OwnedRoleRecordData);
      }
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!saved) return {owned, quotes: []};
      const bytes = new Uint8Array(saved.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), money = view.getUint32(0x70, true);
      const quotes: ResOwnedRoleSale['quotes'] = [];
      for (const kind of ['pet', 'tank'] as const) {
        for (const record of owned[kind === 'pet' ? 'base' : 'equipment']) {
          const fields = new Map(record.fields), instanceId = fields.get(kind === 'pet' ? 0 : 0x1c);
          const definitionId = fields.get(kind === 'pet' ? 8 : 0x24);
          const sourceMoney = kind === 'pet' ? catalog.petTypes?.find(row => row.petId === definitionId)?.petMoney
            : catalog.tankTypes?.find(row => row.tankId === definitionId)?.tankMoney;
          if (instanceId === undefined || definitionId === undefined || sourceMoney === undefined) continue;
          const price = Math.trunc((sourceMoney | 0) / 2);
          if (price < 0) continue;
          const selected = view.getUint32(kind === 'pet' ? 0xa4 : 0xa8, true) === instanceId;
          quotes.push({kind, instanceId, definitionId, price, selected, canSell: !selected && money + price <= 999999999});
        }
      }
      return {owned, money, quotes, profile: {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]}, sold, replayed};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation !== 'SELL' || !['pet', 'tank'].includes(request.kind ?? '')
        || !Number.isInteger(request.instanceId) || request.instanceId! < 0 || request.instanceId! > 0xffffffff) throw new Error('出售实例无效');
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('出售请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT kind, instance_id, receipt FROM owned_role_sales WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (previous.kind !== request.kind || Number(previous.instance_id) !== request.instanceId) throw new Error('出售请求ID已用于不同实例');
        const result = response(JSON.parse(String(previous.receipt)) as ResOwnedRoleSale['sold'], true);
        this.database.exec('COMMIT'); return result;
      }
      const current = response();
      if (!current.profile || current.money === undefined) throw new Error('账户角色资料尚未建立');
      const record = current.owned[request.kind === 'pet' ? 'base' : 'equipment']
        .find(row => new Map(row.fields).get(request.kind === 'pet' ? 0 : 0x1c) === request.instanceId);
      if (!record) throw new Error('该出售实例不属于当前账户');
      const view = new DataView(Uint8Array.from(current.profile.bytes).buffer);
      if (view.getUint32(request.kind === 'pet' ? 0xa4 : 0xa8, true) === request.instanceId) throw new Error('不能出售出击中的角色');
      const quote = current.quotes.find(row => row.kind === request.kind && row.instanceId === request.instanceId);
      if (!quote) throw new Error('原出售价格未载入');
      if (current.money + quote.price > 999999999) throw new Error('出售后金钱超出上限');
      view.setUint32(0x70, current.money + quote.price, true);
      this.database.prepare('DELETE FROM role_records WHERE account_id = ? AND kind = ? AND instance_id = ?')
        .run(accountId, request.kind === 'pet' ? 'base' : 'equipment', request.instanceId!);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(new Uint8Array(view.buffer), accountId);
      const sold = {kind: request.kind!, instanceId: request.instanceId!, price: quote.price, result: 2 as const};
      this.database.prepare('INSERT INTO owned_role_sales VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, request.kind!, request.instanceId!, JSON.stringify(sold));
      const result = response(sold, false);
      this.database.exec('COMMIT'); return result;
    } catch (error) {this.database.exec('ROLLBACK'); throw error;}
  }
}
