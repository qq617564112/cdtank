import {AccountStackItemSale} from './accounts/stack-item-sale';
import {AccountCredentials} from './accounts/credentials';
import type {ReqAccount, ResAccount} from '../../shared/protocols/PtlAccount';
import type {ReqStackItemSale, ResStackItemSale} from '../../shared/protocols/PtlStackItemSale';
import {AccountPartSale} from './accounts/part-sale';
import type {ReqPartSale, ResPartSale} from '../../shared/protocols/PtlPartSale';
import {AccountPartMaintenance} from './accounts/part-maintenance';
import type {ReqPartMaintenance, ResPartMaintenance} from '../../shared/protocols/PtlPartMaintenance';
import {AccountTrade, type PreparedTradeOffer} from './accounts/trade';
import {AccountOwnedRoleSale} from './accounts/owned-role-sale';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../shared/protocols/PtlOwnedRoleSale';
import type {TradeAccount, TradeOffer} from '../../shared/protocols/PtlTrade';
import {DatabaseSync} from 'node:sqlite';
import {AccountHistory} from './accounts/history';
import {AccountShop} from './accounts/shop';
import {AccountTankShop} from './accounts/tank-shop';
import {AccountTankMaintenance} from './accounts/tank-maintenance';
import type {ReqTankMaintenance, ResTankMaintenance} from '../../shared/protocols/PtlTankMaintenance';
import {AccountPetSkillLearning} from './accounts/pet-skill-learning';
import type {ReqPetSkillLearning, ResPetSkillLearning} from '../../shared/protocols/PtlPetSkillLearning';
import {AccountPetShop} from './accounts/pet-shop';
import type {ReqPetShop, ResPetShop} from '../../shared/protocols/PtlPetShop';
import type {ReqTankShop, ResTankShop} from '../../shared/protocols/PtlTankShop';
import {AccountDisplayName} from './accounts/display-name';
import {AccountFriends} from './accounts/social/friends';
import {AccountBlacklist} from './accounts/social/blacklist';
import type {ReqBlacklist} from '../../shared/protocols/PtlBlacklist';
import type {ReqFriends} from '../../shared/protocols/PtlFriends';
import type {ReqShop, ResShop, ShopItem} from '../../shared/protocols/PtlShop';
import type {HistoryMatch, HistoryParticipant} from './accounts/history';
import type {RewardGrant} from './accounts/history';
import {AccountReward} from './accounts/reward';
import type {AccountGrowth, ResultAward, ResultPlayer} from '../../shared/protocols/MsgRoomSnapshot';
import type {ResHistory} from '../../shared/protocols/PtlHistory';
import {randomBytes} from 'node:crypto';
import type {InventoryWireRecord} from '../../shared/protocols/PtlInventory';
import type {KitbagAssignmentResult, KitbagCancellationResult} from './accounts/kitbag-configuration';
import {applyInventoryQuery} from '../../shared/combat/inventory-query';
import {requestKitbagAssignment, requestKitbagCancellation} from './accounts/kitbag-configuration';
import type {OwnedRoleBaseRecord} from '../../shared/contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../../shared/contracts/owned-equipment';
import type {RoleProfilePayload} from './accounts/profile/payload';
import type {RoleOwnedSources} from './accounts/owned/receive-pair';
import {resolveRoleRecomputeSource} from './accounts/owned/source-selection';
import {readRoleProfileSelection} from './accounts/profile/selection';
import type {CombatCatalog} from '../../shared/combat/catalog';
import {classifyItemId} from '../../shared/combat/item-hotkeys';
import {roleEquipmentSlotCount} from './accounts/equipment/slot-count';
import {requestRoleEquipment} from './accounts/equipment/request';
import {readRoleProfileEquipment, writeRoleProfileEquipment} from './accounts/profile/equipment';
import {readRoleProfileCosmetics, writeRoleProfileCosmetic} from './accounts/profile/cosmetics';
import {requestRoleEquipmentUnload} from './accounts/equipment/unload';
import type {OwnedTankTextures} from '../../shared/combat/role-owned-textures';
import {readOwnedTankTextures} from '../../shared/combat/role-owned-textures';
import type {RoleTankTextureConfirmation} from '../../shared/contracts/tank-textures';
import {applyRoleTankTextureConfirmation, evaluateRoleTankTextureRequest} from './accounts/tank-texture-change';

