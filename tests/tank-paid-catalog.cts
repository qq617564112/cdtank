import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import {AccountTankShop} from '../apps/server/src/accounts/tank-shop';

interface Table {rows: {values: Record<string, string>}[];}
const shops = (JSON.parse(readFileSync('recovery/output/verified/tables/tankshop.json', 'utf8')) as Table).rows
  .map(row => row.values).filter(shop => Number(shop['坦克金钱价']) > 0);
const tanks = new Map((JSON.parse(readFileSync('recovery/output/verified/tables/tank.json', 'utf8')) as Table).rows
  .map(row => [Number(row.values.ID), row.values]));
const dir = mkdtempSync(join(tmpdir(), 'cdtank-tank-paid-catalog-'));
const path = join(dir, 'accounts.sqlite');
const accounts = new AccountStore(path);
const db = new DatabaseSync(path);
const shop = new AccountTankShop(db);
try {
  const owner = accounts.open();
  const payload = new Uint8Array(0x170).map((_, index) => index & 255);
  const view = new DataView(payload.buffer);
  view.setUint32(0x70, 50000, true); view.setUint32(0x74, 987, true);
  accounts.replaceRoleProfile(owner.accountId, {bytes: payload, strings: ['主人', '宠物']});
  db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(owner.accountId, 1, '{}');
  db.prepare('INSERT INTO role_records VALUES (?, ?, ?, ?)').run(owner.accountId, 'base', 2, '{}');
  const query = shop.request(owner.accountId, {operation: 'QUERY'});
  assert.deepEqual(query.tanks.map(tank => tank.tankId), [3, 4, 52, 53, 54, 102, 104, 152, 154, 155]);
  assert.deepEqual(query.tanks, shops.map(source => {
    const tankId = Number(source['坦克ID']), tank = tanks.get(tankId)!;
    assert.equal(source['购买方式'], '2');
    return {tankId, name: tank.TankName, info: tank.TankInfo,
      moneyPrice: Number(source['坦克金钱价']), tokenPrice: Number(source['坦克代币价']),
      textures: {U: Number(source['默认贴图(炮塔)']), M: Number(source['默认贴图(车身)']), XY: Number(source['默认贴图(履带)'])}};
  }));
  const snapshot = () => ({profile: accounts.roleProfile(owner.accountId),
    records: db.prepare('SELECT * FROM role_records ORDER BY instance_id').all(),
    receipts: db.prepare('SELECT * FROM tank_purchases ORDER BY request_id').all()});
  const rejected = (action: () => unknown, pattern: RegExp) => {
    const before = snapshot(); assert.throws(action, pattern); assert.deepEqual(snapshot(), before);
  };
  let money = 50000;
  const purchased = [];
  for (const [index, source] of shops.entries()) {
    const tankId = Number(source['坦克ID']), tank = tanks.get(tankId)!;
    const request = {operation: 'BUY', tankId, currency: 'MONEY', requestId: `tank-paid-${tankId}`} as const;
    const result = shop.request(owner.accountId, request);
    money -= Number(source['坦克金钱价']);
    assert.equal(result.money, money); assert.equal(result.tokens, 987); assert.equal(result.replayed, false);
    const expected = new Map<number, number>();
    for (let offset = 0x1c; offset <= 0x6c; offset += 4) expected.set(offset, 0);
    for (const [offset, value] of [[0x1c, index + 3], [0x24, tankId],
      [0x28, Number(source['默认贴图(炮塔)'])], [0x2c, Number(source['默认贴图(车身)'])],
      [0x30, Number(source['默认贴图(履带)'])], [0x3c, Number(tank.TankAtk)],
      [0x40, Number(tank.TankAtkBonus)], [0x4c, Number(tank.TankDef)], [0x50, Number(tank.TankDefBonus)], [0x6c, Number(tank.TankPartSlot)]]) expected.set(offset, value);
    assert.equal(result.purchased!.name, tank.TankName);
    assert.equal(new Map(result.purchased!.fields).size, 21);
    assert.deepEqual(new Map(result.purchased!.fields), expected);
    assert.deepEqual(accounts.roleRecords(owner.accountId).equipment.get(index + 3), {name: tank.TankName, fields: expected});
    const expectedPayload = payload.slice(); new DataView(expectedPayload.buffer).setUint32(0x70, money, true);
    assert.deepEqual(accounts.roleProfile(owner.accountId), {bytes: expectedPayload, strings: ['主人', '宠物']});
    const beforeReplay = snapshot();
    assert.deepEqual(shop.request(owner.accountId, request), {...result, replayed: true});
    assert.deepEqual(snapshot(), beforeReplay);
    assert.equal(Number(db.prepare('SELECT tank_id FROM tank_purchases WHERE account_id = ? AND request_id = ?')
      .get(owner.accountId, request.requestId)!.tank_id), tankId);
    purchased.push({tankId, instanceId: index + 3, money: result.money, fields: result.purchased!.fields});
    rejected(() => shop.request(owner.accountId, {...request, tankId: tankId === 3 ? 4 : 3}), /已用于不同购买/);
    rejected(() => shop.request(owner.accountId, {...request, currency: 'TOKENS'}), /只能使用金钱/);
  }
  for (const tankId of [1, 2, 0, -1, 3.5, 156]) {
    rejected(() => shop.request(owner.accountId, {operation: 'BUY', tankId, currency: 'MONEY', requestId: 'tank-excluded'}), /出售范围/);
  }
  assert.equal(money, 10500);
  assert.equal(db.prepare("SELECT count(*) AS n FROM role_records WHERE kind = 'equipment'").get()!.n, 10);
  assert.equal(db.prepare('SELECT count(*) AS n FROM tank_purchases').get()!.n, 10);
  assert.equal(db.prepare('SELECT count(*) AS n FROM inventory').get()!.n, 1);
  writeFileSync('recovery/output/tank-paid-catalog.json', JSON.stringify({status: 'PASS',
    scope: 'Ten positive-price mode2 source shop tanks, rebuilt MONEY-only purchase and complete21-field owned equipment; unknown34/6c remain0.',
    query, purchased, sourceValues: true, sourceQuotes: true, sourceZeroTurret: [152, 154, 155],
    sameRequestCrossDefinitionRejected: true, excluded: [1, 2], tokensRejected: true,
    preservedProfileAndInventory: true}, null, 2) + '\n');
  console.log('PASS: ten source paid tanks, exact21 fields/prices/defaults, MONEY purchases, replay and exclusions');
} finally {db.close(); accounts.close(); rmSync(dir, {recursive: true, force: true});}
