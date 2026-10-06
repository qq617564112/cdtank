import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import {AccountPetShop} from '../apps/server/src/accounts/pet-shop';

const dir = mkdtempSync(join(tmpdir(), 'cdtank-pet-purchase-'));
const path = join(dir, 'accounts.sqlite');
const accounts = new AccountStore(path);
let db = new DatabaseSync(path);
let shop = new AccountPetShop(db);
try {
  const owner = accounts.open(), other = accounts.open(), missing = accounts.open();
  const payload = new Uint8Array(0x170).map((_, index) => index & 255);
  const view = new DataView(payload.buffer);
  view.setUint32(0x70, 40000, true); view.setUint32(0x74, 0x80000001, true);
  accounts.replaceRoleProfile(owner.accountId, {bytes: payload, strings: ['主人', '旧宠物']});
  accounts.replaceRoleProfile(other.accountId, {bytes: new Uint8Array(0x170), strings: ['', '']});
  db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(owner.accountId, 1, '{}');
  db.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(owner.accountId, 'equipment', 2, '{}');
  const request = {operation: 'BUY', petId: 2, currency: 'MONEY', requestId: 'pet-buy-001'} as const;
  const snapshot = () => ({profile: accounts.roleProfile(owner.accountId),
    records: db.prepare('SELECT * FROM role_records ORDER BY account_id, kind, instance_id').all(),
    inventory: db.prepare('SELECT * FROM inventory').all(), receipts: db.prepare('SELECT * FROM pet_purchases').all()});
  const rejected = (action: () => unknown, pattern?: RegExp) => {
    const before = snapshot();
    if (pattern) assert.throws(action, pattern); else assert.throws(action);
    assert.deepEqual(snapshot(), before);
  };
  const query = shop.request(owner.accountId, {operation: 'QUERY'});
  assert.deepEqual(query.pets.filter(pet => pet.petId === 2).map(pet => [pet.petId, pet.name, pet.moneyPrice, pet.tokenPrice, pet.maxHp]),
    [[2, '大麦', 3500, 350, 700]]);
  assert.deepEqual(shop.request(missing.accountId, {operation: 'QUERY'}), {pets: query.pets});
  rejected(() => shop.request(owner.accountId, {...request, currency: 'TOKENS'}), /只能使用金钱/);
  for (const petId of [1, 101, -1, 2.5, NaN, 0x100000002]) rejected(() => shop.request(owner.accountId, {...request, petId}));
  rejected(() => shop.request(owner.accountId, {...request, requestId: 'short'}), /请求ID/);
  rejected(() => shop.request(other.accountId, request), /余额不足/);
  rejected(() => shop.request(missing.accountId, request), /资料/);
  rejected(() => shop.request('missing', request), /账户/);
  const purchased = shop.request(owner.accountId, request);
  assert.equal(purchased.money, 36500); assert.equal(purchased.tokens, 0x80000001); assert.equal(purchased.replayed, false);
  const fields = new Map(purchased.purchased!.fields);
  assert.equal(purchased.purchased!.name, '大麦'); assert.equal(fields.size, 31);
  const expected = new Map<number, number>([4, 0, 8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c,
    0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90, 0x74, 0x78].map(offset => [offset, 0]));
  expected.set(0, 3); expected.set(8, 2); expected.set(0x2c, 700); expected.set(0x34, 20); expected.set(0x3c, 8);
  const levels = [0, 0, 0, 0, 0, 0];
  for (let index = 0; index < 6; index++) {
    expected.set(0x44 + index * 4, 10211 + index * 10); expected.set(0x5c + index * 4, levels[index]);
  }
  assert.deepEqual(fields, expected);
  const expectedBytes = payload.slice(); new DataView(expectedBytes.buffer).setUint32(0x70, 36500, true);
  assert.deepEqual(accounts.roleProfile(owner.accountId), {bytes: expectedBytes, strings: ['主人', '旧宠物']});
  assert.equal(db.prepare('SELECT count(*) AS n FROM inventory').get()!.n, 1);
  assert.deepEqual(shop.request(owner.accountId, request), {...purchased, replayed: true});
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_purchases').get()!.n, 1);
  // Failure after debit and owned-record INSERT must also remove the new record.
  db.exec("CREATE TRIGGER fail_pet_receipt BEFORE INSERT ON pet_purchases BEGIN SELECT RAISE(ABORT, 'fixture receipt failure'); END;");
  rejected(() => shop.request(owner.accountId, {...request, requestId: 'pet-buy-002'}), /fixture receipt failure/);
  db.exec('DROP TRIGGER fail_pet_receipt');
  db.exec("CREATE TRIGGER fail_pet_record BEFORE INSERT ON role_records WHEN NEW.kind = 'base' BEGIN SELECT RAISE(ABORT, 'fixture record failure'); END;");
  rejected(() => shop.request(owner.accountId, {...request, requestId: 'pet-buy-002'}), /fixture record failure/);
  db.exec('DROP TRIGGER fail_pet_record');
  const next = shop.request(owner.accountId, {...request, requestId: 'pet-buy-002'});
  assert.equal(next.money, 33000); assert.equal(new Map(next.purchased!.fields).get(0), 4);
  assert.equal(db.prepare("SELECT count(*) AS n FROM role_records WHERE account_id = ? AND kind = 'base'").get(other.accountId)!.n, 0);
  for (let index = 0; index < 7; index++) {
    db.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(owner.accountId, 'base', 10 + index, '{}');
  }
  const tenth = shop.request(owner.accountId, {...request, requestId: 'pet-buy-003'});
  assert.equal(tenth.money, 29500);
  assert.equal(db.prepare("SELECT count(*) AS n FROM role_records WHERE account_id = ? AND kind = 'base'").get(owner.accountId)!.n, 10);
  rejected(() => shop.request(owner.accountId, {...request, requestId: 'pet-buy-004'}), /10只/);
  assert.equal(shop.request(owner.accountId, request).replayed, true);
  db.close(); db = new DatabaseSync(path); shop = new AccountPetShop(db);
  const reopened = shop.request(owner.accountId, request);
  assert.equal(reopened.replayed, true); assert.equal(reopened.money, 29500);
  assert.deepEqual(reopened.purchased, purchased.purchased);
  rejected(() => shop.request(owner.accountId, {...request, requestId: 'pet-buy-004'}), /10只/);
  const ownerBeforeOtherPurchase = accounts.roleProfile(owner.accountId);
  const otherFunded = accounts.roleProfile(other.accountId)!;
  new DataView(otherFunded.bytes.buffer).setUint32(0x70, 3500, true);
  accounts.replaceRoleProfile(other.accountId, otherFunded);
  const otherPurchase = shop.request(other.accountId, request);
  assert.equal(otherPurchase.replayed, false); assert.equal(otherPurchase.money, 0);
  assert.equal(new Map(otherPurchase.purchased!.fields).get(0), 1);
  assert.deepEqual(accounts.roleProfile(owner.accountId), ownerBeforeOtherPurchase);
  // Even after external balance exhaustion the existing receipt still replays.
  const empty = accounts.roleProfile(owner.accountId)!;
  new DataView(empty.bytes.buffer).setUint32(0x70, 0, true); accounts.replaceRoleProfile(owner.accountId, empty);
  assert.equal(shop.request(owner.accountId, request).money, 0);
  writeFileSync('recovery/output/pet-learning-newborn-purchase.json', JSON.stringify({status: 'PASS', query, purchased, next, reopened,
    scope: 'Pet2 MONEY3500 rebuilt complete31-field base purchase; source six skill bases and rebuilt newborn zero ranks are saved without claiming boundGear battle binding.',
    profileOnly4Bytes: true, tokensAndStringsPreserved: true, sharedInstanceAllocation: true,
    replayBeforeCapAndBalance: true, cap10: true, sourceTokenQuoteNotPurchase: true,
    rejectUnchanged: true, accountIsolation: true, recordAndReceiptInsertRollback: true, reopen: true}, null, 2) + '\n');
  console.log('PASS: pet2 atomic MONEY purchase, complete owned base, replay/cap/isolation/reopen and rollback');
} finally {db.close(); accounts.close(); rmSync(dir, {recursive: true, force: true});}
