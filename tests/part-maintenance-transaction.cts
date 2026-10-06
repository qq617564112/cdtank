import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {calculatePartMaintenanceCost} from '../apps/shared/combat/part-maintenance';

const directory = mkdtempSync(join(tmpdir(), 'part-maintenance-'));
const database = join(directory, 'accounts.sqlite'), accounts = new AccountStore(database), db = new DatabaseSync(database);
const catalog = {items: [{itemTableId: 14003, moneyPrice: 2000, tokenPrice: 200, breakMode: 1},
  {itemTableId: 14004, moneyPrice: 2000, tokenPrice: 200, breakMode: 3}], dataScales: [{id: 48, maximum: 50}]} as CombatCatalog;
try {
  const a = accounts.open(), empty = accounts.open();
  assert.deepEqual(accounts.partMaintenance(empty.accountId, {operation: 'QUERY'}, catalog), {parts: [], inventory: {records: [], hotkeys: Array(7).fill(0)}});
  const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
  view.setUint32(0x70, 500000, true); view.setUint32(0x74, 1000, true); view.setUint32(0x118, 1, true);
  accounts.replaceRoleProfile(a.accountId, {bytes, strings: ['part fixture', '']});
  const record = {instanceId: 1, itemTableId: 14003, ownedQuantity: 1, battleQuantity: 0, state: 2,
    field8: 888, float24Bits: 0x3f800000, float28Bits: 1234, float2cBits: 5678};
  for (const r of [record, {...record, instanceId: 2, itemTableId: 14004}, {...record, instanceId: 3, ownedQuantity: 367200}]) {
    db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(a.accountId, r.instanceId, JSON.stringify(r));
  }
  const query = () => accounts.partMaintenance(a.accountId, {operation: 'QUERY'}, catalog);
  const initial = query(), request = {operation: 'MAINTAIN' as const, instanceId: 1, days: 1 as const, currency: 1 as const, requestId: 'part-maintain-0001'};
  assert.deepEqual(initial.parts[0].quotes.map(q => [q.cost, q.displayCost]), [[40,'4'],[200,'20'],[400,'40'],[20000,'20000'],[100000,'100000'],[200000,'200000']]);
  assert.throws(() => accounts.partMaintenance(a.accountId, {...request, instanceId: 2}, catalog), /不能维修/);
  assert.throws(() => accounts.partMaintenance(a.accountId, {...request, instanceId: 3}, catalog), /255/);
  assert.throws(() => accounts.partMaintenance(a.accountId, {...request, instanceId: 77}, catalog), /不属于/);
  db.exec("CREATE TRIGGER fail_part_receipt BEFORE INSERT ON part_maintenance BEGIN SELECT RAISE(ABORT, 'receipt failure'); END");
  assert.throws(() => accounts.partMaintenance(a.accountId, request, catalog), /receipt failure/);
  assert.deepEqual(query(), initial);
  db.exec('DROP TRIGGER fail_part_receipt');
  const result = accounts.partMaintenance(a.accountId, request, catalog);
  assert.equal(result.money, 480000); assert.equal(result.tokens, 1000);
  assert.deepEqual(result.inventory.records[0], {...record, ownedQuantity: 1441});
  const finalBytes = Uint8Array.from(bytes); new DataView(finalBytes.buffer).setUint32(0x70, 480000, true);
  assert.deepEqual(result.profile!.bytes, [...finalBytes]);
  assert.deepEqual(result.inventory.records.slice(1), initial.inventory.records.slice(1));
  assert.equal(accounts.partMaintenance(a.accountId, request, catalog).replayed, true);
  assert.equal(query().money, 480000);
  assert.throws(() => accounts.partMaintenance(a.accountId, {...request, days: 7}, catalog), /不同维修/);
  const beforeInsufficient = query();
  assert.throws(() => accounts.partMaintenance(empty.accountId, request, catalog), /尚未建立/);
  view.setUint32(0x74, 0, true); accounts.replaceRoleProfile(a.accountId, {bytes, strings: ['part fixture', '']});
  const noTokens = query();
  assert.throws(() => accounts.partMaintenance(a.accountId, {...request, requestId: 'part-no-tokens', currency: 0}, catalog), /余额不足/);
  assert.deepEqual(query(), noTokens);
  assert.equal(calculatePartMaintenanceCost({itemMoney: 0x7fffffff, itemCoin: 0, moneyWeekMultiplier: 1, currency: 1, days: 1}), 429496729);
  assert.equal(calculatePartMaintenanceCost({itemMoney: 0xffffffff, itemCoin: 0, moneyWeekMultiplier: 1, currency: 1, days: 1}), 858993459);
  writeFileSync('recovery/output/part-maintenance-transaction.json', JSON.stringify({status: 'PASS_PART_MAINTENANCE_ATOMIC_RAW_MINUTES_QUOTES_GATES_REPLAY',
    remainingMinutes: 1441, money: beforeInsufficient.money, preservedOtherInventory: true, rollback: true, breakGate: true, capGate: true, insufficient: true}, null, 2)+'\n');
  console.log('PASS part maintenance transaction');
} finally {db.close(); accounts.close(); rmSync(directory, {recursive: true, force: true});}
