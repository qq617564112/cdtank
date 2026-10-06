import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {AccountStore} from '../apps/server/src/account-store';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import {receiveRoleOwnedPair, type RoleOwnedSources} from '../apps/server/src/accounts/owned/receive-pair';
import {resolveRoleRecomputeSource} from '../apps/server/src/accounts/owned/source-selection';
import {readRoleProfileSelection} from '../apps/server/src/accounts/profile/selection';
import {setRoleProfileSelection} from '../recovery/evidence/roles/role-profile-selection';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-role-ownership-'));
const path = join(directory, 'accounts.sqlite');
let store = new AccountStore(path);
const pairs: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(
  readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
try {
  const first = store.open(), second = store.open();
  assert.deepEqual(store.roleRecords(first.accountId), {base: new Map(), equipment: new Map()});
  for (const row of pairs.rows) {
    const message = readOwnedRolePairMessage(new Uint8Array(row.raw), row.alignment,
      bytes => Buffer.from(bytes).toString('hex'));
    const imported = {base: [message.base], equipment: [message.equipment]};
    store.replaceRoleRecords(first.accountId, imported);
    store.close();
    store = new AccountStore(path);
    assert.equal(store.open(first.token).accountId, first.accountId);
    const owned = store.roleRecords(first.accountId);
    assert.deepEqual(owned.base.get(message.base.fields.get(0)!), message.base);
    assert.deepEqual(owned.equipment.get(message.equipment.fields.get(0x1c)!), message.equipment);
    assert.deepEqual(store.roleRecords(second.accountId), {base: new Map(), equipment: new Map()});
    for (const [record, kind, key] of [[message.base, 'base', 0],
      [message.equipment, 'equipment', 0x1c]] as const) {
      const id = record.fields.get(key)!;
      const profile = new Map<number, number>([[0x84, 0], [0x88, 0]]);
      const selector = kind === 'base' ? 28 : 29;
      setRoleProfileSelection(profile, selector, id);
      const selected = resolveRoleRecomputeSource(2, undefined, readRoleProfileSelection(profile, selector),
        instance => owned[kind].get(instance));
      assert.deepEqual(selected, record);
      assert.equal(resolveRoleRecomputeSource(2, undefined, id,
        instance => store.roleRecords(second.accountId)[kind].get(instance)), undefined);
    }
    const owner: RoleOwnedSources = {base: undefined, equipment: undefined};
    receiveRoleOwnedPair(owner, {base: owned.base.get(message.base.fields.get(0)!),
      equipment: owned.equipment.get(message.equipment.fields.get(0x1c)!)});
    assert.deepEqual(owner, {base: message.base, equipment: message.equipment});
    assert.throws(() => store.replaceRoleRecords(first.accountId,
      {...imported, base: [message.base, message.base]}));
    assert.deepEqual(store.roleRecords(first.accountId), owned);
    assert.throws(() => store.replaceRoleRecords('missing-account', imported));
    assert.deepEqual(store.inventory(first.accountId), {records: [], hotkeys: Array(7).fill(0)});
  }
  const base = {name: '测试战车', fields: new Map([[0, 0xffffffff], [4, 0x80000001], [0x2c, 65535]])};
  const equipment = {name: '测试装备', fields: new Map([[0x1c, 0xffffffff], [0x68, 0x80000000], [0x40, 65535]])};
  const file = join(directory, 'roles.json');
  writeFileSync(file, JSON.stringify({base: [{name: base.name, fields: [...base.fields]}],
    equipment: [{name: equipment.name, fields: [...equipment.fields]}]}));
  store.close();
  const child = spawnSync(process.execPath, ['--import', 'tsx', 'apps/server/src/import-role-records.ts',
    first.accountId, file], {encoding: 'utf8', env: {...process.env, ACCOUNT_DB_PATH: path}});
  assert.equal(child.status, 0, child.stderr);
  store = new AccountStore(path);
  assert.deepEqual(store.roleRecords(first.accountId), {
    base: new Map([[0xffffffff, base]]), equipment: new Map([[0xffffffff, equipment]]),
  });
  store.replaceRoleRecords(second.accountId, {base: [base], equipment: [equipment]});
  store.replaceRoleRecords(first.accountId, {base: [], equipment: []});
  assert.equal(store.roleRecords(first.accountId).base.size, 0);
  assert.equal(store.roleRecords(second.accountId).base.size, 1);
  writeFileSync('recovery/output/account-role-records.json', JSON.stringify({status: 'PASS',
    nativePairs: pairs.rows.length, accountIsolation: true, restartRecovery: true,
    explicitImportCli: true, unsignedFields: true, noDefaultGrants: true,
    scope: 'Recovered owned-record persistence/import, preview instance lookup and paired source receipt; no original purchase, assembly selection API or World attributes.'}, null, 2));
  console.log(`PASS: ${pairs.rows.length} native paired records save/reopen, account isolation, source lookup and explicit import CLI`);
} finally {
  store.close();
  rmSync(directory, {recursive: true, force: true});
}
