import {randomInt} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {DatabaseSync} from 'node:sqlite';
import type {
  ReqTankUpgrade,
  ResTankUpgrade,
  TankUpgradeConfirmation,
  TankUpgradeQuote,
} from '../../../shared/protocols/PtlTankUpgrade';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
import {sourceTablePath} from '../runtime/content-paths';
import {initializeAccountSpending, recordAccountSpending} from './spending';

type UpgradeAction = 1 | 2;

interface SourceTable {
  rows: {values: Record<string, string>}[];
}

interface TankUpgradeTarget {
  money: number;
  originality: number;
  fail: number;
  success: number;
}

interface TankUpgradeDefinition {
  money: number;
  minAttack: number;
  maxAttack: number;
  minAttackBonus: number;
  maxAttackBonus: number;
  minDefense: number;
  maxDefense: number;
  minDefenseBonus: number;
  maxDefenseBonus: number;
}

interface TankUpgradeTables {
  targets: Map<number, TankUpgradeTarget>;
  tanks: Map<number, TankUpgradeDefinition>;
}

const LEVEL_OFFSET: Record<UpgradeAction, number> = {1: 0x44, 2: 0x54};
const ENABLED_OFFSET: Record<UpgradeAction, number> = {1: 0x38, 2: 0x48};
const ATTRIBUTE_OFFSET: Record<UpgradeAction, number> = {1: 0x3c, 2: 0x4c};
const BONUS_OFFSET: Record<UpgradeAction, number> = {1: 0x40, 2: 0x50};
const MONEY_OFFSET = 0x70;
const ORIGINALITY_OFFSET = 0x9c;

export type TankUpgradeErrorCode =
  | 'UPGRADE_TARGET_UNAVAILABLE'
  | 'UPGRADE_MONEY_REQUIRED'
  | 'UPGRADE_ORIGINALITY_REQUIRED'
  | 'UPGRADE_DISABLED'
  | 'UPGRADE_REQUEST_CONFLICT'
  | 'UPGRADE_REJECTED';

export class TankUpgradeError extends Error {
  constructor(message: string, readonly code: TankUpgradeErrorCode) {
    super(message);
    this.name = 'TankUpgradeError';
  }
}

function sourceNumber(values: Record<string, string>, key: string): number {
  const value = Number(values[key]);
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`源表字段 ${key} 无效`);
  }
  return value;
}

function readTables(): TankUpgradeTables {
  const targets = new Map<number, TankUpgradeTarget>();
  const tankUp = JSON.parse(readFileSync(sourceTablePath('tankup'), 'utf8')) as SourceTable;
  for (const row of tankUp.rows) {
    const level = sourceNumber(row.values, '等級');
    if (level < 1 || level > 25 || targets.has(level)) throw new Error('TankUp 表等级无效');
    targets.set(level, {
      money: sourceNumber(row.values, '花費金錢'),
      originality: sourceNumber(row.values, '花費創意點數'),
      fail: sourceNumber(row.values, '失敗率'),
      success: sourceNumber(row.values, '成功率'),
    });
  }
  if (targets.size !== 25) throw new Error('TankUp 表不完整');

  const tanks = new Map<number, TankUpgradeDefinition>();
  const tank = JSON.parse(readFileSync(sourceTablePath('tank'), 'utf8')) as SourceTable;
  for (const row of tank.rows) {
    const id = sourceNumber(row.values, 'ID');
    tanks.set(id, {
      money: sourceNumber(row.values, 'TankMoney'),
      minAttack: sourceNumber(row.values, 'MinAtkUp'),
      maxAttack: sourceNumber(row.values, 'MaxAtkUp'),
      minAttackBonus: sourceNumber(row.values, 'MinAtkBonusUp'),
      maxAttackBonus: sourceNumber(row.values, 'MaxAtkBonusUp'),
      minDefense: sourceNumber(row.values, 'MinDefUp'),
      maxDefense: sourceNumber(row.values, 'MaxDefUp'),
      minDefenseBonus: sourceNumber(row.values, 'MinDefBonusUp'),
      maxDefenseBonus: sourceNumber(row.values, 'MaxDefBonusUp'),
    });
  }
  return {targets, tanks};
}

