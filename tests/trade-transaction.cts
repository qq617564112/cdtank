import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import type {TradeOffer} from '../apps/shared/protocols/PtlTrade';

const directory = mkdtempSync(join(tmpdir(), 'trade-transaction-'));
const database = join(directory, 'accounts.sqlite'), accounts = new AccountStore(database), db = new DatabaseSync(database);
try {
  const a = accounts.open(), b = accounts.open(), missing = accounts.open();
  assert.equal(accounts.tradeAccount(missing.accountId).wallet, undefined);
  for (const [id, money, originality, points] of [[a.accountId, 1000, 50, 200], [b.accountId, 2000, 100, 300]] as const) {
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setUint32(0x70, money, true); view.setUint32(0x7c, originality, true); view.setUint32(0x80, points, true); view.setUint32(0xa4, 2, true);
    accounts.replaceRoleProfile(id, {bytes, strings: ['原子交易夹具', '']});
  }
  const item = (instanceId: number, ownedQuantity: number) => ({instanceId, ownedQuantity, itemTableId: 1, battleQuantity: 0, state: 0,
    field8: 0, float24Bits: 0x3f000000, float28Bits: 0x3f800000, float2cBits: 0});
  accounts.replaceInventory(a.accountId, [item(1, 10)]); accounts.replaceInventory(b.accountId, [item(1, 2)]);
  const fields = new Map<number, number>([[0, 2], [8, 2], [0x2c, 700]]);
  for (let i = 0; i < 6; i++) {fields.set(0x44 + i * 4, 10211 + i * 10); fields.set(0x5c + i * 4, i);}
  accounts.replaceRoleRecords(a.accountId, {base: [{name: 'pet fixture', fields}], equipment: []});
  accounts.replaceRoleRecords(b.accountId, {base: [{name: 'recipient retained pet', fields: new Map(fields)}], equipment: []});
  const offers: [TradeOffer, TradeOffer] = [{money: 300, originality: 10, skillPoints: 70,
    records: [{kind: 'item', instanceId: 1, quantity: 3}, {kind: 'pet', instanceId: 2}]},
    {money: 500, originality: 25, skillPoints: 100, records: []}];
  const prepared = offers.map((offer, i) => accounts.prepareTrade(i ? b.accountId : a.accountId, offer)) as
    [ReturnType<AccountStore['prepareTrade']>, ReturnType<AccountStore['prepareTrade']>];
  const before = () => [accounts.tradeAccount(a.accountId), accounts.tradeAccount(b.accountId)];
  const initial = before();
  db.exec("CREATE TRIGGER abort_trade_receipt BEFORE INSERT ON trade_receipts BEGIN SELECT RAISE(ABORT, 'trade receipt fixture'); END;");
  assert.throws(() => accounts.settleTrade('transaction-fixture', [a.accountId, b.accountId], prepared), /trade receipt fixture/);
  assert.deepEqual(before(), initial);
  db.exec('DROP TRIGGER abort_trade_receipt');
  accounts.settleTrade('transaction-fixture', [a.accountId, b.accountId], prepared);
  const completed = before();
  assert.deepEqual(completed[0].wallet, {money: 1200, originality: 65, skillPoints: 230});
  assert.deepEqual(completed[1].wallet, {money: 1800, originality: 85, skillPoints: 270});
  assert.equal(completed[0].inventory.records[0].ownedQuantity, 7);
  assert.equal(completed[1].inventory.records[0].ownedQuantity, 5);
  assert.equal(completed[0].owned.base.length, 0);
  const received = new Map(completed[1].owned.base.find(record => record.name === 'pet fixture')!.fields);
  assert.equal(received.get(0), 3);
  assert.equal(new DataView(Uint8Array.from(completed[0].profile!.bytes).buffer).getUint32(0xa4, true), 0);
  assert.equal(new DataView(Uint8Array.from(completed[1].profile!.bytes).buffer).getUint32(0xa4, true), 2);
  for (const [offset, value] of fields) if (offset !== 0) assert.equal(received.get(offset), value);
  accounts.settleTrade('transaction-fixture', [a.accountId, b.accountId], prepared);
  assert.deepEqual(before(), completed);
  assert.equal(db.prepare('SELECT count(*) AS n FROM trade_receipts').get()!.n, 1);
  assert.throws(() => accounts.settleTrade('transaction-fixture', [b.accountId, a.accountId], prepared), /不同内容/);
  assert.throws(() => accounts.prepareTrade(a.accountId, {...offers[0], money: 99999}), /余额不足/);
  assert.deepEqual(before(), completed);
  writeFileSync('recovery/output/trade-transaction.json', JSON.stringify({status: 'PASS_ATOMIC_TRADE_SCALARS_PARTIAL_STACK_FULL_PET_ROLLBACK_REPLAY',
    fixtureOnly: true, wallets: completed.map(account => account.wallet), stackCounts: [7, 5], profileRawOriginality: '0x7c'}, null, 2) + '\n');
} finally {db.close(); accounts.close(); rmSync(directory, {recursive: true, force: true});}
