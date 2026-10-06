import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

var rawName = 'browser-castle02-305-2026-10-05T17-20-36-927Z.json';
var raw = JSON.parse(await readFile('recovery/output/' + rawName, 'utf8'));
assert.equal(raw.status, 'PASS');
assert.deepEqual(raw.failures, []);
assert.equal(raw.target.id, 'CASTLE:305');
assert.equal(raw.target.maxHp, 2000);
var transactions = raw.observed.map(function(side) {
  return side.events.filter(function(event) {return ['sceneObjectHit', 'sceneObjectDestroyed'].includes(event.type);});
});
assert.deepEqual(transactions[0], transactions[1]);
assert.equal(transactions[0].filter(function(event) {return event.type === 'sceneObjectHit';}).length, 47);
assert.equal(transactions[0].filter(function(event) {return event.type === 'sceneObjectDestroyed';}).length, 1);
var sides = raw.observed.map(function(side, index) {
  var hp = 2000;
  for (var transaction of side.transactions) {
    assert.equal(transaction.castleId, '305');
    assert.equal(transaction.maxHP, 2000);
    assert.equal(hp - transaction.delta, transaction.currentHP);
    hp = transaction.currentHP;
  }
  assert.equal(hp, 0);
  var actions = ['n1', 'c2', 'n2', 'c3'].map(function(action) {
    var draws = side.draws.filter(function(row) {return row.action === action;});
    assert(draws.length > 0);
    for (var draw of draws) {
      assert.equal(draw.id, '305'); assert.equal(draw.model, 'obj05448');
      assert(draw.vertices > 0); assert.equal(draw.worldMatrix.length, 16);
      assert(draw.worldMatrix.every(Number.isFinite));
    }
    return {action, draws: draws.length, frames: [...new Set(draws.map(function(row) {return row.frame;}))],
      meshes: [...new Set(draws.map(function(row) {return row.mesh;}))]};
  });
  var sounds = raw.soundsAfterLeave[index];
  assert.equal(sounds.length, 53);
  var audio = ['GA48', 'se03', 'se07'].map(function(name) {
    var rows = sounds.filter(function(row) {return row.name === name;});
    assert.equal(rows.length, name === 'GA48' ? 47 : name === 'se03' ? 4 : 2);
    for (var row of rows) {
      assert.equal(row.sourcePlacementId, '305');
      assert.equal(row.transaction.castleId, '305');
      assert(row.handle > 0 && row.src); assert.equal(row.pausedAtFinish, true);
      assert.equal(row.loop, name === 'se03');
      if (name !== 'se03') assert.equal(row.ended, true);
    }
    var peak = Math.max(...rows.map(function(row) {return row.outputPeak;}));
    if (index === 0) assert(peak > 0);
    return {name, voices: rows.length, maximumPeak: peak, stoppedOrEnded: true};
  });
  var cleanup = raw.cleanup[index];
  for (var value of Object.values(cleanup)) assert(!value);
  return {transactions: side.transactions.length, finalHP: hp, actions, audio,
    captures: side.captures, cleanup};
});
var evidence = {status: 'PASS_FINITE_MAP02_CASTLE305_ORDINARY_DAMAGE_ACTIONS_DUAL_TRANSACTIONS_LEAVE',
  raw: rawName, transactions: 48, hits: 47, dualTransactionsExact: true,
  ordinaryInputSamples: raw.inputs.length, sides,
  limitations: ['Host damaged/collapsed whole views are finite; guest independent action pixels are not accepted.',
    'Guest sound output peaks are zero; only host nonzero output is established.',
    'Original source/model proofs are reused; this helper checks new actual records, not original GPU equivalence.',
    'Map02 full-map and HD performance acceptance remain open.']};
await writeFile('recovery/output/castle02-305-actual.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
