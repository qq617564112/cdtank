import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {partShopItems, consumableShopItems} from '../apps/server/src/accounts/shop-catalog';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys';

const source: {rows: {values: Record<string, string>}[]} = JSON.parse(
  readFileSync('recovery/output/verified/tables/item.json', 'utf8'));
const products = partShopItems(combatCatalog);
assert.equal(products.length, 74);
assert.deepEqual([8, 9, 10, 11, 12].map(category =>
  products.filter(item => classifyItemId(item.itemTableId) === category).length), [20, 18, 11, 14, 11]);
for (const product of products) {
  const row = source.rows.find(row => Number(row.values.ItemTableID) === product.itemTableId)!.values;
  assert.deepEqual([product.name, product.info, product.iconId, product.moneyPrice, product.tokenPrice],
    [row.ItemName, row.ItemInfo, Number(row.D2), Number(row.ItemMoney), Number(row.ItemCoin)]);
  assert(product.moneyPrice > 0 && product.tokenPrice > 0);
}
assert.deepEqual(consumableShopItems(combatCatalog).map(item => item.itemTableId),
  [1, 2, 3, 4, 5, 6, 7, 8, 12, 2002, 2003, 2004, 2007, 2008, 2009, 2011, 2012, 3003]);
const ammo2004 = consumableShopItems(combatCatalog).find(item => item.itemTableId === 2004)!;
const original2004 = source.rows.find(row => Number(row.values.ItemTableID) === 2004)!.values;
assert.deepEqual([ammo2004.name, ammo2004.info, ammo2004.iconId, ammo2004.moneyPrice, ammo2004.tokenPrice],
  [original2004.ItemName, original2004.ItemInfo, Number(original2004.D2),
    Number(original2004.ItemMoney), Number(original2004.ItemCoin)]);
const zeroPrice = {...combatCatalog, items: combatCatalog.items.map(item => item.itemTableId === 16001
  ? {...item, moneyPrice: 0} : item)};
assert(!partShopItems(zeroPrice).some(item => item.itemTableId === 16001));
writeFileSync('recovery/output/part-shop-catalog.json', JSON.stringify({status: 'PASS_SOURCE_CATALOG_ONLY',
  products: products.map(item => item.itemTableId), categoryCounts: [20, 18, 11, 14, 11],
  scope: 'Original names, information, icons and positive prices; availability is rebuilt. Acquisition and equipped-player effects require ordinary acceptance.'}, null, 2) + '\n');
console.log('PASS 74 source part products, five categories, exact original prices/icons and positive-price eligibility');
