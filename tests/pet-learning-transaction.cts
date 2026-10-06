import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

const directory = mkdtempSync(join(tmpdir(), 'pet-learning-transaction-'));
const database = join(directory, 'accounts.sqlite');
const accounts = new AccountStore(database);
const db = new DatabaseSync(database);
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
try {
  const owner = accounts.open(), empty = accounts.open();
  assert.deepEqual(accounts.petSkillLearning(empty.accountId, {operation: 'QUERY'}, catalog), {owned: {base: [], equipment: []}, quotes: []});
  assert.equal(accounts.roleProfile(empty.accountId), undefined);
  const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
  view.setUint32(0x70, 10000, true); view.setUint32(0x80, 400, true);
  accounts.replaceRoleProfile(owner.accountId, {bytes, strings: ['学习夹具', '']});
  const buy = accounts.petShop(owner.accountId, {operation: 'BUY', petId: 2, currency: 'MONEY', requestId: 'learning-purchase'});
  const fields = new Map(buy.purchased!.fields), instanceId = fields.get(0)!;
  assert.deepEqual(Array.from({length: 6}, (_, slot) => fields.get(0x5c + slot * 4)), [0, 0, 0, 0, 0, 0]);
  const snapshot = () => ({profile: accounts.roleProfile(owner.accountId),
    records: db.prepare('SELECT * FROM role_records').all(), receipts: db.prepare('SELECT * FROM pet_skill_learning').all()});
  const request = {operation: 'LEARN', instanceId, slot: 4, requestId: 'learning-passive'} as const;
  db.exec("CREATE TRIGGER abort_learning_receipt BEFORE INSERT ON pet_skill_learning BEGIN SELECT RAISE(ABORT, 'receipt fixture'); END;");
  const before = snapshot();
  assert.throws(() => accounts.petSkillLearning(owner.accountId, request, catalog), /receipt fixture/);
  assert.deepEqual(snapshot(), before);
  db.exec('DROP TRIGGER abort_learning_receipt');
  const learned = accounts.petSkillLearning(owner.accountId, request, catalog);
  assert.equal(learned.points, 200);
  assert.deepEqual(learned.learned, {instanceId, slot: 4, skillId: 10251, rank: 1, cost: 200});
  const confirmed = snapshot();
  assert.equal(accounts.petSkillLearning(owner.accountId, request, catalog).replayed, true);
  assert.deepEqual(snapshot(), confirmed);
  for (const rejected of [{...request, slot: 0}, {...request, requestId: 'learning-capped'},
    {...request, instanceId: instanceId + 100, requestId: 'learning-not-owned'}]) {
    assert.throws(() => accounts.petSkillLearning(owner.accountId, rejected, catalog));
    assert.deepEqual(snapshot(), confirmed);
  }
  // A purchased-record replay remains the original purchase receipt; current ownership holds learned rank.
  assert.equal(new Map(accounts.petShop(owner.accountId, {operation: 'BUY', petId: 2, currency: 'MONEY', requestId: 'learning-purchase'}).purchased!.fields).get(0x6c), 0);
  assert.equal(accounts.roleRecords(owner.accountId).base.get(instanceId)!.fields.get(0x6c), 1);
  writeFileSync('recovery/output/pet-learning-transaction.json', JSON.stringify({status: 'PASS_ATOMIC_PET_LEARNING_ROLLBACK_REPLAY_NEWBORN_EMPTY_QUERY',
    pointFixture: 400, earnedPoints: false, learned: learned.learned, points: learned.points}, null, 2) + '\n');
} finally {
  db.close(); accounts.close(); rmSync(directory, {recursive: true, force: true});
}
