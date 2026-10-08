import {content} from '../content';
import type {PetDefinition, TankDefinition} from '../../../shared/content/types';
import type {DatabaseSync} from 'node:sqlite';
import type {OwnedRoleRecordData} from '../../../shared/protocols/PtlOwnedRoles';
function petRecord(row: PetDefinition, instanceId: number): OwnedRoleRecordData {
  const fields = new Map<number, number>();
  for (const offset of [4, 0, 8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c,
    0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90, 0x74, 0x78]) fields.set(offset, 0);
  fields.set(0, instanceId);
  fields.set(8, row.id);
  fields.set(0x2c, row.attributes.maxHp);
  fields.set(0x34, row.attributes.critical);
  fields.set(0x3c, row.attributes.lucky);
  for (let slot = 0; slot < 6; slot++) {
    fields.set(0x44 + slot * 4, row.skills[slot].baseId);
    fields.set(0x5c + slot * 4, row.skills[slot].initialRank);
  }
  return {name: row.name, fields: [...fields]};
}

function tankRecord(tank: TankDefinition, instanceId: number): OwnedRoleRecordData {
  const fields = new Map<number, number>();
  for (let offset = 0x1c; offset <= 0x6c; offset += 4) fields.set(offset, 0);
  for (const [offset, value] of [[0x1c, instanceId], [0x24, tank.id],
    [0x28, tank.textures.U], [0x2c, tank.textures.M],
    [0x30, tank.textures.XY], [0x3c, tank.attributes.attack],
    [0x40, tank.attributes.attackBonus], [0x4c, tank.attributes.defense],
    [0x50, tank.attributes.defenseBonus], [0x6c, tank.partCapacity]]) fields.set(offset, value);
  return {name: tank.name, fields: [...fields]};
}

/** Initialize the registered account inside its credentials transaction. */
export function grantRegistrationStarterRoles(database: DatabaseSync, accountId: string): void {
  const owned = database.prepare('SELECT kind, instance_id, record FROM role_records WHERE account_id = ?')
    .all(accountId).map(row => ({kind: String(row.kind), instanceId: Number(row.instance_id),
      record: JSON.parse(String(row.record)) as OwnedRoleRecordData}));
  const used = new Set(database.prepare(`SELECT instance_id FROM inventory WHERE account_id = ?
    UNION SELECT instance_id FROM role_records WHERE account_id = ?`).all(accountId, accountId)
    .map(row => Number(row.instance_id)));
  let nextInstanceId = 1;
  const insert = database.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)');
  const grant = (kind: 'base' | 'equipment', tableId: number, build: (instanceId: number) => OwnedRoleRecordData): number => {
    const tableOffset = kind === 'base' ? 8 : 0x24;
    const existing = owned.find(row => row.kind === kind && new Map(row.record.fields).get(tableOffset) === tableId);
    if (existing) return existing.instanceId;
    while (used.has(nextInstanceId)) nextInstanceId++;
    const instanceId = nextInstanceId++;
    used.add(instanceId);
    const record = build(instanceId);
    insert.run(accountId, kind, instanceId, JSON.stringify(record));
    owned.push({kind, instanceId, record});
    return instanceId;
  };
  let selectedPet = 0, selectedTank = 0;
  for (const pet of content.pets.values()) {
    if (!pet.starter) continue;
    const instance = grant('base', pet.id, id => petRecord(pet, id));
    if (pet.defaultSelected) selectedPet = instance;
  }
  for (const tank of content.tanks.values()) {
    if (!tank.starter) continue;
    const instance = grant('equipment', tank.id, id => tankRecord(tank, id));
    if (tank.defaultSelected) selectedTank = instance;
  }

  const profile = database.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(accountId);
  const bytes = profile ? new Uint8Array(profile.payload as Uint8Array) : new Uint8Array(0x170);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const [kind, offset, instanceId] of [['base', 0xa4, selectedPet],
    ['equipment', 0xa8, selectedTank]] as const) {
    const selected = view.getUint32(offset, true);
    if (!owned.some(row => row.kind === kind && row.instanceId === selected)) view.setUint32(offset, instanceId, true);
  }
  if (profile) {
    database.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, accountId);
  } else {
    database.prepare('INSERT INTO role_profiles VALUES (?, ?, ?)').run(accountId, bytes, JSON.stringify(['', '']));
  }
}
