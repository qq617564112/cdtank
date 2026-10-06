import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {AccountStore} from '../apps/server/src/account-store';
import {decodeRoleProfileUpdate} from '../recovery/evidence/roles/role-profile-update-wire';
import {applyRoleProfileUpdate} from '../recovery/evidence/roles/role-profile-update';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import {readRoleProfileSelection} from '../apps/server/src/accounts/profile/selection';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-role-profile-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database);
const evidence: {updates: {code: number; before: number[]; raw: number[]; profile: number[];
  strings: number[][]}[]} = JSON.parse(readFileSync('recovery/output/role-profile-update-native.json', 'utf8'));
try {
  const first = store.open(), second = store.open();
  assert.equal(store.roleProfile(first.accountId), undefined);
  let count = 0;
  for (const row of evidence.updates.filter(row => row.code === 1)) {
    const profile = {bytes: new Uint8Array(row.before), strings: ['old0', 'old1'] as [string, string]};
    new DataView(profile.bytes.buffer).setUint32(0, 0x5c4118, true);
    applyRoleProfileUpdate(Array.from({length: 7}, () => []), profile,
      {code: row.code, result: 0, profileBytes: new Uint8Array(row.raw)},
      bytes => Buffer.from(bytes).toString('latin1'), new Map());
    assert.deepEqual([...profile.bytes], row.profile);
    store.replaceRoleProfile(first.accountId, profile);
    store.close(); store = new AccountStore(database);
    assert.equal(store.open(first.token).accountId, first.accountId);
    const saved = store.roleProfile(first.accountId)!;
    assert.deepEqual(saved, profile);
    const view = new DataView(saved.bytes.buffer);
    const fields = new Map([[0x84, view.getUint32(0xa4, true)], [0x88, view.getUint32(0xa8, true)]]);
    assert.equal(readRoleProfileSelection(fields, 28), view.getUint32(0xa4, true));
    assert.equal(readRoleProfileSelection(fields, 29), view.getUint32(0xa8, true));
    assert.equal(store.roleProfile(second.accountId), undefined);
    saved.bytes.fill(0); saved.strings[0] = 'changed';
    assert.deepEqual(store.roleProfile(first.accountId), profile);
    assert.deepEqual(store.roleRecords(first.accountId), {base: new Map(), equipment: new Map()});
    assert.deepEqual(store.inventory(first.accountId), {records: [], hotkeys: Array(7).fill(0)});
    count++;
  }
  const envelopes: {rows: {alignment: number; raw: number[]; code: number; profileBytes: number[]}[]} = JSON.parse(
    readFileSync('recovery/output/role-profile-update-wire-native.json', 'utf8'));
  let persistedEnvelopes = 0;
  for (const row of envelopes.rows.filter(row => row.code === 1 && row.profileBytes.length > 1)) {
    const {message} = decodeRoleProfileUpdate(new Uint8Array(row.raw), row.alignment);
    const profile = {bytes: new Uint8Array(0x170).fill(0xaa), strings: ['old0', 'old1'] as [string, string]};
    applyRoleProfileUpdate(Array.from({length: 7}, () => []), profile, message,
      bytes => Buffer.from(bytes).toString('latin1'), new Map());
    store.replaceRoleProfile(first.accountId, profile);
    store.close(); store = new AccountStore(database);
    assert.deepEqual(store.roleProfile(first.accountId), profile);
    persistedEnvelopes++;
  }
  const pairs: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(
    readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
  let selectedPairs = 0;
  for (const row of pairs.rows) {
    const pair = readOwnedRolePairMessage(new Uint8Array(row.raw), row.alignment, bytes => Buffer.from(bytes).toString('hex'));
    store.replaceRoleRecords(first.accountId, {base: [pair.base], equipment: [pair.equipment]});
    const beforeSelection = store.roleProfile(first.accountId)!;
    const petId = pair.base.fields.get(0)!, tankId = pair.equipment.fields.get(0x1c)!;
    for (const [kind, id, offset] of [['pet', petId, 0xa4], ['tank', tankId, 0xa8]] as const) {
      const old = store.roleProfile(first.accountId)!;
      const expected = {bytes: new Uint8Array(old.bytes), strings: [...old.strings]};
      new DataView(expected.bytes.buffer).setUint32(offset, id, true);
      assert.deepEqual(store.selectRole(first.accountId, kind, id), expected);
      assert.deepEqual(store.roleProfile(first.accountId), expected);
      assert.throws(() => store.selectRole(first.accountId, kind, -1));
      assert.deepEqual(store.roleProfile(first.accountId), expected);
    }
    store.replaceRoleProfile(first.accountId, beforeSelection);
    const selected = store.roleProfile(first.accountId)!;
    const fields = new DataView(selected.bytes.buffer);
    // Explicit assembly fixture: selected IDs are supplied, not inferred from definition catalogs.
    fields.setUint32(0xa4, pair.base.fields.get(0)!, true);
    fields.setUint32(0xa8, pair.equipment.fields.get(0x1c)!, true);
    store.replaceRoleProfile(first.accountId, selected);
    store.close(); store = new AccountStore(database);
    assert.deepEqual(store.selectedRoleSources(first.accountId), {base: pair.base, equipment: pair.equipment});
    assert.deepEqual(store.selectedRoleSources(second.accountId), {base: undefined, equipment: undefined});
    store.replaceRoleProfile(second.accountId, selected);
    assert.deepEqual(store.selectedRoleSources(second.accountId), {base: undefined, equipment: undefined});
    store.replaceRoleRecords(first.accountId, {base: [], equipment: [pair.equipment]});
    assert.deepEqual(store.selectedRoleSources(first.accountId), {base: undefined, equipment: pair.equipment});
    store.replaceRoleRecords(first.accountId, {base: [pair.base], equipment: []});
    assert.deepEqual(store.selectedRoleSources(first.accountId), {base: pair.base, equipment: undefined});
    selectedPairs++;
  }
  const prior = store.roleProfile(first.accountId)!;
  assert.throws(() => store.selectRole(first.accountId, 'tank', 123));
  assert.deepEqual(store.roleProfile(first.accountId), prior);
  const emptyAccount = store.open();
  assert.throws(() => store.selectRole(emptyAccount.accountId, 'pet', 0));
  const imported = {bytes: Array.from({length: 0x170}, (_, index) => index & 255),
    strings: ['测试战车', '宠物名字'] as [string, string]};
  const file = join(directory, 'profile.json'); writeFileSync(file, JSON.stringify(imported));
  store.close();
  const child = spawnSync(process.execPath, ['--import', 'tsx', 'apps/server/src/import-role-profile.ts',
    first.accountId, file], {encoding: 'utf8', env: {...process.env, ACCOUNT_DB_PATH: database}});
  assert.equal(child.status, 0, child.stderr);
  store = new AccountStore(database);
  const expected = {bytes: new Uint8Array(imported.bytes), strings: imported.strings};
  assert.deepEqual(store.roleProfile(first.accountId), expected);
  assert.throws(() => store.replaceRoleProfile('missing-account', expected));
  assert.throws(() => store.replaceRoleProfile(first.accountId, {...expected, bytes: new Uint8Array(1)}));
  assert.deepEqual(store.roleProfile(first.accountId), expected);
  imported.bytes[0] = 256; writeFileSync(file, JSON.stringify(imported));
  const invalid = spawnSync(process.execPath, ['--import', 'tsx', 'apps/server/src/import-role-profile.ts',
    first.accountId, file], {encoding: 'utf8', env: {...process.env, ACCOUNT_DB_PATH: database}});
  assert.notEqual(invalid.status, 0);
  assert.deepEqual(store.roleProfile(first.accountId), expected);
  writeFileSync('recovery/output/account-role-profile.json', JSON.stringify({status: 'PASS',
    nativeUpdates: count, persistedEnvelopes, selectedPairs, selectedMissingOwnership: true, databaseReopen: true, detachedReads: true, accountIsolation: true,
    actualImportCli: true, invalidImportPreserves: true, noGrants: true}, null, 2) + '\n');
  console.log(`PASS: ${count} native profile updates persisted/reopened; isolation and actual CLI`);
} finally {
  store.close(); rmSync(directory, {recursive: true, force: true});
}