function clampUint16(value: number): number {
  return Math.max(0, Math.min(0xffff, value));
}

function uniformInclusive(min: number, max: number): number {
  return min === max ? min : randomInt(min, max + 1);
}

/** Rebuilt account settlement for the frozen TankUpgrade adoption contract. */
export class AccountTankUpgrade {
  private tables?: TankUpgradeTables;

  constructor(private readonly database: DatabaseSync) {
    initializeAccountSpending(database);
    database.exec(`CREATE TABLE IF NOT EXISTS tank_upgrade_receipts (
      account_id TEXT NOT NULL, request_id TEXT NOT NULL, action INTEGER NOT NULL,
      instance_id INTEGER NOT NULL, receipt TEXT NOT NULL,
      PRIMARY KEY(account_id, request_id));`);
  }

  request(accountId: string, request: ReqTankUpgrade): ResTankUpgrade {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) {
      throw new TankUpgradeError('账户不存在', 'UPGRADE_REJECTED');
    }
    if (request.operation === 'QUERY') return this.state(accountId);
    if (request.operation !== 'UPGRADE') {
      throw new TankUpgradeError('战车改装操作无效', 'UPGRADE_REJECTED');
    }
    if (!Number.isInteger(request.instanceId) || request.instanceId! < 0 || request.instanceId! > 0xffffffff) {
      throw new TankUpgradeError('战车改装实例无效', 'UPGRADE_REJECTED');
    }
    if (request.action !== 1 && request.action !== 2) {
      throw new TankUpgradeError('战车改装动作无效', 'UPGRADE_REJECTED');
    }
    if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(request.requestId)) {
      throw new TankUpgradeError('改装请求ID无效', 'UPGRADE_REJECTED');
    }

    const action = request.action;
    const instanceId = request.instanceId!;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare(
        'SELECT action, instance_id, receipt FROM tank_upgrade_receipts WHERE account_id = ? AND request_id = ?',
      ).get(accountId, request.requestId);
      if (previous) {
        if (Number(previous.action) !== action || Number(previous.instance_id) !== instanceId) {
          throw new TankUpgradeError('改装请求ID已用于不同改装', 'UPGRADE_REQUEST_CONFLICT');
        }
        const historicalConfirmation = JSON.parse(String(previous.receipt)) as TankUpgradeConfirmation;
        const result = this.state(accountId, undefined, historicalConfirmation, true);
        this.database.exec('COMMIT');
        return result;
      }

      const current = this.state(accountId);
      if (!current.profile) throw new TankUpgradeError('账户角色资料尚未建立', 'UPGRADE_REJECTED');
      const record = current.owned.equipment.find(value =>
        new Map(value.fields).get(0x1c) === instanceId);
      if (!record) throw new TankUpgradeError('该战车实例不属于当前账户', 'UPGRADE_REJECTED');
      const fields = new Map(record.fields);
      if ((fields.get(ENABLED_OFFSET[action]) ?? 0) === 0) {
        throw new TankUpgradeError('战车改装资格未启用', 'UPGRADE_DISABLED');
      }
      const currentLevel = fields.get(LEVEL_OFFSET[action]) ?? 0;
      if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= 24) {
        throw new TankUpgradeError('战车改装目标不可用', 'UPGRADE_TARGET_UNAVAILABLE');
      }
      const tables = this.sourceTables();
      const target = tables.targets.get(currentLevel + 1);
      const definition = tables.tanks.get(fields.get(0x24) ?? -1);
      if (!target || !definition || currentLevel + 1 > 24) {
        throw new TankUpgradeError('战车改装目标不可用', 'UPGRADE_TARGET_UNAVAILABLE');
      }

      const moneyCost = Math.floor((Math.imul(definition.money, target.money) >>> 0) / 100);
      const originalityCost = target.originality;
      if (!Number.isSafeInteger(moneyCost) || moneyCost < 0 || moneyCost > 0xffffffff
          || !Number.isSafeInteger(originalityCost) || originalityCost < 0 || originalityCost > 0xffff) {
        throw new TankUpgradeError('战车改装费用无效', 'UPGRADE_REJECTED');
      }
      if (current.money! < moneyCost) {
        throw new TankUpgradeError('金钱余额不足', 'UPGRADE_MONEY_REQUIRED');
      }
      if (current.originality! < originalityCost) {
        throw new TankUpgradeError('创意点余额不足', 'UPGRADE_ORIGINALITY_REQUIRED');
      }
      if (current.originality! - originalityCost > 0xffff) {
        throw new TankUpgradeError('创意点余额超出16位范围', 'UPGRADE_REJECTED');
      }

      const roll = randomInt(100);
      const result: 0 | 1 | 2 = roll < target.success ? 0
        : roll < target.success + target.fail ? 2 : 1;
      const currentAttribute = fields.get(ATTRIBUTE_OFFSET[action]) ?? 0;
      const currentBonus = fields.get(BONUS_OFFSET[action]) ?? 0;
      const ranges = action === 1
        ? [definition.minAttack, definition.maxAttack, definition.minAttackBonus, definition.maxAttackBonus]
        : [definition.minDefense, definition.maxDefense, definition.minDefenseBonus, definition.maxDefenseBonus];
      const [minAttribute, maxAttribute, minBonus, maxBonus] = ranges;
      const attributeDelta = uniformInclusive(Math.min(minAttribute, maxAttribute), Math.max(minAttribute, maxAttribute));
      const bonusDelta = uniformInclusive(Math.min(minBonus, maxBonus), Math.max(minBonus, maxBonus));
      const level = result === 0 ? currentLevel + 1 : result === 2 ? Math.max(0, currentLevel - 1) : currentLevel;
      const attribute = result === 0 ? clampUint16(currentAttribute + attributeDelta)
        : result === 2 ? clampUint16(currentAttribute - attributeDelta) : clampUint16(currentAttribute);
      const bonus = result === 0 ? clampUint16(currentBonus + bonusDelta)
        : result === 2 ? clampUint16(currentBonus - bonusDelta) : clampUint16(currentBonus);
      const confirmation: TankUpgradeConfirmation = {
        action,
        instanceId,
        money: current.money! - moneyCost,
        originality: current.originality! - originalityCost,
        attribute,
        bonus,
        result,
        level,
      };

      fields.set(LEVEL_OFFSET[action], level);
      fields.set(ATTRIBUTE_OFFSET[action], attribute);
      fields.set(BONUS_OFFSET[action], bonus);
      this.database.prepare(
        'UPDATE role_records SET record = ? WHERE account_id = ? AND kind = ? AND instance_id = ?',
      ).run(JSON.stringify({name: record.name, fields: [...fields]}), accountId, 'equipment', instanceId);

      const profile = this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?')
        .get(accountId);
      if (!profile) throw new TankUpgradeError('账户角色资料尚未建立', 'UPGRADE_REJECTED');
      const bytes = new Uint8Array(profile.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      view.setUint32(MONEY_OFFSET, confirmation.money, true);
      view.setUint32(ORIGINALITY_OFFSET, confirmation.originality, true);
      this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);

      this.database.prepare('INSERT INTO tank_upgrade_receipts VALUES (?, ?, ?, ?, ?)')
        .run(accountId, request.requestId, action, instanceId, JSON.stringify(confirmation));
      recordAccountSpending(this.database, accountId, 'tank-upgrade', request.requestId, moneyCost, 0);
      const response = this.state(accountId, confirmation);
      this.database.exec('COMMIT');
      return response;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private sourceTables(): TankUpgradeTables {
    return this.tables ??= readTables();
  }

  private state(accountId: string, confirmation?: TankUpgradeConfirmation,
      historicalConfirmation?: TankUpgradeConfirmation, replayed?: boolean): ResTankUpgrade {
    const owned: ResTankUpgrade['owned'] = {base: [], equipment: []};
    for (const row of this.database.prepare(
      'SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id',
    ).all(accountId)) {
      const record = JSON.parse(String(row.record)) as OwnedRoleRecordData;
      if (row.kind === 'base') owned.base.push(record);
      else if (row.kind === 'equipment') owned.equipment.push(record);
    }
    const saved = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?')
      .get(accountId);
    let money = 0;
    let originality = 0;
    const result: ResTankUpgrade = {owned, quotes: []};
    if (saved) {
      const bytes = new Uint8Array(saved.payload as Uint8Array);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      money = view.getUint32(MONEY_OFFSET, true);
      originality = view.getUint32(ORIGINALITY_OFFSET, true);
      result.profile = {bytes: [...bytes], strings: JSON.parse(String(saved.strings)) as [string, string]};
    }
    result.quotes = this.quotes(owned.equipment, money, originality);
    if (confirmation) result.confirmation = confirmation;
    if (historicalConfirmation) result.historicalConfirmation = historicalConfirmation;
    if (replayed !== undefined) result.replayed = replayed;
    return result;
  }

  private quotes(equipment: readonly OwnedRoleRecordData[], money: number,
      originality: number): TankUpgradeQuote[] {
    const tables = this.sourceTables();
    const quotes: TankUpgradeQuote[] = [];
    for (const record of equipment) {
      const fields = new Map(record.fields);
      const instanceId = fields.get(0x1c);
      const tankId = fields.get(0x24);
      if (!Number.isInteger(instanceId) || instanceId! < 0 || instanceId! > 0xffffffff
          || !Number.isInteger(tankId) || tankId! < 0 || tankId! > 0xffffffff) continue;
      for (const action of [1, 2] as const) {
        quotes.push(this.quote(instanceId!, action, fields, tankId!, money, originality, tables));
      }
    }
    return quotes;
  }

  private quote(instanceId: number, action: UpgradeAction, fields: ReadonlyMap<number, number>,
      tankId: number, money: number, originality: number, tables: TankUpgradeTables): TankUpgradeQuote {
    const currentLevel = fields.get(LEVEL_OFFSET[action]) ?? 0;
    const currentAttribute = fields.get(ATTRIBUTE_OFFSET[action]) ?? 0;
    const currentBonus = fields.get(BONUS_OFFSET[action]) ?? 0;
    const enabled = (fields.get(ENABLED_OFFSET[action]) ?? 0) !== 0;
    const nextLevel = currentLevel + 1;
    const target = tables.targets.get(nextLevel);
    const tank = tables.tanks.get(tankId);
    if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= 24 || !target || !tank) {
      return {
        instanceId,
        action,
        currentLevel,
        nextLevel,
        nextAttributeMin: clampUint16(currentAttribute),
        nextAttributeMax: clampUint16(currentAttribute),
        nextBonusMin: clampUint16(currentBonus),
        nextBonusMax: clampUint16(currentBonus),
        enabled,
        moneyCost: 0,
        originalityCost: 0,
        success: 0,
        fail: 0,
        noEffect: 100,
        canUpgrade: false,
        reason: 'UPGRADE_TARGET_UNAVAILABLE',
      };
    }
    const moneyCost = Math.floor((Math.imul(tank.money, target.money) >>> 0) / 100);
    const originalityCost = target.originality;
    const reason: TankUpgradeQuote['reason'] = money < moneyCost ? 'UPGRADE_MONEY_REQUIRED'
      : originality < originalityCost ? 'UPGRADE_ORIGINALITY_REQUIRED'
        : !enabled ? 'UPGRADE_DISABLED' : undefined;
    const minimum = action === 1
      ? [tank.minAttack, tank.minAttackBonus] : [tank.minDefense, tank.minDefenseBonus];
    const maximum = action === 1
      ? [tank.maxAttack, tank.maxAttackBonus] : [tank.maxDefense, tank.maxDefenseBonus];
    return {
      instanceId,
      action,
      currentLevel,
      nextLevel,
      nextAttributeMin: clampUint16(currentAttribute + Math.min(minimum[0], maximum[0])),
      nextAttributeMax: clampUint16(currentAttribute + Math.max(minimum[0], maximum[0])),
      nextBonusMin: clampUint16(currentBonus + Math.min(minimum[1], maximum[1])),
      nextBonusMax: clampUint16(currentBonus + Math.max(minimum[1], maximum[1])),
      enabled,
      moneyCost,
      originalityCost,
      success: target.success,
      fail: target.fail,
      noEffect: Math.max(0, 100 - target.success - target.fail),
      canUpgrade: reason === undefined,
      ...(reason === undefined ? {} : {reason}),
    };
  }
}
