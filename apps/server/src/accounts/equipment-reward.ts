import {content} from '../content';
import type {DatabaseSync} from 'node:sqlite';
import type {ResultItemGrant, ResultTankGrant} from '../../../shared/protocols/MsgRoomSnapshot';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
import {combatItems} from '../battle/catalog';
import {tankShopDefinition, tankShopCatalog} from './tank-shop-catalog';

/** Server-only battle-equipment draw frozen with the pending settlement payload.
 * The four values are Math.random results in [0,1); a retry reuses them instead of rolling again.
 */
export interface EquipmentRewardRoll {
  itemChance: number;
  itemChoice: number;
  tankChance: number;
  tankChoice: number;
}

export function battleItemPool(): number[] {
  return [...content.items.values()].filter(item => item.runtime.values.battleRewardOrder > 0)
    .sort((a, b) => a.runtime.values.battleRewardOrder - b.runtime.values.battleRewardOrder).map(item => item.id);
}

/** Smallest unused positive uint32 across both owned tables; re-queried for every new record. */
function nextInstanceId(database: DatabaseSync, accountId: string): number {
  let instanceId = 1;
  for (const row of database.prepare(`SELECT instance_id FROM inventory WHERE account_id = ?
    UNION SELECT instance_id FROM role_records WHERE account_id = ? ORDER BY instance_id`).all(accountId, accountId)) {
    const used = Number(row.instance_id);
    if (used === instanceId) instanceId++;
    else if (used > instanceId) break;
  }
  if (instanceId > 0xffffffff) throw new Error('账户物品实例ID已用尽');
  return instanceId;
}

function ownedTankIds(database: DatabaseSync, accountId: string): Set<number> {
  const ids = new Set<number>();
  for (const row of database.prepare(
    "SELECT record FROM role_records WHERE account_id = ? AND kind = 'equipment'").all(accountId)) {
    const record = JSON.parse(String(row.record)) as OwnedRoleRecordData;
    const tankId = new Map(record.fields).get(0x24);
    if (tankId !== undefined) ids.add(tankId);
  }
  return ids;
}

function itemRecord(instanceId: number, itemTableId: number): InventoryWireRecord {
  return {instanceId, itemTableId, ownedQuantity: 1, battleQuantity: 0, state: 0,
    field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
}

function tankRecord(instanceId: number, definition: ReturnType<typeof tankShopCatalog>[number]):
    OwnedRoleRecordData {
  const fields = new Map<number, number>();
  for (let offset = 0x1c; offset <= 0x6c; offset += 4) fields.set(offset, 0);
  for (const [offset, value] of [[0x1c, instanceId], [0x24, definition.product.tankId],
    [0x28, definition.product.textures.U], [0x2c, definition.product.textures.M],
    [0x30, definition.product.textures.XY], [0x3c, definition.base.attack],
    [0x40, definition.base.attackBonus], [0x4c, definition.base.defense],
    [0x50, definition.base.defenseBonus], [0x6c, definition.partCapacity]] as const) {
    fields.set(offset, value);
  }
  return {name: definition.product.name, fields: [...fields]};
}

/** Apply one frozen draw inside the caller's BEGIN IMMEDIATE; never opens its own transaction.
 * An account without a role profile receives nothing, matching the existing money-credit rule.
 */
export function grantEquipmentReward(database: DatabaseSync, accountId: string,
    roll: EquipmentRewardRoll): {items: ResultItemGrant[]; tanks: ResultTankGrant[]} {
  const profile = database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
  if (!profile) return {items: [], tanks: []};
  const items: ResultItemGrant[] = [];
  const tanks: ResultTankGrant[] = [];
  const itemPool = battleItemPool();
  if (itemPool.length && roll.itemChance < content.rules.equipmentRewards.itemChance) {
    const itemTableId = itemPool[Math.floor(roll.itemChoice * itemPool.length)];
    const definition = combatItems.get(itemTableId);
    if (!definition || !Number.isInteger(definition.iconId) || definition.iconId! <= 0) {
      throw new Error(`战斗奖励道具${itemTableId}原表名称与图标缺失`);
    }
    const instanceId = nextInstanceId(database, accountId);
    database.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(accountId, instanceId,
      JSON.stringify(itemRecord(instanceId, itemTableId)));
    items.push({instanceId, itemTableId, name: definition.name, iconId: definition.iconId!});
  }
  if (roll.tankChance < content.rules.equipmentRewards.tankChance) {
    const owned = ownedTankIds(database, accountId);
    const pool = [...content.tanks.values()].filter(tank => tank.battleReward && !owned.has(tank.id)).map(tankShopDefinition);
    if (pool.length) {
      const definition = pool[Math.floor(roll.tankChoice * pool.length)];
      const instanceId = nextInstanceId(database, accountId);
      database.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(accountId, 'equipment',
        instanceId, JSON.stringify(tankRecord(instanceId, definition)));
      tanks.push({instanceId, tankId: definition.product.tankId, name: definition.product.name});
    }
  }
  return {items, tanks};
}
