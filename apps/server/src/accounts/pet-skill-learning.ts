import type {DatabaseSync} from 'node:sqlite';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {quotePetSkillLearning} from '../../../shared/combat/pet-learning';
import type {ReqPetSkillLearning, ResPetSkillLearning} from '../../../shared/protocols/PtlPetSkillLearning';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';

/** Rebuilt atomic authority uses original next-level cost and confirmation fields. */
export class AccountPetSkillLearning {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS pet_skill_learning (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
      slot INTEGER NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqPetSkillLearning, catalog: CombatCatalog): ResPetSkillLearning {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const prices = new Map((catalog.petSkillPrices ?? []).map(row => [row.skillId, row]));
    const response = (learned?: ResPetSkillLearning['learned'], replayed?: boolean,
        confirmation?: ResPetSkillLearning['confirmation']): ResPetSkillLearning => {
      const owned: ResPetSkillLearning['owned'] = {base: [], equipment: []};
      for (const row of this.database.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(accountId)) {
        owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)) as OwnedRoleRecordData);
      }
      const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
      if (!saved) return {owned, quotes: [], learned, replayed, confirmation};
      const bytes = new Uint8Array(saved.payload as Uint8Array);
      const growth = this.database.prepare('SELECT skill_points FROM account_growth WHERE account_id = ?').get(accountId);
      const points = Number(growth?.skill_points ?? 0);
      const quotes = owned.base.flatMap(record => {
        const fields = new Map(record.fields), petId = fields.get(8);
        const metadata = catalog.petTypes?.find(row => row.petId === petId);
        const definition = metadata?.baseIds && metadata.rankCaps
          ? {petId: metadata.petId, baseIds: metadata.baseIds, rankCaps: metadata.rankCaps} : undefined;
        return Array.from({length: 6}, (_, slot) => quotePetSkillLearning({
          owned: {name: record.name, fields}, definition, prices, slot, points,
        })).flatMap(quote => quote ? [quote] : []);
      });
      return {owned, points, quotes, profile: {bytes: [...bytes],
        strings: JSON.parse(String(saved.strings)) as [string, string]}, learned, replayed, confirmation};
    };
    if (request.operation === 'QUERY') return response();
    if (request.operation === 'CONFIRM') {
      if (!Number.isInteger(request.instanceId) || request.instanceId! < 0
          || request.instanceId! > 0xffffffff || !Number.isInteger(request.slot)
          || request.slot! < 0 || request.slot! >= 6) {
        throw new Error('宠物技能学习确认请求无效');
      }
      if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) {
        throw new Error('学习请求ID无效');
      }
      const previous = this.database.prepare(
        'SELECT instance_id, slot, receipt FROM pet_skill_learning WHERE account_id = ? AND request_id = ?',
      ).get(accountId, request.requestId);
      if (!previous) return response(undefined, undefined, 'ABSENT');
      if (Number(previous.instance_id) !== request.instanceId || Number(previous.slot) !== request.slot) {
        throw new Error('学习请求ID已用于不同技能');
      }
      const learned = JSON.parse(String(previous.receipt)) as ResPetSkillLearning['learned'];
      return response(learned, true, 'APPLIED');
    }
    if (request.operation !== 'LEARN' || !Number.isInteger(request.instanceId) || request.instanceId! < 0
        || request.instanceId! > 0xffffffff || !Number.isInteger(request.slot) || request.slot! < 0 || request.slot! >= 6) {
      throw new Error('宠物技能学习请求无效');
    }
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('学习请求ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT instance_id, slot, receipt FROM pet_skill_learning WHERE account_id = ? AND request_id = ?')
        .get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.instance_id) !== request.instanceId || Number(previous.slot) !== request.slot) throw new Error('学习请求ID已用于不同技能');
        const result = response(JSON.parse(String(previous.receipt)) as ResPetSkillLearning['learned'], true);
        this.database.exec('COMMIT');
        return result;
      }
      const current = response();
      if (!current.profile || current.points === undefined) throw new Error('账户角色资料尚未建立');
      const record = current.owned.base.find(row => new Map(row.fields).get(0) === request.instanceId);
      if (!record) throw new Error('该宠物实例不属于当前账户');
      const quote = current.quotes.find(row => row.instanceId === request.instanceId && row.slot === request.slot);
      const fields = new Map(record.fields);
      const cap = catalog.petTypes?.find(row => row.petId === fields.get(8))?.rankCaps?.[request.slot!];
      if (quote?.kind === 'rankLimit' || (cap !== undefined && fields.get(0x5c + request.slot! * 4)! >= cap)) throw new Error('技能等级已达上限');
      if (quote?.kind === 'insufficientPoints') throw new Error('技能点不足');
      if (!quote || quote.kind !== 'eligible') throw new Error('宠物技能费用未载入');
      fields.set(0x5c + request.slot! * 4, quote.nextRank);
      this.database.prepare('UPDATE role_records SET record = ? WHERE account_id = ? AND kind = ? AND instance_id = ?')
        .run(JSON.stringify({name: record.name, fields: [...fields]}), accountId, 'base', request.instanceId!);
      this.database.prepare('UPDATE account_growth SET skill_points = ? WHERE account_id = ?')
        .run(quote.remainingPoints, accountId);
      const learned = {instanceId: request.instanceId!, slot: request.slot!, skillId: quote.nextSkillId, rank: quote.nextRank, cost: quote.cost};
      this.database.prepare('INSERT INTO pet_skill_learning VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, request.instanceId!, request.slot!, JSON.stringify(learned));
      const result = response(learned, false);
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
