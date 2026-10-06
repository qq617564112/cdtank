import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';
import type {ReqShop, ShopItem} from '../apps/shared/protocols/PtlShop';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

const items: ShopItem[] = [{itemTableId: 2001, name: '饲料', info: 'table1 fixture', iconId: 1,
  moneyPrice: 10, tokenPrice: 10}];
const directory = mkdtempSync(join(tmpdir(), 'cdtank-shop-'));
const path = join(directory, 'accounts.sqlite');
let store = new AccountStore(path);
try {
  const account = store.open(), other = store.open(), missing = store.open();
  const profile = {bytes: new Uint8Array(0x170).map((_, index) => index & 255),
    strings: ['原账户名', '原宠物名'] as [string, string]};
  const view = new DataView(profile.bytes.buffer);
  view.setUint32(0x70, 0x80000001, true); view.setUint32(0x74, 100, true);
  store.replaceRoleProfile(account.accountId, profile);
  store.replaceRoleProfile(other.accountId, profile);
  const original: InventoryWireRecord = {instanceId: 1, itemTableId: 2001, ownedQuantity: 4,
    battleQuantity: 2, state: 2, field8: 9, float24Bits: 0x7fc01234,
    float28Bits: 0x80000000, float2cBits: 0xffffffff};
  store.replaceInventory(account.accountId, [original, {...original, instanceId: 0xffffffff}]);
  store.assign(account.accountId, 1, 1);
  store.replaceRoleRecords(account.accountId, {
    base: [{name: '保留宠物', fields: new Map([[0, 2], [8, 99]])}],
    equipment: [{name: '保留战车', fields: new Map([[0x1c, 3], [0x24, 2]])}],
  });
  const snapshot = (id = account.accountId) => ({profile: store.roleProfile(id),
    inventory: store.inventory(id), roles: store.roleRecords(id)});
  const otherBefore = snapshot(other.accountId);
  const request: ReqShop = {operation: 'BUY', itemTableId: 2001, quantity: 2,
    currency: 'MONEY', requestId: 'purchase_0001'};
  const buy = (changes: Partial<ReqShop> = {}) => store.shop(account.accountId, items, {...request, ...changes});
  const unchanged = (action: () => unknown, pattern?: RegExp) => {
    const before = snapshot();
    if (pattern) assert.throws(action, pattern); else assert.throws(action);
    assert.deepEqual(snapshot(), before);
  };
  assert.deepEqual(store.shop(account.accountId, items, {operation: 'QUERY'}),
    {items, money: 0x80000001, tokens: 100});
  assert.deepEqual(store.shop(missing.accountId, items, {operation: 'QUERY'}), {items});
  assert.deepEqual(store.inventory(missing.accountId).records, []);
  assert.throws(() => store.shop('nonexistent', items, {operation: 'QUERY'}), /不存在/);
  assert.throws(() => store.shop('nonexistent', items, request), /不存在/);
  assert.throws(() => store.shop(missing.accountId, items, request), /资料/);
  for (const quantity of [undefined, 0, -1, 11, 1.5, NaN]) unchanged(() => buy({quantity}));
  for (const requestId of [undefined, '', 'short', 'a'.repeat(81), 'abcdefgh!', 'abcdefgh\n', '中文abcdefgh']) {
    unchanged(() => buy({requestId}));
  }
  for (const itemTableId of [undefined, 0, -1, 1.5, 0x100000000, 2002]) unchanged(() => buy({itemTableId}));
  unchanged(() => buy({currency: 'INVALID' as ReqShop['currency']}));
  unchanged(() => buy({operation: 'INVALID' as ReqShop['operation']}));
  const initial = snapshot();
  const paid = buy();
  const receipt: InventoryWireRecord = {instanceId: 4, itemTableId: 2001, ownedQuantity: 2,
    battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
  assert.deepEqual(paid, {items, purchased: receipt, money: 0x80000001 - 20, tokens: 100, replayed: false});
  const expectedBytes = profile.bytes.slice();
  const expectedView = new DataView(expectedBytes.buffer);
  expectedView.setUint32(0x70, 0x80000001 - 20, true);
  assert.deepEqual(store.roleProfile(account.accountId), {bytes: expectedBytes, strings: profile.strings});
  assert.deepEqual(store.inventory(account.accountId), {...initial.inventory,
    records: [original, receipt, {...original, instanceId: 0xffffffff}]});
  assert.deepEqual(store.roleRecords(account.accountId), initial.roles);
  assert.deepEqual(buy(), {...paid, replayed: true});
  for (const changes of [{quantity: 3}, {itemTableId: 2002}, {currency: 'TOKENS' as const}]) {
    unchanged(() => buy(changes), /不同购买/);
  }
  const tokenPaid = buy({quantity: 10, currency: 'TOKENS', requestId: 'purchase_0002'});
  assert.equal(tokenPaid.tokens, 0);
  assert.equal(tokenPaid.money, paid.money);
  assert.equal(tokenPaid.purchased!.instanceId, 5);
  assert.equal(tokenPaid.purchased!.ownedQuantity, 10);
  expectedView.setUint32(0x74, 0, true);
  assert.deepEqual(store.roleProfile(account.accountId), {bytes: expectedBytes, strings: profile.strings});
  unchanged(() => buy({currency: 'TOKENS', requestId: 'shortage_tokens'}), /代币余额不足/);
  const lowProfile = store.roleProfile(account.accountId)!;
  new DataView(lowProfile.bytes.buffer).setUint32(0x70, 9, true);
  store.replaceRoleProfile(account.accountId, lowProfile);
  unchanged(() => buy({quantity: 1, requestId: 'shortage_money'}), /金钱余额不足/);
  store.replaceRoleProfile(account.accountId, {bytes: expectedBytes, strings: profile.strings});
  assert(store.consumeItem(account.accountId, 4, 2, 2001));
  const consumed = snapshot();
  assert.deepEqual(buy(), {...paid, tokens: 0, replayed: true});
  assert.deepEqual(store.shop(account.accountId, [], request), {...paid, items: [], tokens: 0, replayed: true});
  assert.deepEqual(snapshot(), consumed);
  assert.equal(store.inventory(account.accountId).records.find(row => row.instanceId === 4)!.ownedQuantity, 1);

  // Fail after the debit, then after both debit and grant; neither leaves a ledger receipt.
  const database = new DatabaseSync(path);
  for (const table of ['inventory', 'shop_purchases']) {
    database.exec(`CREATE TRIGGER reject_shop BEFORE INSERT ON ${table}
      BEGIN SELECT RAISE(ABORT, 'shop persistence failed'); END`);
    unchanged(() => buy({requestId: `rollback_${table}`}), /shop persistence failed/);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM shop_purchases WHERE request_id = ?')
      .get(`rollback_${table}`)!.count, 0);
    database.exec('DROP TRIGGER reject_shop');
  }
  const retried = buy({requestId: 'rollback_shop_purchases'});
  assert.equal(retried.replayed, false);
  assert.equal(retried.purchased!.instanceId, 6);
  assert.deepEqual(snapshot(other.accountId), otherBefore);
  // Identical request IDs are independent for different authenticated accounts.
  const otherPaid = store.shop(other.accountId, items, request);
  assert.equal(otherPaid.replayed, false);
  assert.equal(otherPaid.purchased!.instanceId, 1);
  const saved = snapshot(), otherSaved = snapshot(other.accountId);
  database.close();
  store.close(); store = new AccountStore(path);
  assert.deepEqual(store.open(account.token), account);
  assert.deepEqual(snapshot(), saved);
  assert.deepEqual(snapshot(other.accountId), otherSaved);
  const replayed = buy();
  assert.equal(replayed.replayed, true);
  assert.deepEqual(replayed.purchased, receipt);
  assert.equal(replayed.money, retried.money);
  assert.equal(replayed.tokens, 0);
  unchanged(() => buy({quantity: 1}), /不同购买/);
  assert.deepEqual(store.shop(missing.accountId, items, {operation: 'QUERY'}), {items});
  console.log('PASS: shop prices, separate owned grant, byte preservation, isolation, rollback and persistent idempotency');
} finally {
  store.close(); rmSync(directory, {recursive: true, force: true});
}
