import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

const directory = mkdtempSync(join(tmpdir(), 'part-sale-'));
const database = join(directory, 'accounts.sqlite'), accounts = new AccountStore(database), db = new DatabaseSync(database);
const catalog = {items: [{itemTableId: 14003, moneyPrice: 2000}, {itemTableId: 11001, moneyPrice: 600},
  {itemTableId: 12001, moneyPrice: 200}, {itemTableId: 14004, moneyPrice: -2}], dataScales: []} as CombatCatalog;
try {
  const a = accounts.open(), peer = accounts.open(), empty = accounts.open();
  assert.deepEqual(accounts.partSale(empty.accountId, {operation: 'QUERY'}, catalog), {inventory: {records: [], hotkeys: Array(7).fill(0)}, quotes: []});
  const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
  view.setUint32(0x70, 100000, true); view.setUint32(0x74, 77, true);
  view.setUint32(0x148, 1, true); view.setUint32(0x118, 2, true); view.setUint32(0x13c, 3, true);
  view.setUint32(0x11c, 1, true); view.setUint32(0xa4, 5, true); view.setUint32(0xa8, 6, true);
  accounts.replaceRoleProfile(a.accountId, {bytes, strings: ['part sale fixture', 'unchanged']});
  accounts.replaceRoleProfile(peer.accountId, {bytes: Uint8Array.from(bytes), strings: ['peer', '']});
  const row = {instanceId: 1, itemTableId: 14003, ownedQuantity: 109441, battleQuantity: 0, state: 2,
    field8: 999, float24Bits: 0x3f800000, float28Bits: 888, float2cBits: 777};
  for (const record of [row, {...row, instanceId: 2, itemTableId: 11001}, {...row, instanceId: 3, itemTableId: 12001},
    {...row, instanceId: 4, itemTableId: 2002, ownedQuantity: 2, state: 0}, {...row, instanceId: 7, itemTableId: 14004}]) {
    db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(a.accountId, record.instanceId, JSON.stringify(record));
  }
  db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(peer.accountId, 1, JSON.stringify(row));
  db.prepare('INSERT INTO hotkeys VALUES (?, ?, ?)').run(a.accountId, 1, 4);
  const query = () => accounts.partSale(a.accountId, {operation: 'QUERY'}, catalog);
  const initial = query(), peerBefore = accounts.partSale(peer.accountId, {operation: 'QUERY'}, catalog);
  const req = {operation: 'SELL' as const, instanceId: 1, requestId: 'part-sale-0001'};
  assert.equal(initial.quotes.find(q => q.instanceId === 1)!.canSell, true);
  assert.equal(initial.quotes.find(q => q.instanceId === 7)!.price, 2147483647);
  assert.equal(initial.quotes.find(q => q.instanceId === 7)!.canSell, false);
  assert.throws(() => accounts.partSale(a.accountId, {...req, instanceId: 4}, catalog), /分类/);
  assert.throws(() => accounts.partSale(a.accountId, {...req, instanceId: 7}, catalog), /上限/);
  db.exec("CREATE TRIGGER fail_part_sale_receipt BEFORE INSERT ON part_sales BEGIN SELECT RAISE(ABORT, 'receipt failure'); END");
  assert.throws(() => accounts.partSale(a.accountId, req, catalog), /receipt failure/);
  assert.deepEqual(query(), initial);
  db.exec('DROP TRIGGER fail_part_sale_receipt');
  const result = accounts.partSale(a.accountId, req, catalog);
  assert.deepEqual(result.sold, {instanceId: 1, itemTableId: 14003, price: 1000, result: 1});
  assert.equal(result.money, 101000); assert(!result.inventory.records.some(r => r.instanceId === 1));
  assert.deepEqual(result.inventory.records, initial.inventory.records.filter(r => r.instanceId !== 1));
  assert.deepEqual(result.inventory.hotkeys, initial.inventory.hotkeys);
  const expected = Uint8Array.from(bytes), expectedView = new DataView(expected.buffer);
  expectedView.setUint32(0x70, 101000, true); expectedView.setUint32(0x148, 0, true);
  assert.deepEqual(result.profile!.bytes, [...expected]); assert.deepEqual(result.profile!.strings, ['part sale fixture', 'unchanged']);
  assert.deepEqual(accounts.partSale(peer.accountId, {operation: 'QUERY'}, catalog), peerBefore);
  assert.equal(accounts.partSale(a.accountId, req, catalog).replayed, true); assert.equal(query().money, 101000);
  assert.throws(() => accounts.partSale(a.accountId, {...req, instanceId: 2}, catalog), /不同实例/);
  assert.throws(() => accounts.partSale(a.accountId, {...req, requestId: 'part-missing-0001'}, catalog), /不属于/);
  const hat = accounts.partSale(a.accountId, {...req, instanceId: 2, requestId: 'part-hat-0001'}, catalog);
  assert.equal(new DataView(Uint8Array.from(hat.profile!.bytes).buffer).getUint32(0x118, true), 0);
  const mark = accounts.partSale(a.accountId, {...req, instanceId: 3, requestId: 'part-mark-0001'}, catalog);
  assert.equal(new DataView(Uint8Array.from(mark.profile!.bytes).buffer).getUint32(0x13c, true), 0);
  assert.equal(mark.money, 101400);
  const maxBytes = Uint8Array.from(mark.profile!.bytes); new DataView(maxBytes.buffer).setUint32(0x70, 999999999, true);
  accounts.replaceRoleProfile(a.accountId, {bytes: maxBytes, strings: ['part sale fixture', 'unchanged']});
  const maxBefore = query(); assert.throws(() => accounts.partSale(a.accountId, {...req, instanceId: 7, requestId: 'part-overflow-0001'}, catalog), /上限/);
  assert.deepEqual(query(), maxBefore);
  writeFileSync('recovery/output/part-sale-transaction.json', JSON.stringify({status: 'PASS_PART_SALE_WHOLE_INSTANCE_UNSIGNED_PRICE_SUCCESS1_ATOMIC_PROFILE_CLEAR_REPLAY',
    wholeDurationMinutesRemoved: 109441, salePrice: 1000, successResult: 1, receiptRollback: true,
    equippedSaleAccepted: true, qualifiedRefsCleared: [0x148,0x118,0x13c], otherAccountPreserved: true,
    otherProfileFieldsPreserved: true, stackCategoryRejected: true, unsignedHalfPrice: 2147483647}, null, 2)+'\n');
  console.log('PASS part sale transaction');
} finally {db.close(); accounts.close(); rmSync(directory, {recursive: true, force: true});}
