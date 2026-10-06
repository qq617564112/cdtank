import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

const directory = mkdtempSync(join(tmpdir(), 'stack-item-sale-'));
const path = join(directory, 'accounts.sqlite');
let accounts = new AccountStore(path);
const db = new DatabaseSync(path);
const catalog = {items: [{itemTableId: 3003, moneyPrice: 10, battleUseMax: 1},
  {itemTableId: 1, moneyPrice: 10, battleUseMax: 10}, {itemTableId: 2, moneyPrice: -2, battleUseMax: 10},
  {itemTableId: 14003, moneyPrice: 2000, battleUseMax: 0}]} as CombatCatalog;
try {
  const a = accounts.open(), peer = accounts.open(), empty = accounts.open();
  assert.deepEqual(accounts.stackItemSale(empty.accountId, {operation: 'QUERY'}, catalog), {quotes: [], inventory: {records: [], hotkeys: Array(7).fill(0)}});
  const bytes = new Uint8Array(0x170); new DataView(bytes.buffer).setUint32(0x70, 10000, true);
  new DataView(bytes.buffer).setUint32(0x148, 1, true);
  accounts.replaceRoleProfile(a.accountId, {bytes, strings: ['sale fixture', 'preserved']});
  accounts.replaceRoleProfile(peer.accountId, {bytes, strings: ['peer', '']});
  const record = {instanceId: 1, itemTableId: 3003, ownedQuantity: 3, battleQuantity: 0, state: 0,
    field8: 12, float24Bits: 99, float28Bits: 88, float2cBits: 77};
  accounts.replaceInventory(a.accountId, [record, {...record, instanceId: 2, itemTableId: 1, ownedQuantity: 12},
    {...record, instanceId: 3, itemTableId: 14003}, {...record, instanceId: 4, itemTableId: 2}]);
  accounts.replaceInventory(peer.accountId, [record]);
  accounts.assign(a.accountId, 1, 1); accounts.assign(a.accountId, 1, 2); accounts.assign(a.accountId, 2, 4);
  const query = () => accounts.stackItemSale(a.accountId, {operation: 'QUERY'}, catalog);
  const initial = query(), peerBefore = accounts.stackItemSale(peer.accountId, {operation: 'QUERY'}, catalog);
  const req = {operation: 'SELL' as const, instanceId: 1, quantity: 1, requestId: 'stack-sale-partial'};
  for (const quantity of [0, -1, 1.5, 0x1000000, 4]) assert.throws(() => accounts.stackItemSale(a.accountId, {...req, quantity}, catalog), /数量/);
  assert.throws(() => accounts.stackItemSale(a.accountId, {...req, instanceId: 3}, catalog), /分类/);
  assert.equal(initial.quotes.find(row => row.instanceId === 4)!.unitPrice, 2147483647);
  assert.throws(() => accounts.stackItemSale(a.accountId, {...req, instanceId: 4}, catalog), /上限/);
  db.exec("CREATE TRIGGER fail_stack_receipt BEFORE INSERT ON stack_item_sales BEGIN SELECT RAISE(ABORT, 'receipt failure'); END");
  assert.throws(() => accounts.stackItemSale(a.accountId, req, catalog), /receipt failure/);
  assert.deepEqual(query(), initial); db.exec('DROP TRIGGER fail_stack_receipt');
  const partial = accounts.stackItemSale(a.accountId, req, catalog);
  assert.deepEqual(partial.sold, {instanceId: 1, itemTableId: 3003, quantity: 1, price: 5, result: 2});
  assert.deepEqual(partial.inventory.records.find(row => row.instanceId === 1), {...record, ownedQuantity: 2, battleQuantity: 1});
  assert.deepEqual(partial.inventory.hotkeys, initial.inventory.hotkeys);
  const expected = [...bytes]; expected.splice(0x70, 4, ...new Uint8Array(new Uint32Array([10005]).buffer));
  assert.deepEqual(partial.profile!.bytes, expected);
  assert(accounts.stackItemSale(a.accountId, req, catalog).replayed);
  assert.throws(() => accounts.stackItemSale(a.accountId, {...req, quantity: 2}, catalog), /不同实例或数量/);
  const fullReq = {...req, quantity: 2, requestId: 'stack-sale-full'};
  db.exec("CREATE TRIGGER fail_full_receipt BEFORE INSERT ON stack_item_sales BEGIN SELECT RAISE(ABORT, 'full receipt failure'); END");
  const beforeFull = query(); assert.throws(() => accounts.stackItemSale(a.accountId, fullReq, catalog), /full receipt failure/);
  assert.deepEqual(query(), beforeFull); db.exec('DROP TRIGGER fail_full_receipt');
  const full = accounts.stackItemSale(a.accountId, fullReq, catalog);
  assert.equal(full.money, 10015); assert(!full.inventory.records.some(row => row.instanceId === 1));
  assert.deepEqual(full.inventory.hotkeys, [0,0,0,2,0,0,0]);
  assert.equal(new DataView(Uint8Array.from(full.profile!.bytes).buffer).getUint32(0x148, true), 1);
  assert.deepEqual(full.inventory.records, initial.inventory.records.filter(row => row.instanceId !== 1));
  assert(accounts.stackItemSale(a.accountId, fullReq, catalog).replayed);
  assert.deepEqual(accounts.stackItemSale(peer.accountId, {operation: 'QUERY'}, catalog), peerBefore);
  const consumable = accounts.stackItemSale(a.accountId, {...req, instanceId: 2, quantity: 3, requestId: 'stack-sale-item'}, catalog);
  assert.equal(consumable.inventory.records.find(row => row.instanceId === 2)!.battleQuantity, 9);
  assert.equal(consumable.inventory.hotkeys[3], 2);
  accounts.close(); accounts = new AccountStore(path); assert.deepEqual(query(), {...consumable, sold: undefined, replayed: undefined});
  assert.equal(db.prepare('SELECT count(*) AS n FROM stack_item_sales').get()!.n, 3);
  writeFileSync('recovery/output/stack-item-sale-transaction.json', JSON.stringify({status: 'PASS_STACK_ITEM_SALE_PARTIAL_FULL_SUCCESS2_ATOMIC_HOTKEY_BATTLE_QUANTITY_REPLAY',
    partialRemaining: 2, partialBattleQuantity: 1, fullMoney: 10015, duplicateHotkeysCleared: true,
    unrelatedProfileReferencesPreserved: true, partialAndFullRollback: true, consumablePartialBattleQuantity: 9,
    unsignedPrice: 2147483647, positive24BitQuantity: true, otherAccountPreserved: true, reopenedAccountEqual: true}, null, 2)+'\n');
  console.log('PASS stack item sale transaction');
} finally {db.close(); accounts.close(); rmSync(directory, {recursive: true, force: true});}
