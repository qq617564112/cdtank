import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TSBuffer} from 'tsbuffer';
import {AccountStore} from '../apps/server/src/account-store';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {consumableShopItems, partShopItems} from '../apps/server/src/accounts/shop-catalog';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ResShop} from '../apps/shared/protocols/PtlShop';

const native: {rows: {itemTableId: number; stored: Record<string, number>}[]} = JSON.parse(
  readFileSync('recovery/output/shop-item-price-count-loader-native.json', 'utf8'));
const table: {rows: {values: Record<string, string>}[]} = JSON.parse(
  readFileSync('recovery/output/verified/tables/item.json', 'utf8'));
const items = [...consumableShopItems(combatCatalog), ...partShopItems(combatCatalog)];
for (const item of items) {
  const original = table.rows.find(row => Number(row.values.ItemTableID) === item.itemTableId)!.values;
  assert.deepEqual([item.getMethod, item.durable],
    [Number(original.GGet) >>> 0, Number(original.Durable) >>> 0]);
}
for (const row of native.rows) {
  const item = items.find(item => item.itemTableId === row.itemTableId);
  if (!item) continue;
  assert.deepEqual([item.moneyPrice, item.tokenPrice, item.getMethod, item.durable],
    [row.stored['0xec'], row.stored['0xf0'], row.stored['0xf4'], row.stored['0xf8']]);
}
const directory = mkdtempSync(join(tmpdir(), 'cdtank-shop-source-fields-'));
const store = new AccountStore(join(directory, 'accounts.sqlite'));
try {
  const account = store.open();
  const before = store.inventory(account.accountId);
  const response = store.shop(account.accountId, items, {operation: 'QUERY'});
  const buffer = new TSBuffer(serviceProto.types);
  const encoded = buffer.encode(response, 'PtlShop/ResShop');
  assert(encoded.isSucc);
  const decoded = buffer.decode<ResShop>(encoded.buf, 'PtlShop/ResShop');
  assert(decoded.isSucc);
  assert.deepEqual(decoded.value.items, response.items);
  assert.deepEqual(store.inventory(account.accountId), before);
  const samples = [1, 8, 2002, 2003, 2007, 17061].map(id => decoded.value.items.find(item => item.itemTableId === id)!);
  assert(samples.every(Boolean));
  writeFileSync('recovery/output/shop-source-fields-contract.json', JSON.stringify({
    status: 'PASS_ORIGINAL_FIELDS_QUERY_WIRE_ONLY', products: items.length, samples,
    source: 'shop-item-price-count-loader-native.json',
    scope: 'Original GGet/Durable values through catalog, ordinary QUERY and TSBuffer; no BUY quantity or eligibility change.',
  }, null, 2) + '\n');
  console.log(`PASS ${items.length} original Shop getMethod/durable fields and QUERY wire`);
} finally {
  store.close();
  rmSync(directory, {recursive: true, force: true});
}
