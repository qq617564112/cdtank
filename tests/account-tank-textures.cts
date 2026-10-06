import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';
import type {OwnedTankTextures} from '../apps/shared/combat/role-owned-textures';
import {readOwnedTankTextures} from '../apps/shared/combat/role-owned-textures';

const table = JSON.parse(readFileSync('recovery/output/verified/tables/tanktexture.json', 'utf8')) as {
  rows: {recordId: number; values: Record<string, string>}[];
};
const parts = ['U', 'M', 'XY'] as const;
const rows = table.rows.map(row => ({recordId: row.recordId, tankId: Math.floor(row.recordId / 10000),
  part: parts[row.recordId % 10 - 1], rarity: Number(row.values['稀有度']),
  moneyPrice: Number(row.values['购买金钱价']), tokenPrice: Number(row.values['购买代币价'])}));
const dir = mkdtempSync(join(tmpdir(), 'cdtank-tank-textures-'));
const path = join(dir, 'accounts.sqlite');
let store = new AccountStore(path);
try {
  const account = store.open(), other = store.open(), missingProfile = store.open();
  assert.equal(store.roleProfile(account.accountId), undefined);
  assert.equal(store.roleRecords(account.accountId).equipment.size, 0);
  const record = {name: '原战车名称', fields: new Map([
    [0x1c, 73], [0x24, 2], [0x28, 0], [0x2c, 0], [0x30, 0], [0x58, 12345], [0x6c, 3],
  ])};
  const second = {name: '保留战车', fields: new Map(record.fields)};
  second.fields.set(0x1c, 74);
  const base = {name: '保留宠物', fields: new Map([[0, 75], [8, 1]])};
  const foreign = {name: '其他账户战车', fields: new Map(record.fields)};
  foreign.fields.set(0x1c, 91);
  store.replaceRoleRecords(account.accountId, {base: [base], equipment: [record, second]});
  store.replaceRoleRecords(other.accountId, {base: [base], equipment: [record, foreign]});
  store.replaceRoleRecords(missingProfile.accountId, {base: [], equipment: [record]});
  const profile = {bytes: new Uint8Array(0x170).map((_, index) => index & 255),
    strings: ['账户名', '宠物名'] as [string, string]};
  const view = new DataView(profile.bytes.buffer);
  view.setUint32(0x74, 250, true); view.setUint32(0x70, 0x80000001, true);
  store.replaceRoleProfile(account.accountId, profile);
  store.replaceRoleProfile(other.accountId, profile);
  const snapshot = (id = account.accountId) => ({records: store.roleRecords(id), profile: store.roleProfile(id)});
  const otherBefore = snapshot(other.accountId);
  const configure = (textures: OwnedTankTextures) => store.configureTankTextures(account.accountId, 73, textures, rows);
  const unchanged = (action: () => unknown, pattern?: RegExp) => {
    const before = snapshot();
    if (pattern) assert.throws(action, pattern); else assert.throws(action);
    assert.deepEqual(snapshot(), before);
  };
  const paid = {U: 21011, M: 21012, XY: 20013};
  const defaultsAccount = store.open();
  const defaultsRecord = {name: '保留原迷彩', fields: new Map(record.fields)};
  defaultsRecord.fields.set(0x28, 21511);
  store.replaceRoleRecords(defaultsAccount.accountId, {base: [], equipment: [defaultsRecord]});
  store.replaceRoleProfile(defaultsAccount.accountId, profile);
  const defaults = {U: 21511, M: 0, XY: 0};
  const defaultsBefore = snapshot(defaultsAccount.accountId);
  assert.equal(store.configureTankTextures(defaultsAccount.accountId, 73, defaults, rows).result, 0);
  assert.equal(store.configureTankTextures(defaultsAccount.accountId, 73, defaults, []).result, 0);
  assert.equal(store.configureTankTextures(defaultsAccount.accountId, 73, {U: 0, M: 0, XY: 0}, []).result, 0);
  assert.deepEqual(snapshot(defaultsAccount.accountId), defaultsBefore);
  assert.deepEqual(store.configureTankTextures(defaultsAccount.accountId, 73,
    {...defaults, M: 21012}, rows.filter(row => row.recordId !== 21511)), {
    instanceId: 73, textures: {...defaults, M: 21012}, tokens: 200, money: 0x80000001, result: 3,
  });
  for (const invalid of [-1, 1.5, 0x100000000, NaN]) {
    unchanged(() => store.configureTankTextures(account.accountId, invalid, paid, rows));
    for (const part of parts) unchanged(() => configure({...paid, [part]: invalid}));
  }
  unchanged(() => store.configureTankTextures(account.accountId, 999, paid, rows), /不属于/);
  unchanged(() => store.configureTankTextures(account.accountId, 91, paid, rows), /不属于/);
  assert.throws(() => store.configureTankTextures(missingProfile.accountId, 73, paid, rows), /资料/);
  for (const request of [{...paid, U: 10011}, {...paid, U: 21012}, {...paid, U: 21511}, {...paid, U: 99999}]) {
    unchanged(() => configure(request), /不能应用/);
  }
  unchanged(() => store.configureTankTextures(account.accountId, 73, paid,
    rows.map(row => row.recordId === paid.U ? {...row, rarity: 3} : row)), /不能应用/);
  const initial = snapshot();
  assert.deepEqual(configure({U: 0, M: 0, XY: 0}), {instanceId: 73, textures: {U: 0, M: 0, XY: 0},
    tokens: 250, money: 0x80000001, result: 0});
  assert.deepEqual(snapshot(), initial);
  const confirmed = configure(paid);
  assert.deepEqual(confirmed, {instanceId: 73, textures: paid, tokens: 140, money: 0x80000001, result: 3});
  const expectedFields = new Map(record.fields);
  expectedFields.set(0x28, paid.U); expectedFields.set(0x2c, paid.M); expectedFields.set(0x30, paid.XY);
  assert.deepEqual(store.roleRecords(account.accountId).equipment.get(73), {name: record.name, fields: expectedFields});
  assert.deepEqual(store.roleRecords(account.accountId).equipment.get(74), second);
  assert.deepEqual(store.roleRecords(account.accountId).base.get(75), base);
  const expectedBytes = profile.bytes.slice();
  new DataView(expectedBytes.buffer).setUint32(0x74, 140, true);
  assert.deepEqual(store.roleProfile(account.accountId), {bytes: expectedBytes, strings: profile.strings});
  assert.deepEqual(snapshot(other.accountId), otherBefore);
  const afterPaid = snapshot();
  assert.equal(configure(paid).result, 0);
  assert.equal(configure({U: 0, M: 0, XY: 0}).result, 0);
  assert.deepEqual(snapshot(), afterPaid);
  const free = {U: 20011, M: 20012, XY: paid.XY};
  assert.deepEqual(configure(free), {instanceId: 73, textures: free, tokens: 140, money: 0x80000001, result: 3});
  const partial = {U: 0, M: 20012, XY: 0};
  assert.equal(configure(partial).result, 3);
  assert.deepEqual(readOwnedTankTextures(store.roleRecords(account.accountId).equipment.get(73)!), partial);
  const lowProfile = store.roleProfile(account.accountId)!;
  new DataView(lowProfile.bytes.buffer).setUint32(0x74, 109, true);
  store.replaceRoleProfile(account.accountId, lowProfile);
  unchanged(() => configure(paid), /代币余额不足/);
  // The source table has no rarity1 rows; this fixture exercises the recovered money branch.
  const moneyRows = [{recordId: 29991, tankId: 2, part: 'U' as const, rarity: 1,
    moneyPrice: 0x80000002, tokenPrice: 0}];
  unchanged(() => store.configureTankTextures(account.accountId, 73, {U: 29991, M: 0, XY: 0}, moneyRows), /金钱余额不足/);
  const incomplete = {name: record.name, fields: new Map(record.fields)};
  incomplete.fields.delete(0x30);
  store.replaceRoleRecords(account.accountId, {base: [base], equipment: [incomplete, second]});
  unchanged(() => configure(paid), /字段不完整/);
  store.replaceRoleRecords(account.accountId, {base: [base], equipment: [record, second]});
  store.replaceRoleProfile(account.accountId, profile);
  // Fail the second SQL write after the owned record update to prove whole-transaction rollback.
  const database = new DatabaseSync(path);
  database.exec(`CREATE TRIGGER reject_texture_profile BEFORE UPDATE ON role_profiles
    BEGIN SELECT RAISE(ABORT, 'texture profile persistence failed'); END`);
  unchanged(() => configure(paid), /persistence failed/);
  database.exec('DROP TRIGGER reject_texture_profile');
  database.close();
  assert.equal(configure(paid).result, 3);
  const saved = snapshot();
  store.close(); store = new AccountStore(path);
  assert.deepEqual(store.open(account.token), account);
  assert.deepEqual(snapshot(), saved);
  assert.deepEqual(snapshot(other.accountId), otherBefore);
  const unsignedProfile = store.roleProfile(account.accountId)!;
  new DataView(unsignedProfile.bytes.buffer).setUint32(0x74, 0x80000001, true);
  store.replaceRoleProfile(account.accountId, unsignedProfile);
  assert.equal(configure({...paid, U: 21021}).tokens, 0x80000001 - 50);
  writeFileSync('recovery/output/account-tank-textures.json', JSON.stringify({status: 'PASS',
    scope: 'Rebuilt owned-tank qualification and SQLite transaction using recovered request costs and confirmation.',
    sourceRows: rows.length, paidTokens: 110, zeroPrice: true, unchangedNoCharge: true,
    allZeroNoOp: true, partialZeroClear: true, insufficientTokens: true, syntheticMoneyBranch: true,
    ownership: true, definitionAndPart: true, rarityZero: true, invalidRarity: true,
    unchangedUnselectableSlot: true, unchangedMissingCatalogSlot: true, missingProfile: true,
    missingOwnedFields: true, unsignedIdsAndBalances: true, profileOnly8Bytes: true,
    unrelatedRecordsAndStrings: true, accountIsolation: true, rollbackSecondWrite: true, restart: true}, null, 2));
  console.log('PASS: owned tank texture qualification, source prices, atomic charge, rollback, no-op, zeros and restart');
} finally {store.close(); rmSync(dir, {recursive: true, force: true});}
