import type {DatabaseSync} from 'node:sqlite';
import {equipmentTarget, type EquipmentTarget} from '../../../shared/combat/equipment-target';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {EquipmentBinding} from '../../../shared/protocols/PtlEquipment';
import type {RoleProfilePayload} from './profile/payload';
import {readRoleProfileEquipment, writeRoleProfileEquipment} from './profile/equipment';
import {readRoleProfileCosmetics, writeRoleProfileCosmetic} from './profile/cosmetics';

/** Tank instance ownership persists independently of the currently selected battle profile. */
export class AccountTankEquipment {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tank_loadouts (account_id TEXT NOT NULL, tank_id INTEGER NOT NULL,
        PRIMARY KEY(account_id, tank_id));
      CREATE TABLE IF NOT EXISTS tank_equipment (account_id TEXT NOT NULL, tank_id INTEGER NOT NULL,
        target TEXT NOT NULL, slot INTEGER NOT NULL, instance_id INTEGER NOT NULL,
        PRIMARY KEY(account_id, tank_id, target, slot), UNIQUE(account_id, instance_id));
      CREATE TRIGGER IF NOT EXISTS remove_inventory_tank_binding AFTER DELETE ON inventory BEGIN
        DELETE FROM tank_equipment WHERE account_id = OLD.account_id AND instance_id = OLD.instance_id;
      END;
      CREATE TRIGGER IF NOT EXISTS remove_owned_tank_equipment AFTER DELETE ON role_records
        WHEN OLD.kind = 'equipment' BEGIN
        UPDATE inventory SET record = json_set(record, '$.state', 0)
          WHERE account_id = OLD.account_id AND instance_id IN
            (SELECT instance_id FROM tank_equipment WHERE account_id = OLD.account_id AND tank_id = OLD.instance_id);
        DELETE FROM tank_equipment WHERE account_id = OLD.account_id AND tank_id = OLD.instance_id;
        DELETE FROM tank_loadouts WHERE account_id = OLD.account_id AND tank_id = OLD.instance_id;
      END;
    `);
    const legacy = database.prepare(`SELECT account_id, payload, strings FROM role_profiles
      WHERE NOT EXISTS (SELECT 1 FROM tank_loadouts WHERE tank_loadouts.account_id = role_profiles.account_id)`).all();
    if (legacy.length) {
      database.exec('BEGIN IMMEDIATE');
      try {
        for (const row of legacy) {
          const accountId = String(row.account_id);
          const profile = {bytes: new Uint8Array(row.payload as Uint8Array),
            strings: JSON.parse(String(row.strings)) as [string, string]};
          const records = database.prepare('SELECT record FROM inventory WHERE account_id = ?').all(accountId)
            .map(item => JSON.parse(String(item.record)) as InventoryWireRecord);
          this.initialize(accountId, profile, records);
          database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(profile.bytes, accountId);
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
  }

  tankId(profile: RoleProfilePayload): number {
    return new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength).getUint32(0xa8, true);
  }

  bindings(accountId: string): EquipmentBinding[] {
    return this.database.prepare('SELECT tank_id, target, slot, instance_id FROM tank_equipment WHERE account_id = ?')
      .all(accountId).map(row => ({tankInstanceId: Number(row.tank_id), target: row.target as EquipmentTarget,
        slot: Number(row.slot), instanceId: Number(row.instance_id)}));
  }

  /** Preserve an existing account's selected loadout once, including its appearance effects. */
  initialize(accountId: string, profile: RoleProfilePayload, records: readonly InventoryWireRecord[]): void {
    if (this.database.prepare('SELECT 1 FROM tank_loadouts WHERE account_id = ? LIMIT 1').get(accountId)) return;
    const tankId = this.tankId(profile);
    if (!this.database.prepare("SELECT 1 FROM role_records WHERE account_id = ? AND kind = 'equipment' AND instance_id = ?")
      .get(accountId, tankId)) return;
    this.database.prepare('INSERT INTO tank_loadouts VALUES (?, ?)').run(accountId, tankId);
    const cosmetics = readRoleProfileCosmetics(profile);
    const candidates = [cosmetics.skinInstanceId, cosmetics.markInstanceId, ...readRoleProfileEquipment(profile)];
    const used = new Set<number>();
    for (let index = 0; index < candidates.length; index++) {
      const instanceId = candidates[index];
      const record = records.find(item => item.instanceId === instanceId);
      const target = record && equipmentTarget(record.itemTableId);
      if (!record || !target || used.has(instanceId)) continue;
      const slot = target === 'PART' ? index - 2 : 0;
      if (slot < 0 || this.database.prepare(
        'SELECT 1 FROM tank_equipment WHERE account_id = ? AND tank_id = ? AND target = ? AND slot = ?',
      ).get(accountId, tankId, target, slot)) continue;
      this.database.prepare('INSERT INTO tank_equipment VALUES (?, ?, ?, ?, ?)')
        .run(accountId, tankId, target, slot, instanceId);
      used.add(instanceId);
    }
    for (const record of records) {
      if (!candidates.includes(record.instanceId)) continue;
      this.database.prepare('UPDATE inventory SET record = ? WHERE account_id = ? AND instance_id = ?')
        .run(JSON.stringify({...record, state: used.has(record.instanceId) ? 2 : 0}), accountId, record.instanceId);
    }
    this.project(accountId, profile);
  }

  project(accountId: string, profile: RoleProfilePayload): void {
    const tankId = this.tankId(profile);
    this.database.prepare('INSERT OR IGNORE INTO tank_loadouts VALUES (?, ?)').run(accountId, tankId);
    const bindings = this.bindings(accountId).filter(binding => binding.tankInstanceId === tankId);
    const slots = Array<number>(5).fill(0);
    for (const binding of bindings) {
      if (binding.target === 'PART') slots[binding.slot] = binding.instanceId;
    }
    writeRoleProfileEquipment(profile, slots);
    writeRoleProfileCosmetic(profile, 'skin', bindings.find(binding => binding.target === 'DECORATION')?.instanceId ?? 0);
    writeRoleProfileCosmetic(profile, 'mark', bindings.find(binding => binding.target === 'MARK')?.instanceId ?? 0);
  }

  trim(accountId: string, profile: RoleProfilePayload, slotCount: number): void {
    const bindings = this.bindings(accountId).filter(binding => binding.tankInstanceId === this.tankId(profile)
      && binding.target === 'PART' && binding.slot >= slotCount);
    for (const binding of bindings) {
      this.database.prepare('DELETE FROM tank_equipment WHERE account_id = ? AND instance_id = ?')
        .run(accountId, binding.instanceId);
      this.database.prepare("UPDATE inventory SET record = json_set(record, '$.state', 0) WHERE account_id = ? AND instance_id = ?")
        .run(accountId, binding.instanceId);
    }
    this.project(accountId, profile);
  }

  save(accountId: string, profile: RoleProfilePayload): void {
    const tankId = this.tankId(profile);
    this.database.prepare('DELETE FROM tank_equipment WHERE account_id = ? AND tank_id = ?').run(accountId, tankId);
    const cosmetics = readRoleProfileCosmetics(profile);
    const add = (target: EquipmentTarget, slot: number, instanceId: number) => {
      if (instanceId) this.database.prepare('INSERT INTO tank_equipment VALUES (?, ?, ?, ?, ?)')
        .run(accountId, tankId, target, slot, instanceId);
    };
    readRoleProfileEquipment(profile).forEach((id, slot) => add('PART', slot, id));
    add('DECORATION', 0, cosmetics.skinInstanceId);
    add('MARK', 0, cosmetics.markInstanceId);
  }
}
