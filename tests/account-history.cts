import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import type {HistoryMatch} from '../apps/server/src/accounts/history';
import type {ResultPlayer} from '../apps/shared/protocols/MsgRoomSnapshot';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-history-'));
const path = join(directory, 'accounts.sqlite');
let store = new AccountStore(path);
try {
  const first = store.open();
  const second = store.open();
  const empty = store.open();
  const firstResult: ResultPlayer = {id: 'p1', name: '玩家甲', team: 0, rank: 1,
    kills: 8, deaths: 3, objectivesDestroyed: 2, combatScore: 100, outcomeBonus: 20,
    totalScore: 120, outcome: 'WIN'};
  const secondResult: ResultPlayer = {...firstResult, id: 'p2', name: '玩家乙', rank: 2,
    kills: 3, deaths: 8, combatScore: 40, outcomeBonus: 0, totalScore: 40, outcome: 'LOSE'};
  const match: HistoryMatch = {matchId: 'server-a:room1', round: 1,
    mode: 2, mapId: 7, endedAt: 1000, reason: 'TIME_LIMIT'};
  const participants = [{accountId: first.accountId, result: firstResult},
    {accountId: second.accountId, result: secondResult}];
  assert.equal(store.recordMatchHistory(match, participants), true);
  assert.deepEqual(store.history(first.accountId).records, [{...match, result: firstResult}]);
  assert.deepEqual(store.history(second.accountId).records, [{...match, result: secondResult}]);
  assert.equal(store.history(empty.accountId).total, 0);
  assert.equal(store.recordMatchHistory(match, participants), false);
  assert.equal(store.history(first.accountId).total, 1);
  // An invalid later participant must undo the earlier participant and match marker.
  const next = {...match, round: 2, endedAt: 2000};
  assert.throws(() => store.recordMatchHistory(next, [participants[0],
    {accountId: 'missing-account', result: secondResult}]), /账户不存在/);
  assert.equal(store.history(first.accountId).total, 1);
  assert.equal(store.recordMatchHistory(next, participants), true);
  const third = {...match, round: 3, endedAt: 3000, reason: 'OBJECTIVE' as const};
  // Duplicate account bindings fail atomically rather than silently overwriting results.
  assert.throws(() => store.recordMatchHistory(third, [participants[0], participants[0]]));
  assert.equal(store.history(first.accountId).total, 2);
  assert.equal(store.recordMatchHistory(third, participants), true);
  assert.deepEqual(store.history(first.accountId, 1, 1), {
    records: [{...next, result: firstResult}], total: 3, offset: 1, limit: 1,
  });
  assert.equal(store.history(first.accountId, 3, 50).records.length, 0);
  for (const [offset, limit] of [[-1, 20], [0.5, 20], [0, 0], [0, 51], [0, 1.5]]) {
    assert.throws(() => store.history(first.accountId, offset, limit), /分页/);
  }
  const saved = store.history(first.accountId);
  store.close();
  store = new AccountStore(path);
  assert.equal(store.open(first.token).accountId, first.accountId);
  assert.deepEqual(store.history(first.accountId), saved);
  assert.equal(store.recordMatchHistory(third, participants), false);
  assert.equal(store.history(second.accountId).total, 3);
  const fourth = {...match, matchId: 'server-b:room1', endedAt: 4000};
  assert.equal(store.recordMatchHistory(fourth, participants), true);
  assert.equal(store.history(first.accountId).records[0].matchId, fourth.matchId);
  const report = {passed: true, allPlayerAtomicity: true, duplicateIdempotence: true,
    accountIsolation: true, pagination: true, restartRecovery: true,
    serverSessionKeys: true, recordsPerAccount: store.history(first.accountId).total};
  writeFileSync('recovery/output/account-history.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  store.close();
  rmSync(directory, {recursive: true, force: true});
}