export interface AccountSession {accountId: string; token: string;}
export interface AccountInventory {records: InventoryWireRecord[]; hotkeys: number[];}
export interface AccountRoleRecords {
  base: Map<number, OwnedRoleBaseRecord>;
  equipment: Map<number, OwnedRoleEquipmentRecord>;
}

/** Persistent rebuilt accounts. Original server identity and acquisition rules remain separate recovery work. */
export class AccountStore {
  private readonly database: DatabaseSync;
  private readonly matchHistory: AccountHistory;
  private readonly matchReward: AccountReward;
  private readonly accountShop: AccountShop;
  private readonly accountTankShop: AccountTankShop;
  private readonly accountStackItemSale: AccountStackItemSale;
  private readonly accountPartSale: AccountPartSale;
  private readonly accountPartMaintenance: AccountPartMaintenance;
  private readonly accountTankMaintenance: AccountTankMaintenance;
  private readonly accountPetSkillLearning: AccountPetSkillLearning;
  private readonly accountTrade: AccountTrade;
  private readonly accountOwnedRoleSale: AccountOwnedRoleSale;
  private readonly accountPetShop: AccountPetShop;
  private readonly accountDisplayName: AccountDisplayName;
  private readonly accountFriends: AccountFriends;
  private readonly accountBlacklist: AccountBlacklist;
  private readonly credentials: AccountCredentials;
  constructor(path: string) {
    this.database = new DatabaseSync(path);
    // Append commits instead of rewriting the rollback journal during concurrent room settlements.
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS inventory (account_id TEXT NOT NULL, instance_id INTEGER NOT NULL,
        record TEXT NOT NULL, PRIMARY KEY(account_id, instance_id));
      CREATE TABLE IF NOT EXISTS hotkeys (account_id TEXT NOT NULL, slot INTEGER NOT NULL,
        instance_id INTEGER NOT NULL, PRIMARY KEY(account_id, slot));
      CREATE TABLE IF NOT EXISTS role_records (account_id TEXT NOT NULL, kind TEXT NOT NULL,
        instance_id INTEGER NOT NULL, record TEXT NOT NULL, PRIMARY KEY(account_id, kind, instance_id));
      CREATE TABLE IF NOT EXISTS role_profiles (account_id TEXT PRIMARY KEY,
        payload BLOB NOT NULL, strings TEXT NOT NULL);
    `);
    this.matchHistory = new AccountHistory(this.database);
    this.matchReward = new AccountReward(this.database);
    this.accountShop = new AccountShop(this.database);
    this.accountTankShop = new AccountTankShop(this.database);
    this.accountStackItemSale = new AccountStackItemSale(this.database);
    this.accountPartSale = new AccountPartSale(this.database);
    this.accountPartMaintenance = new AccountPartMaintenance(this.database);
    this.accountTankMaintenance = new AccountTankMaintenance(this.database);
    this.accountPetSkillLearning = new AccountPetSkillLearning(this.database);
    this.accountTrade = new AccountTrade(this.database);
    this.accountOwnedRoleSale = new AccountOwnedRoleSale(this.database);
    this.accountPetShop = new AccountPetShop(this.database);
    this.accountDisplayName = new AccountDisplayName(this.database);
    this.accountFriends = new AccountFriends(this.database);
    this.accountBlacklist = new AccountBlacklist(this.database);
    this.credentials = new AccountCredentials(this.database, token => this.open(token));
  }

  authenticate(request: ReqAccount): ResAccount {return this.credentials.authenticate(request);}

  blacklist(accountId: string, request: ReqBlacklist): string[] {
    return this.accountBlacklist.request(accountId, request);
  }

  isBlocked(ownerAccountId: string, targetAccountId: string): boolean {
    return this.accountBlacklist.isBlocked(ownerAccountId, targetAccountId);
  }

  friends(accountId: string, request: ReqFriends): string[] {
    return this.accountFriends.request(accountId, request);
  }

  displayName(accountId: string): string {
    return this.accountDisplayName.get(accountId);
  }

  setDisplayName(accountId: string, name: string): string {
    return this.accountDisplayName.set(accountId, name);
  }

  shop(accountId: string, items: readonly ShopItem[], request: ReqShop): ResShop {
    return this.accountShop.request(accountId, items, request);
  }

  tankShop(accountId: string, request: ReqTankShop): ResTankShop {
    return this.accountTankShop.request(accountId, request);
  }

  stackItemSale(accountId: string, request: ReqStackItemSale, catalog: CombatCatalog): ResStackItemSale {
    return this.accountStackItemSale.request(accountId, request, catalog);
  }

  partSale(accountId: string, request: ReqPartSale, catalog: CombatCatalog): ResPartSale {
    return this.accountPartSale.request(accountId, request, catalog);
  }

  partMaintenance(accountId: string, request: ReqPartMaintenance, catalog: CombatCatalog): ResPartMaintenance {
    return this.accountPartMaintenance.request(accountId, request, catalog);
  }

  tankMaintenance(accountId: string, request: ReqTankMaintenance, catalog: CombatCatalog): ResTankMaintenance {
    return this.accountTankMaintenance.request(accountId, request, catalog);
  }

  ownedRoleSale(accountId: string, request: ReqOwnedRoleSale, catalog: CombatCatalog): ResOwnedRoleSale {
    return this.accountOwnedRoleSale.request(accountId, request, catalog);
  }

  tradeAccount(accountId: string): TradeAccount {return this.accountTrade.account(accountId);}

  prepareTrade(accountId: string, offer: TradeOffer): PreparedTradeOffer {
    return this.accountTrade.prepare(accountId, offer);
  }

  settleTrade(sessionId: string, accountIds: [string, string], offers: [PreparedTradeOffer, PreparedTradeOffer]): void {
    this.accountTrade.settle(sessionId, accountIds, offers);
  }

  petSkillLearning(accountId: string, request: ReqPetSkillLearning, catalog: CombatCatalog): ResPetSkillLearning {
    return this.accountPetSkillLearning.request(accountId, request, catalog);
  }

  petShop(accountId: string, request: ReqPetShop): ResPetShop {
    return this.accountPetShop.request(accountId, request);
  }

  recordMatchHistory(match: HistoryMatch, participants: readonly HistoryParticipant[],
      grant?: RewardGrant): boolean {
    return this.matchHistory.record(match, participants, grant);
  }

  history(accountId: string, offset = 0, limit = 20): ResHistory {
    return this.matchHistory.query(accountId, offset, limit);
  }

  /** Apply one round's award inside the caller's existing match-history transaction. */
  grantMatchReward(accountId: string, matchId: string, round: number,
      result: Pick<ResultPlayer, 'combatScore' | 'totalScore' | 'outcome'>): ResultAward {
    return this.matchReward.apply(accountId, matchId, round, result);
  }

  /** Authoritative growth for the RoleProfile reply; independent typed columns, never raw profile. */
  accountGrowth(accountId: string): AccountGrowth {
    return this.matchReward.growth(accountId);
  }

  rewardReceipt(accountId: string, matchId: string, round: number): ResultAward | undefined {
    return this.matchReward.receipt(accountId, matchId, round);
  }

  open(token?: string): AccountSession {
    if (token !== undefined) {
      const row = this.database.prepare('SELECT id FROM accounts WHERE token = ?').get(token);
      if (!row) throw new Error('账户凭据无效');
      return {accountId: String(row.id), token};
    }
    const session = {accountId: randomBytes(16).toString('hex'), token: randomBytes(32).toString('hex')};
    this.database.prepare('INSERT INTO accounts VALUES (?, ?)').run(session.accountId, session.token);
    return session;
  }

  inventory(accountId: string): AccountInventory {
    const records = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id')
      .all(accountId).map(row => JSON.parse(String(row.record)) as InventoryWireRecord);
    const hotkeys = Array<number>(7).fill(0);
    for (const row of this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId)) {
      hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
    }
    return {records, hotkeys};
  }

  /** Rebuilt authoritative consumption; compare the battle's owned count before
   * committing. Preserve all unrelated original fields and other accounts.
   */
  consumeItem(accountId: string, instanceId: number, expectedOwned: number, itemTableId: number): boolean {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const row = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? AND instance_id = ?')
        .get(accountId, instanceId);
      const record = row ? JSON.parse(String(row.record)) as InventoryWireRecord : undefined;
      if (!record || record.ownedQuantity !== expectedOwned || record.itemTableId !== itemTableId
          || expectedOwned <= 0) {
        this.database.exec('ROLLBACK');
        return false;
      }
      record.ownedQuantity -= 1;
      this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
        .run(JSON.stringify(record), accountId, instanceId);
      this.database.exec('COMMIT');
      return true;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  roleRecords(accountId: string): AccountRoleRecords {
    const result: AccountRoleRecords = {base: new Map(), equipment: new Map()};
    for (const row of this.database.prepare(
      'SELECT kind, instance_id, record FROM role_records WHERE account_id = ? ORDER BY instance_id',
    ).all(accountId)) {
      const saved = JSON.parse(String(row.record)) as {name: string; fields: [number, number][]};
      result[row.kind as keyof AccountRoleRecords].set(Number(row.instance_id),
        {name: saved.name, fields: new Map(saved.fields)});
    }
    return result;
  }

  roleProfile(accountId: string): RoleProfilePayload | undefined {
    const row = this.database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?')
      .get(accountId);
    if (!row) return undefined;
    return {bytes: new Uint8Array(row.payload as Uint8Array),
      strings: JSON.parse(String(row.strings)) as [string, string]};
  }

  /** Original preview source lookup uses the profile's two selected owned instance IDs. */
  selectedRoleSources(accountId: string): RoleOwnedSources {
    const profile = this.roleProfile(accountId);
    if (!profile) return {base: undefined, equipment: undefined};
    const owned = this.roleRecords(accountId);
    const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
    const fields = new Map([[0x84, view.getUint32(0xa4, true)], [0x88, view.getUint32(0xa8, true)]]);
    return {
      base: resolveRoleRecomputeSource(2, undefined, readRoleProfileSelection(fields, 28),
        instance => owned.base.get(instance)),
      equipment: resolveRoleRecomputeSource(2, undefined, readRoleProfileSelection(fields, 29),
        instance => owned.equipment.get(instance)),
    };
  }

  /** Rebuilt selection authority: owned instance required; original profile selectors28/29. */
  selectRole(accountId: string, kind: 'pet' | 'tank', instanceId: number): RoleProfilePayload {
    if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId > 0xffffffff) {
      throw new Error('角色实例ID无效');
    }
    const profile = this.roleProfile(accountId);
    if (!profile) throw new Error('账户角色资料尚未建立');
    const owned = this.roleRecords(accountId);
    if (!(kind === 'pet' ? owned.base : owned.equipment).has(instanceId)) {
      throw new Error('该角色实例不属于当前账户');
    }
    const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
    view.setUint32(kind === 'pet' ? 0xa4 : 0xa8, instanceId, true);
    this.replaceRoleProfile(accountId, profile);
    return profile;
  }

  /** Rebuilt texture authority and atomic cost persistence using the recovered request and confirmation. */
  configureTankTextures(accountId: string, instanceId: number, requested: OwnedTankTextures,
      rows: readonly {recordId: number; tankId: number; part: 'U' | 'M' | 'XY';
        rarity: number; moneyPrice: number; tokenPrice: number}[]): RoleTankTextureConfirmation {
    if ([instanceId, requested.U, requested.M, requested.XY].some(id =>
      !Number.isInteger(id) || id < 0 || id > 0xffffffff)) {
      throw new Error('战车实例或迷彩ID无效');
    }
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const owned = this.roleRecords(accountId);
      const record = owned.equipment.get(instanceId);
      if (!record) throw new Error('该战车实例不属于当前账户');
      const current = readOwnedTankTextures(record);
      if (!current || record.fields.get(0x24) === undefined) throw new Error('拥有战车迷彩字段不完整');
      const profile = this.roleProfile(accountId);
      if (!profile) throw new Error('账户角色资料尚未建立');
      const prices = new Map(rows.map(row => [row.recordId, row]));
      for (const part of ['U', 'M', 'XY'] as const) {
        const id = requested[part];
        if (id === 0 || id === current[part]) continue;
        const row = prices.get(id);
        if (!row || row.tankId !== record.fields.get(0x24) || row.part !== part ||
            (row.rarity !== 1 && row.rarity !== 2)) {
          throw new Error('该迷彩不能应用到当前战车部位');
        }
      }
      const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
      const tokens = view.getUint32(0x74, true);
      const money = view.getUint32(0x70, true);
      const decision = evaluateRoleTankTextureRequest(current, requested, money, tokens, id => prices.get(id));
      if (decision.result === 1) throw new Error('代币余额不足');
      if (decision.result === 2) throw new Error('金钱余额不足');
      const confirmation: RoleTankTextureConfirmation = {
        instanceId, textures: decision.send ? {...requested} : current,
        tokens: decision.send ? (tokens - decision.tokenCost) >>> 0 : tokens,
        money: decision.send ? (money - decision.moneyCost) >>> 0 : money,
        result: decision.send ? 3 : 0,
      };
      if (decision.send) {
        const profileFields = new Map([[0x74, tokens], [0x70, money]]);
        applyRoleTankTextureConfirmation(2, owned.equipment, profileFields, confirmation);
        const confirmed = owned.equipment.get(instanceId)!;
        this.database.prepare(
          'UPDATE role_records SET record = ? WHERE account_id = ? AND kind = ? AND instance_id = ?',
        ).run(JSON.stringify({name: confirmed.name, fields: [...confirmed.fields]}), accountId, 'equipment', instanceId);
        view.setUint32(0x74, profileFields.get(0x74)!, true);
        view.setUint32(0x70, profileFields.get(0x70)!, true);
        this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?')
          .run(profile.bytes, accountId);
      }
      this.database.exec('COMMIT');
      return confirmation;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  equipment(accountId: string, catalog: CombatCatalog): {
    slots: number[]; slotCount: number; decorationInstanceId: number; markInstanceId: number; profile: RoleProfilePayload;
  } {
    const profile = this.roleProfile(accountId);
    if (!profile) throw new Error('账户角色资料尚未建立');
    const sources = this.selectedRoleSources(accountId);
    if (!sources.equipment) throw new Error('当前战车实例归属无效');
    const skills = new Map(catalog.skills.map(skill => [skill.skillId, skill]));
    const fields = sources.equipment.fields;
    const gear = sources.base?.fields;
    const slotCount = roleEquipmentSlotCount({capacity: fields.get(0x6c)!,
      parts: [0x58, 0x5c, 0x60].map(offset => fields.get(offset)!)}, gear ? {
      skillIds: Array.from({length: 6}, (_, slot) => gear.get(0x44 + slot * 4)!),
      ranks: Array.from({length: 6}, (_, slot) => gear.get(0x5c + slot * 4)!),
    } : undefined, id => {
      const skill = skills.get(id);
      return skill ? {partSlots: skill.attributes.PartSlot} : undefined;
    });
    const cosmetics = readRoleProfileCosmetics(profile);
    return {profile, slots: readRoleProfileEquipment(profile), slotCount,
      decorationInstanceId: cosmetics.skinInstanceId, markInstanceId: cosmetics.markInstanceId};
  }

  /** Rebuilt part authority using recovered request gates and the five-slot profile contract. */
  configureEquipment(accountId: string, catalog: CombatCatalog, operation: 'EQUIP' | 'UNEQUIP',
      slot: number, instanceId?: number): ReturnType<AccountStore['equipment']> {
    if (!Number.isInteger(slot) || slot < 0 || slot >= 5) throw new Error('部件槽应为0至4');
    const current = this.equipment(accountId, catalog);
    const records = this.inventory(accountId).records;
    const selected = this.selectedRoleSources(accountId).equipment!;
    const previous = [...current.slots];
    if (operation === 'EQUIP') {
      const record = records.find(item => item.instanceId === instanceId);
      if (!record || record.ownedQuantity <= 0) throw new Error('该部件不属于当前账户');
      const category = classifyItemId(record.itemTableId);
      if (category < 8 || category > 12 || !catalog.items.some(item => item.itemTableId === record.itemTableId)) {
        throw new Error('该物品不是可装备的战车部件');
      }
      requestRoleEquipment({partSlotCount: current.slotCount,
        parts: [0x58, 0x5c, 0x60].map(offset => selected.fields.get(offset)!), equipped: current.slots,
        lookupItem: id => records.find(item => item.instanceId === id)}, record, slot, () => {},
        () => {throw new Error('同类部件不能重复装备');},
        () => {throw new Error('当前战车部件槽不足');});
      for (let index = 0; index < 5; index++) {
        if (current.slots[index] === instanceId) current.slots[index] = 0;
      }
      current.slots[slot] = instanceId!;
    } else {
      const equippedId = current.slots[slot];
      if (!equippedId) throw new Error('部件槽为空');
      if (!records.some(item => item.instanceId === equippedId)) throw new Error('已装备部件归属无效');
      current.slots[slot] = 0;
    }
    writeRoleProfileEquipment(current.profile, current.slots);
    this.saveEquipment(accountId, current.profile, records, previous, current.slots);
    return current;
  }

  /** Rebuilt category5/7 authority over the recovered current-instance profile fields. */
  configureCosmetic(accountId: string, catalog: CombatCatalog, operation: 'EQUIP' | 'UNEQUIP',
      target: 'DECORATION' | 'MARK', instanceId?: number): ReturnType<AccountStore['equipment']> {
    const current = this.equipment(accountId, catalog);
    const records = this.inventory(accountId).records;
    const kind = target === 'DECORATION' ? 'skin' : 'mark';
    const previousId = kind === 'skin' ? current.decorationInstanceId : current.markInstanceId;
    const record = records.find(item => item.instanceId === (operation === 'EQUIP' ? instanceId : previousId));
    if (!record || record.ownedQuantity <= 0) throw new Error('该装备不属于当前账户');
    if (classifyItemId(record.itemTableId) !== (kind === 'skin' ? 5 : 7) ||
        !catalog.items.some(item => item.itemTableId === record.itemTableId)) {
      throw new Error('该物品不能装备到当前槽');
    }
    if (operation === 'UNEQUIP') {
      const lookup = (id: number) => records.find(item => item.instanceId === id);
      if (!requestRoleEquipmentUnload({parts: [], equipped: current.slots,
        skinInstanceId: current.decorationInstanceId, markInstanceId: current.markInstanceId,
        lookupSkin: lookup, lookupMark: lookup, lookupPart: lookup}, record, () => {})) {
        throw new Error('当前装备状态不允许卸下');
      }
    }
    const nextId = operation === 'EQUIP' ? record.instanceId : 0;
    writeRoleProfileCosmetic(current.profile, kind, nextId);
    const previous = [...current.slots, current.decorationInstanceId, current.markInstanceId];
    if (kind === 'skin') current.decorationInstanceId = nextId;
    else current.markInstanceId = nextId;
    const confirmed = [...current.slots, current.decorationInstanceId, current.markInstanceId];
    this.saveEquipment(accountId, current.profile, records, previous, confirmed);
    return current;
  }

  private saveEquipment(accountId: string, profile: RoleProfilePayload, records: InventoryWireRecord[],
      previous: readonly number[], confirmed: readonly number[]): void {
    // Persist the confirmed slots and affected equipment markers as one operation.
    this.database.exec('BEGIN');
    try {
      this.replaceRoleProfile(accountId, profile);
      const affected = new Set([...previous, ...confirmed]);
      const update = this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?');
      for (const record of records) {
        if (!affected.has(record.instanceId)) continue;
        record.state = confirmed.includes(record.instanceId) ? 2 : 0;
        update.run(JSON.stringify(record), accountId, record.instanceId);
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Save explicitly recovered profile data; this does not grant or equip an owned record. */
  replaceRoleProfile(accountId: string, profile: RoleProfilePayload): void {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    if (!(profile.bytes instanceof Uint8Array) || profile.bytes.length !== 0x170 ||
        profile.strings.length !== 2 || profile.strings.some(value => typeof value !== 'string')) {
      throw new Error('原角色资料必须包含368字节及两个字符串');
    }
    this.database.prepare('INSERT OR REPLACE INTO role_profiles VALUES (?, ?, ?)')
      .run(accountId, profile.bytes, JSON.stringify(profile.strings));
  }

  /** Explicit recovered ownership import; retains original base+0 and equipment+1c keys. */
  replaceRoleRecords(accountId: string, records: {
    base: readonly OwnedRoleBaseRecord[]; equipment: readonly OwnedRoleEquipmentRecord[];
  }): void {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const rows: {kind: string; id: number; json: string}[] = [];
    for (const kind of ['base', 'equipment'] as const) {
      const ids = new Set<number>();
      for (const record of records[kind]) {
        const id = record.fields.get(kind === 'base' ? 0 : 0x1c);
        if (id === undefined || !Number.isInteger(id) || id < 0 || id > 0xffffffff || ids.has(id)) {
          throw new Error('拥有记录实例ID缺失、无效或重复');
        }
        if (typeof record.name !== 'string' || [...record.fields].some(([offset, value]) =>
          !Number.isInteger(offset) || offset < 0 || !Number.isInteger(value) || value < 0 || value > 0xffffffff)) {
          throw new Error('拥有记录字段无效');
        }
        ids.add(id);
        rows.push({kind, id, json: JSON.stringify({name: record.name, fields: [...record.fields]})});
      }
    }
    this.database.exec('BEGIN');
    try {
      this.database.prepare('DELETE FROM role_records WHERE account_id = ?').run(accountId);
      const insert = this.database.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)');
      for (const row of rows) insert.run(accountId, row.kind, row.id, row.json);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Operator-supplied ownership import. No catalog-based grants or public grant API. */
  replaceInventory(accountId: string, records: readonly InventoryWireRecord[]): void {
    if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
    const ids = new Set<number>();
    for (const record of records) {
      if (!Number.isInteger(record.instanceId) || record.instanceId <= 0 || record.instanceId > 0xffffffff
          || ids.has(record.instanceId)) throw new Error('库存实例ID无效或重复');
      ids.add(record.instanceId);
    }
    this.database.exec('BEGIN');
    try {
      this.database.prepare('DELETE FROM inventory WHERE account_id = ?').run(accountId);
      const insert = this.database.prepare('INSERT INTO inventory VALUES (?, ?, ?)');
      for (const record of records) insert.run(accountId, record.instanceId, JSON.stringify(record));
      const assigned = this.database.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id = ?').all(accountId);
      for (const row of assigned) {
        if (!ids.has(Number(row.instance_id))) {
          this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND slot = ?').run(accountId, row.slot);
        }
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  assign(accountId: string, instanceId: number, slot: number): KitbagAssignmentResult {
    this.slot(slot);
    if (!Number.isInteger(instanceId) || instanceId <= 0 || instanceId > 0xffffffff) throw new Error('库存实例ID无效');
    const inventory = this.inventory(accountId);
    const groups = Array.from({length: 8}, () => [] as InventoryWireRecord[]);
    applyInventoryQuery(groups, inventory.records, {field44: 0, field45: 0, array1: [], array2: []});
    let accepted = false;
    requestKitbagAssignment(groups, instanceId, slot, () => {accepted = true;});
    if (!accepted) throw new Error('该账户物品不能配置到此快捷槽');
    this.database.prepare('INSERT OR REPLACE INTO hotkeys VALUES (?, ?, ?)').run(accountId, slot, instanceId);
    return {result: 4, instanceId, slot, hotkeys: this.inventory(accountId).hotkeys};
  }

  cancel(accountId: string, slot: number): KitbagCancellationResult {
    this.slot(slot);
    let accepted = false;
    requestKitbagCancellation(this.inventory(accountId).hotkeys, slot, () => {accepted = true;});
    if (!accepted) throw new Error('快捷槽为空');
    this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND slot = ?').run(accountId, slot);
    return {result: 1, slot};
  }

  close(): void {this.database.close();}

  private slot(slot: number): void {
    if (!Number.isInteger(slot) || slot < 1 || slot > 7) throw new Error('快捷槽应为1至7');
  }
}
