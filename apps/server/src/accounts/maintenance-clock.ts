import type {DatabaseSync} from 'node:sqlite';

export type MaintenanceClockKind = 'tank' | 'part';

export function initializeMaintenanceClocks(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_clock (
      account_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      instance_id INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      PRIMARY KEY(account_id, kind, instance_id)
    );
    CREATE TRIGGER IF NOT EXISTS inventory_delete_maintenance_clock
    AFTER DELETE ON inventory
    BEGIN
      DELETE FROM maintenance_clock
      WHERE account_id = OLD.account_id AND kind = 'part' AND instance_id = OLD.instance_id;
    END;
    CREATE TRIGGER IF NOT EXISTS role_records_delete_equipment_maintenance_clock
    AFTER DELETE ON role_records
    WHEN OLD.kind = 'equipment'
    BEGIN
      DELETE FROM maintenance_clock
      WHERE account_id = OLD.account_id AND kind = 'tank' AND instance_id = OLD.instance_id;
    END;
  `);
}

export function maintenanceExpiry(database: DatabaseSync, accountId: string,
    kind: MaintenanceClockKind, instanceId: number): number | undefined {
  const row = database.prepare(`SELECT expires_at_ms FROM maintenance_clock
    WHERE account_id = ? AND kind = ? AND instance_id = ?`).get(accountId, kind, instanceId);
  return row ? Number(row.expires_at_ms) : undefined;
}

export function currentMaintenanceMinutes(database: DatabaseSync, accountId: string,
    kind: MaintenanceClockKind, instanceId: number, storedMinutes: number, nowMs = Date.now()): number {
  const expiresAtMs = maintenanceExpiry(database, accountId, kind, instanceId);
  if (expiresAtMs === undefined) return storedMinutes;
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 60000));
}

export function anchorMaintenance(database: DatabaseSync, accountId: string,
    kind: MaintenanceClockKind, instanceId: number, afterMinutes: number, nowMs = Date.now()): void {
  database.prepare(`INSERT INTO maintenance_clock (account_id, kind, instance_id, expires_at_ms)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, kind, instance_id) DO UPDATE SET expires_at_ms = excluded.expires_at_ms`)
    .run(accountId, kind, instanceId, nowMs + afterMinutes * 60000);
}

export function removeMaintenanceClock(database: DatabaseSync, accountId: string,
    kind: MaintenanceClockKind, instanceId: number): void {
  database.prepare('DELETE FROM maintenance_clock WHERE account_id = ? AND kind = ? AND instance_id = ?')
    .run(accountId, kind, instanceId);
}

export function setMaintenanceExpiry(database: DatabaseSync, accountId: string,
    kind: MaintenanceClockKind, instanceId: number, expiresAtMs: number): void {
  database.prepare(`INSERT INTO maintenance_clock (account_id, kind, instance_id, expires_at_ms)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, kind, instance_id) DO UPDATE SET expires_at_ms = excluded.expires_at_ms`)
    .run(accountId, kind, instanceId, expiresAtMs);
}
