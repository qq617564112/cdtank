import type {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import type {CombatItemDefinition} from '../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../shared/combat/inventory-query';
import {isTreasureItem} from '../../../shared/combat/treasure-items';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import {webAssetPath} from '../runtime/content-paths';

/** Ground identity handed in by the calling ground producer; the producer already
 * fixed the drop visual domain and category before reaching the account write. */
export interface GroundItemAcquireContext {
  roomId: string;
  round: number;
  groundId: string;
  itemTableId: number;
  quantity: number;
}

export interface GroundItemDiscardContext {
  roomId: string;
  round: number;
  groundId: string;
  instanceId: number;
  expectedOwned: number;
  itemTableId: number;
  quantity: 1;
}

/** Canonical owned state for the discarded instance once one unit leaves inventory. */
export interface GroundItemDiscardResult {
  deleted: boolean;
  remaining?: InventoryWireRecord;
}

/** Owned quantity column is the project's 24-bit MyItem+10 stack count. */
const MAX_QUANTITY = 0xffffff;

let definitions: Map<number, CombatItemDefinition> | undefined;

/** Same runtime asset consumed by `battle/catalog`; loaded once on first ground write. */
function itemDefinitions(): Map<number, CombatItemDefinition> {
  if (!definitions) {
    const catalog = JSON.parse(readFileSync(webAssetPath('combat-catalog.json'), 'utf8')) as {
      items: CombatItemDefinition[];
    };
    definitions = new Map(catalog.items.map(item => [item.itemTableId, item]));
  }
  return definitions;
}

function readRecord(value: unknown): InventoryWireRecord {
  return JSON.parse(String(value)) as InventoryWireRecord;
}

function boundQuantity(context: Pick<GroundItemAcquireContext, 'itemTableId' | 'quantity'>): {
  itemTableId: number; quantity: number;
} {
  const {itemTableId, quantity} = context;
  if (!Number.isInteger(itemTableId) || itemTableId <= 0 || itemTableId > 0xffffffff) {
    throw new Error('地面物品表ID无效');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error('地面物品数量应为正数');
  }
  const category = classifyInventoryCategory(itemTableId);
  if (category < 1 || category > 6) throw new Error('该物品类别不支持地面拾取');
  if (!itemDefinitions().has(itemTableId)) throw new Error('该地面物品没有已知定义');
  return {itemTableId, quantity};
}

/** Persistent owned-inventory authority for ground pickup and discard.
 *
 * The runtime shares the AccountStore connection so the account row and the ground
 * receipt commit or roll back together in one `BEGIN IMMEDIATE` transaction. The
 * caller removes the world entity only after this returns a committed record.
 */
export class GroundItemAccountRuntime {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS ground_pickup_receipts (ground_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL, room_id TEXT NOT NULL, round INTEGER NOT NULL,
        item_table_id INTEGER NOT NULL, instance_id INTEGER NOT NULL, quantity INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ground_discard_receipts (ground_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL, room_id TEXT NOT NULL, round INTEGER NOT NULL,
        item_table_id INTEGER NOT NULL, instance_id INTEGER NOT NULL, quantity INTEGER NOT NULL);
    `);
  }

  /** Grant one ground object's quantity to `accountId`, exactly once per ground identity. */
  acquireOwnedItem(accountId: string, context: GroundItemAcquireContext): InventoryWireRecord | undefined {
    const {roomId, round, groundId} = context;
    const {itemTableId, quantity} = boundQuantity(context);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (!this.database.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)) throw new Error('账户不存在');
      const stored = this.database.prepare(`SELECT account_id, room_id, round, item_table_id, instance_id, quantity
        FROM ground_pickup_receipts WHERE ground_id = ?`).get(groundId);
      if (stored) {
        if (String(stored.account_id) !== accountId) {this.database.exec('ROLLBACK'); return undefined;}
        if (String(stored.room_id) !== roomId || Number(stored.round) !== round
            || Number(stored.item_table_id) !== itemTableId || Number(stored.quantity) !== quantity) {
          throw new Error('地面获取已用于不同身份或数量');
        }
        // Replay after a late duplicate: return the current owned row, never the frozen receipt value.
        const row = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? AND instance_id = ?')
          .get(accountId, Number(stored.instance_id));
        this.database.exec('ROLLBACK');
        return row ? readRecord(row.record) : undefined;
      }
      const stack = this.database.prepare('SELECT instance_id, record FROM inventory WHERE account_id = ? ORDER BY instance_id')
        .all(accountId).map(row => ({instanceId: Number(row.instance_id), record: readRecord(row.record)}))
        .find(entry => entry.record.itemTableId === itemTableId);
      let granted: InventoryWireRecord;
      if (stack) {
        if (stack.record.ownedQuantity + quantity > MAX_QUANTITY) throw new Error('地面物品数量超出范围');
        granted = {...stack.record, ownedQuantity: stack.record.ownedQuantity + quantity};
        // Existing assigned stack reaches this round's usable count; the new amount must not be
        // persisted with battleQuantity stuck below the source BattleUseMax.
        const assigned = this.database.prepare('SELECT 1 FROM hotkeys WHERE account_id = ? AND instance_id = ?')
          .get(accountId, stack.instanceId);
        if (assigned) {
          const useMax = itemDefinitions().get(itemTableId)?.battleUseMax ?? 0;
          // The two Func20 treasures have source BattleUseMax0; adopted ordinary use exposes
          // the real remaining owned count instead of fabricating a per-round cap.
          granted.battleQuantity = isTreasureItem(itemTableId)
            ? granted.ownedQuantity
            : Math.max(stack.record.battleQuantity, Math.min(granted.ownedQuantity, useMax >>> 0));
        }
        this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
          .run(JSON.stringify(granted), accountId, stack.instanceId);
      } else {
        const instanceId = this.allocateInstanceId(accountId);
        // Adopted owned schema for a new row; original-field provenance is unknown, so the
        // typed defaults are used rather than fabricating a source record.
        granted = {instanceId, itemTableId, ownedQuantity: quantity, battleQuantity: 0,
          state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
        this.database.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(accountId, instanceId, JSON.stringify(granted));
      }
      this.database.prepare(`INSERT INTO ground_pickup_receipts
        (ground_id, account_id, room_id, round, item_table_id, instance_id, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(groundId, accountId, roomId, round, itemTableId, granted.instanceId, quantity);
      this.database.exec('COMMIT');
      return granted;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Remove one owned instance into the world, exactly once per ground identity. */
  discardOwnedItem(accountId: string, context: GroundItemDiscardContext):
      GroundItemDiscardResult | undefined {
    const {roomId, round, groundId, instanceId, expectedOwned, quantity} = context;
    if (quantity !== 1) throw new Error('地面丢弃一次只移除一份');
    if (!Number.isInteger(instanceId) || instanceId <= 0 || instanceId > 0xffffffff) {
      throw new Error('库存实例ID无效');
    }
    const {itemTableId} = boundQuantity(context);
    if (!Number.isInteger(expectedOwned) || expectedOwned < 1 || expectedOwned > MAX_QUANTITY) {
      throw new Error('地面丢弃拥有量无效');
    }
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const stored = this.database.prepare(`SELECT account_id, room_id, round, item_table_id, instance_id, quantity
        FROM ground_discard_receipts WHERE ground_id = ?`).get(groundId);
      if (stored) {
        if (String(stored.account_id) !== accountId) {this.database.exec('ROLLBACK'); return undefined;}
        if (String(stored.room_id) !== roomId || Number(stored.round) !== round
            || Number(stored.item_table_id) !== itemTableId || Number(stored.instance_id) !== instanceId) {
          throw new Error('地面丢弃已用于不同身份');
        }
        const row = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? AND instance_id = ?')
          .get(accountId, Number(stored.instance_id));
        this.database.exec('ROLLBACK');
        return row ? {deleted: false, remaining: readRecord(row.record)} : {deleted: true};
      }
      const row = this.database.prepare('SELECT record FROM inventory WHERE account_id = ? AND instance_id = ?')
        .get(accountId, instanceId);
      const record = row ? readRecord(row.record) : undefined;
      // Every compare-and-set gate runs before any quantity or binding change.
      if (!record || record.itemTableId !== itemTableId || record.ownedQuantity !== expectedOwned) {
        this.database.exec('ROLLBACK');
        return undefined;
      }
      const remainingOwned = expectedOwned - 1;
      let result: GroundItemDiscardResult;
      if (remainingOwned > 0) {
        const updated = {...record, ownedQuantity: remainingOwned};
        this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
          .run(JSON.stringify(updated), accountId, instanceId);
        result = {deleted: false, remaining: updated};
      } else {
        // Empty stack is deleted with every shortcut and profile binding cleared in the
        // same transaction so a confirmed client ammo slot cannot reference a dead instance.
        this.database.prepare('DELETE FROM inventory WHERE account_id = ? AND instance_id = ?').run(accountId, instanceId);
        this.database.prepare('DELETE FROM hotkeys WHERE account_id = ? AND instance_id = ?').run(accountId, instanceId);
        this.clearProfileBindings(accountId, instanceId);
        result = {deleted: true};
      }
      this.database.prepare(`INSERT INTO ground_discard_receipts
        (ground_id, account_id, room_id, round, item_table_id, instance_id, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(groundId, accountId, roomId, round, itemTableId, instanceId, quantity);
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** First unused positive uint32 across owned inventory and role records, matching the rebuilt stores. */
  private allocateInstanceId(accountId: string): number {
    let instanceId = 1;
    for (const row of this.database.prepare(`SELECT instance_id FROM inventory WHERE account_id = ?
      UNION SELECT instance_id FROM role_records WHERE account_id = ? ORDER BY instance_id`).all(accountId, accountId)) {
      const used = Number(row.instance_id);
      if (used === instanceId) instanceId++;
      else if (used > instanceId) break;
    }
    if (instanceId > 0xffffffff) throw new Error('账户物品实例ID已用尽');
    return instanceId;
  }

  /** Clear the recovered cosmetic/part selectors holding a deleted instance, preserving unrelated fields. */
  private clearProfileBindings(accountId: string, instanceId: number): void {
    const saved = this.database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
    if (!saved) return;
    const bytes = Uint8Array.from(saved.payload as Uint8Array);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let changed = false;
    for (const offset of [0x118, 0x13c, 0x140, 0x144, 0x148, 0x14c, 0x150, 0x154, 0x158]) {
      if (view.getUint32(offset, true) === instanceId) {view.setUint32(offset, 0, true); changed = true;}
    }
    if (changed) this.database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
  }
}
