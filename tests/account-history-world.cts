import assert from 'node:assert/strict';
import {rmSync, writeFileSync} from 'node:fs';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';
import {accountMatchHistory, type CommittedMatch} from '../apps/server/src/settlement/history';

const database = 'recovery/output/account-history-browser.sqlite';
for (const suffix of ['', '-wal', '-shm']) rmSync(database + suffix, {force: true});
let store = new AccountStore(database);
let now = Date.now();
const ownerAccount = store.open(), observerAccount = store.open();
const identities = new Map([['history-owner', ownerAccount.accountId], ['history-observer', observerAccount.accountId]]);
const failures: unknown[] = [];
const history = accountMatchHistory(store, identities, error => failures.push(error));
const committed: CommittedMatch[] = [];
const world = new World(() => now, {onMatchCommitted: match => {
  committed.push(match);
  history.committed(match);
}});
try {
  const owner = world.createAndJoin('history-owner', 4, 7, 'Account history', 'Player', 1);
  for (let index = 0; index < 3; index++) world.manageCpu(owner.playerId, 1, 'ADD');
  world.configureAutopilot(owner.playerId, 1, true);
  world.ready(owner.playerId, 1);
  let shots = 0, hits = 0, deaths = 0;
  for (let round = 1; round <= 2; round++) {
    for (let tick = 0; tick < 7000 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
      now += 50;
      const step = world.step(50);
      shots += step.events.filter(event => event.type === 'fire').length;
      hits += step.events.filter(event => event.type === 'hit').length;
      deaths += step.events.filter(event => event.type === 'death').length;
    }
    const snapshot = world.snapshot(owner.roomId)!;
    assert.equal(snapshot.phase, 'FINISHED');
    assert.equal(committed.length, round);
    const saved = store.history(ownerAccount.accountId);
    assert.equal(saved.total, round);
    const record = saved.records[0];
    assert.deepEqual(record.result, snapshot.match!.result!.players.find(player => player.id === owner.playerId));
    assert.equal(record.mode, snapshot.mode);
    assert.equal(record.mapId, 7);
    assert.equal(record.round, round);
    assert.equal(record.endedAt, snapshot.match!.result!.endedAt);
    assert.equal(store.history(observerAccount.accountId).total, 0);
    const before = JSON.stringify(saved);
    history.committed(committed.at(-1)!); // Duplicate frozen notification.
    for (let repeat = 0; repeat < 5; repeat++) {now += 50; world.step(50); history.flush();}
    assert.equal(JSON.stringify(store.history(ownerAccount.accountId)), before);
    if (round === 1) world.rematch(owner.playerId, 1);
  }
  assert(shots > 0 && hits > 0);
  assert.equal(history.pendingCount, 0);
  assert.equal(failures.length, 0);
  world.leave(owner.playerId);
  const records = store.history(ownerAccount.accountId);
  assert.equal(records.total, 2);
  assert.equal(records.records[0].round, 2);
  store.close(); store = new AccountStore(database);
  assert.equal(store.open(ownerAccount.token).accountId, ownerAccount.accountId);
  assert.deepEqual(store.history(ownerAccount.accountId), records);
  const observer = store.open(observerAccount.token);
  assert.equal(store.history(observer.accountId).total, 0);
  writeFileSync('recovery/output/account-history-world.json', JSON.stringify({status: 'PASS',
    ordinaryCpuRounds: 2, shots, hits, deaths, committedCallbacks: committed.length,
    duplicateCallbacksIgnored: 2, records, outsiderRecords: 0, restartRecovered: true,
    scope: 'Normal Ready and owned Autopilot with three CPUs; natural two-round combat, frozen result mapped to owner account, no CPU records or state injection.'}, null, 2));
  writeFileSync('recovery/output/account-history-browser-fixture.json', JSON.stringify({
    token: ownerAccount.token, expectedCount: 2}));
  // Separate explicit write-failure seam: only storage is interrupted; the
  // captured battle outcome and identity must survive session removal.
  const retryDatabase = 'recovery/output/account-history-write-retry.sqlite';
  for (const suffix of ['', '-wal', '-shm']) rmSync(retryDatabase + suffix, {force: true});
  const retryStore = new AccountStore(retryDatabase);
  try {
    const retryAccount = retryStore.open();
    const retryIdentities = new Map([['history-owner', retryAccount.accountId]]);
    let rejectWrites = true;
    const original = retryStore.recordMatchHistory.bind(retryStore);
    retryStore.recordMatchHistory = (match, participants) => {
      if (rejectWrites) throw new Error('Explicit unavailable storage fixture');
      return original(match, participants);
    };
    const retries = accountMatchHistory(retryStore, retryIdentities, () => {});
    retries.committed({...committed[0], roomId: 'failure-fixture'});
    assert.equal(retries.pendingCount, 1);
    assert.equal(retryStore.history(retryAccount.accountId).total, 0);
    retryIdentities.clear(); rejectWrites = false;
    retries.flush();
    assert.equal(retries.pendingCount, 0);
    assert.equal(retryStore.history(retryAccount.accountId).total, 1);
    writeFileSync('recovery/output/account-history-write-retry.json', JSON.stringify({status: 'PASS',
      failedWritePending: 1, retryAfterIdentityRemoval: true, finalTotal: 1,
      scope: 'Explicit database write failure fixture, separate from natural match DB; no battle-state injection. Frozen account bindings survive disconnect map removal until in-process retry.'}, null, 2));
  } finally {retryStore.close();}
  console.log('PASS: natural CPU two rounds, exact account results, duplicate finish immunity, restart and frozen write retry');
} finally {store.close();}
