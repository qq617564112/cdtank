import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import {writeRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';
import {writeRoleProfileCosmetic} from '../apps/server/src/accounts/profile/cosmetics';
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const pairEvidence = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'cdtank-equipment-'));
let store = new AccountStore(join(dir, 'accounts.sqlite'));
try {
  const account = store.open(), other = store.open();
  const pair = readOwnedRolePairMessage(new Uint8Array(pairEvidence.rows[0].raw), pairEvidence.rows[0].alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  const base = {name: pair.base.name, fields: new Map(pair.base.fields)};
  const tank = {name: pair.equipment.name, fields: new Map(pair.equipment.fields)};
  base.fields.set(8, 1); tank.fields.set(0x24, 2); tank.fields.set(0x6c, 3);
  for (const offset of [0x58, 0x5c, 0x60]) tank.fields.set(offset, 0);
  for (let slot = 0; slot < 6; slot++) {base.fields.set(0x44 + slot * 4, 0); base.fields.set(0x5c + slot * 4, 0);}
  store.replaceRoleRecords(account.accountId, {base: [base], equipment: [tank]});
  const profile = {bytes: new Uint8Array(0x170).map((_, i) => i & 255), strings: ['Owner', 'Pet'] as [string, string]};
  const view = new DataView(profile.bytes.buffer);
  view.setUint32(0xa4, base.fields.get(0)!, true); view.setUint32(0xa8, tank.fields.get(0x1c)!, true);
  writeRoleProfileEquipment(profile, [0, 0, 0, 0, 0]); store.replaceRoleProfile(account.accountId, profile);
  writeRoleProfileCosmetic(profile, 'skin', 0); writeRoleProfileCosmetic(profile, 'mark', 0);
  store.replaceRoleProfile(account.accountId, profile);
  const records = [13001, 13002, 14001, 17031, 17032, 3001, 10001, 10002, 12001, 12002].map((itemTableId, index) => ({
    instanceId: 71 + index, itemTableId, ownedQuantity: 1, battleQuantity: 1, state: 0, field8: 9,
    float24Bits: 0xffffffff, float28Bits: 0, float2cBits: 0,
  }));
  store.replaceInventory(account.accountId, records);
  assert.throws(() => store.equipment(other.accountId, catalog));
  const query = () => store.equipment(account.accountId, catalog);
  assert.equal(query().slotCount, 3);
  base.fields.set(0x44, 10311); base.fields.set(0x5c, 1);
  store.replaceRoleRecords(account.accountId, {base: [base], equipment: [tank]});
  assert.equal(query().slotCount, 4);
  base.fields.set(0x44, 0); base.fields.set(0x5c, 0);
  store.replaceRoleRecords(account.accountId, {base: [base], equipment: [tank]});
  const unchanged = (action: () => void) => {
    const before = query(), inventory = store.inventory(account.accountId);
    assert.throws(action); assert.deepEqual(query(), before); assert.deepEqual(store.inventory(account.accountId), inventory);
  };
  for (const [slot, id] of [[0, 999], [0, 76], [3, 71], [-1, 71], [5, 71]]) {
    unchanged(() => store.configureEquipment(account.accountId, catalog, 'EQUIP', slot, id));
  }
  store.configureEquipment(account.accountId, catalog, 'EQUIP', 0, 71);
  assert.deepEqual(query().slots, [71, 0, 0, 0, 0]);
  unchanged(() => store.configureEquipment(account.accountId, catalog, 'EQUIP', 1, 72));
  store.configureEquipment(account.accountId, catalog, 'EQUIP', 2, 71);
  assert.deepEqual(query().slots, [0, 0, 71, 0, 0]);
  store.configureEquipment(account.accountId, catalog, 'EQUIP', 2, 73);
  assert.equal(store.inventory(account.accountId).records.find(r => r.instanceId === 71)!.state, 0);
  assert.equal(store.inventory(account.accountId).records.find(r => r.instanceId === 73)!.state, 2);
  store.configureEquipment(account.accountId, catalog, 'EQUIP', 0, 74);
  store.configureEquipment(account.accountId, catalog, 'EQUIP', 1, 75);
  assert.deepEqual(query().slots, [74, 75, 73, 0, 0]);
  const expected = profile.bytes.slice(); new DataView(expected.buffer).setUint32(0x148, 74, true);
  new DataView(expected.buffer).setUint32(0x14c, 75, true); new DataView(expected.buffer).setUint32(0x150, 73, true);
  assert.deepEqual(query().profile.bytes, expected);
  tank.fields.set(0x58, 13001); store.replaceRoleRecords(account.accountId, {base: [base], equipment: [tank]});
  assert.equal(query().slotCount, 2);
  unchanged(() => store.configureEquipment(account.accountId, catalog, 'EQUIP', 0, 71));
  store.close(); store = new AccountStore(join(dir, 'accounts.sqlite'));
  assert.deepEqual(query().slots, [74, 75, 73, 0, 0]);
  store.configureEquipment(account.accountId, catalog, 'UNEQUIP', 2);
  assert.deepEqual(query().slots, [74, 75, 0, 0, 0]);
  unchanged(() => store.configureEquipment(account.accountId, catalog, 'UNEQUIP', 2));
  const cosmetic = (operation: 'EQUIP' | 'UNEQUIP', target: 'DECORATION' | 'MARK', id?: number) =>
    store.configureCosmetic(account.accountId, catalog, operation, target, id);
  unchanged(() => cosmetic('EQUIP', 'DECORATION', 79));
  unchanged(() => cosmetic('EQUIP', 'MARK', 77));
  unchanged(() => cosmetic('EQUIP', 'DECORATION', 999));
  unchanged(() => cosmetic('UNEQUIP', 'MARK'));
  const beforeCosmetics = query().profile.bytes.slice();
  cosmetic('EQUIP', 'DECORATION', 77); cosmetic('EQUIP', 'MARK', 79);
  cosmetic('EQUIP', 'DECORATION', 78);
  assert.equal(query().decorationInstanceId, 78); assert.equal(query().markInstanceId, 79);
  const wrongState = store.inventory(account.accountId).records;
  wrongState.find(r => r.instanceId === 78)!.state = 0;
  store.replaceInventory(account.accountId, wrongState);
  unchanged(() => cosmetic('UNEQUIP', 'DECORATION'));
  wrongState.find(r => r.instanceId === 78)!.state = 2;
  store.replaceInventory(account.accountId, wrongState);
  const cosmeticsExpected = beforeCosmetics.slice();
  new DataView(cosmeticsExpected.buffer).setUint32(0x118, 78, true);
  new DataView(cosmeticsExpected.buffer).setUint32(0x13c, 79, true);
  assert.deepEqual(query().profile.bytes, cosmeticsExpected);
  assert.equal(store.inventory(account.accountId).records.find(r => r.instanceId === 77)!.state, 0);
  assert.equal(store.inventory(account.accountId).records.find(r => r.instanceId === 78)!.state, 2);
  assert.deepEqual(store.inventory(other.accountId).records, []);
  store.close(); store = new AccountStore(join(dir, 'accounts.sqlite'));
  assert.equal(query().decorationInstanceId, 78); assert.equal(query().markInstanceId, 79);
  cosmetic('UNEQUIP', 'DECORATION'); cosmetic('UNEQUIP', 'MARK');
  assert.deepEqual(query().profile.bytes, beforeCosmetics);
  const zeroQuantity = store.inventory(account.accountId).records;
  zeroQuantity.find(r => r.instanceId === 77)!.ownedQuantity = 0;
  store.replaceInventory(account.accountId, zeroQuantity);
  unchanged(() => cosmetic('EQUIP', 'DECORATION', 77));
  writeFileSync('recovery/output/account-equipment.json', JSON.stringify({status: 'PASS',
    scope: 'Explicit native layout fixture and rebuilt part equip/unequip authority, not original server qualification or full combat attributes.',
    ownership: true, partCategoryOnly: true, capacity: true, rankedSkillCapacity: true, conflict: true, installedConflict: true,
    duplicateMove: true, category12Repeat: true, replacementMarkers: true, profileOnly20Bytes: true,
    restart: true, unequipOutsideReducedCapacity: true, rejectedUnchanged: true,
    cosmetics: {exact8Bytes: true, replacementMarkers: true, restart: true, categoryGate: true,
      ownership: true, zeroQuantity: true, stateGate: true, unload: true}}, null, 2));
  console.log('PASS: account part equipment, source request gates, move/replace, rejected no writes,20-byte profile, markers and restart');
} finally {store.close(); rmSync(dir, {recursive: true, force: true});}
