import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import {AccountPetShop} from '../apps/server/src/accounts/pet-shop';

const source = JSON.parse(readFileSync('recovery/output/verified/tables/pet.json', 'utf8')) as {
  rows: {values: Record<string, string>}[];
};
const definitions = source.rows.map(row => row.values).filter(pet => Number(pet.PetMoney) > 0);
const dir = mkdtempSync(join(tmpdir(), 'cdtank-pet-paid-catalog-'));
const path = join(dir, 'accounts.sqlite');
const accounts = new AccountStore(path);
const db = new DatabaseSync(path);
const shop = new AccountPetShop(db);
try {
  const owner = accounts.open();
  const payload = new Uint8Array(0x170).map((_, index) => index & 255);
  const view = new DataView(payload.buffer);
  view.setUint32(0x70, 50000, true); view.setUint32(0x74, 987, true);
  accounts.replaceRoleProfile(owner.accountId, {bytes: payload, strings: ['主人', '宠物']});
  db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(owner.accountId, 1, '{}');
  db.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(owner.accountId, 'equipment', 2, '{}');
  const query = shop.request(owner.accountId, {operation: 'QUERY'});
  assert.deepEqual(query.pets.map(pet => pet.petId), [2, 3, 4, 5, 102, 103, 104, 105]);
  assert.deepEqual(query.pets, definitions.map(pet => ({petId: Number(pet.ID), name: pet.PetName,
    info: pet.PetInfo, moneyPrice: Number(pet.PetMoney), tokenPrice: Number(pet.PetCoin), maxHp: Number(pet.MaxHP)})));
  const snapshot = () => ({profile: accounts.roleProfile(owner.accountId),
    records: db.prepare('SELECT * FROM role_records ORDER BY instance_id').all(),
    receipts: db.prepare('SELECT * FROM pet_purchases ORDER BY request_id').all()});
  const rejected = (action: () => unknown, pattern: RegExp) => {
    const before = snapshot(); assert.throws(action, pattern); assert.deepEqual(snapshot(), before);
  };
  let money = 50000;
  const purchased = [];
  for (const [index, pet] of definitions.entries()) {
    const petId = Number(pet.ID);
    const request = {operation: 'BUY', petId, currency: 'MONEY', requestId: `pet-paid-${petId}`} as const;
    const result = shop.request(owner.accountId, request);
    money -= Number(pet.PetMoney);
    assert.equal(result.money, money); assert.equal(result.tokens, 987); assert.equal(result.replayed, false);
    const expected = new Map<number, number>([4, 0, 8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c,
      0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90, 0x74, 0x78].map(offset => [offset, 0]));
    expected.set(0, index + 3); expected.set(8, petId);
    expected.set(0x2c, Number(pet.MaxHP)); expected.set(0x34, Number(pet.Critical)); expected.set(0x3c, Number(pet.Lucky));
    for (let skill = 0; skill < 6; skill++) {
      expected.set(0x44 + skill * 4, Number(pet[`Skill${skill}`]));
      expected.set(0x5c + skill * 4, 0);
    }
    assert.equal(result.purchased!.name, pet.PetName);
    assert.equal(new Map(result.purchased!.fields).size, 31);
    assert.deepEqual(new Map(result.purchased!.fields), expected);
    assert.deepEqual(accounts.roleRecords(owner.accountId).base.get(index + 3), {name: pet.PetName, fields: expected});
    const expectedPayload = payload.slice(); new DataView(expectedPayload.buffer).setUint32(0x70, money, true);
    assert.deepEqual(accounts.roleProfile(owner.accountId), {bytes: expectedPayload, strings: ['主人', '宠物']});
    const beforeReplay = snapshot();
    assert.deepEqual(shop.request(owner.accountId, request), {...result, replayed: true});
    assert.deepEqual(snapshot(), beforeReplay);
    const receipt = db.prepare('SELECT pet_id FROM pet_purchases WHERE account_id = ? AND request_id = ?').get(owner.accountId, request.requestId)!;
    assert.equal(Number(receipt.pet_id), petId);
    purchased.push({petId, instanceId: index + 3, money: result.money, fields: result.purchased!.fields});
    rejected(() => shop.request(owner.accountId, {...request, petId: petId === 2 ? 3 : 2}), /已用于不同购买/);
    rejected(() => shop.request(owner.accountId, {...request, currency: 'TOKENS'}), /只能使用金钱/);
  }
  for (const petId of [1, 101, 0, -1, 2.5, 106]) {
    rejected(() => shop.request(owner.accountId, {operation: 'BUY', petId, currency: 'MONEY', requestId: 'pet-excluded'}), /出售范围/);
  }
  assert.equal(money, 16000);
  assert.equal(db.prepare("SELECT count(*) AS n FROM role_records WHERE kind = 'base'").get()!.n, 8);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_purchases').get()!.n, 8);
  assert.equal(db.prepare('SELECT count(*) AS n FROM inventory').get()!.n, 1);
  writeFileSync('recovery/output/pet-paid-catalog.json', JSON.stringify({status: 'PASS',
    scope: 'Eight positive-price source pets, rebuilt MONEY-only purchase and complete31-field owned-base initialization; no original server availability or boundGear binding claim.',
    query, purchased, sourceValues: true, sourceQuotes: true, sameRequestCrossDefinitionRejected: true,
    zeroPriceExcluded: [1, 101], tokensRejected: true, preservedProfileAndInventory: true}, null, 2) + '\n');
  console.log('PASS: eight source paid pets, exact31 fields/prices, atomic MONEY purchases, replay and exclusions');
} finally {db.close(); accounts.close(); rmSync(dir, {recursive: true, force: true});}
