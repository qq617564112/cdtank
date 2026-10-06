import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

var rawName = 'browser-map02-full-session-2026-10-05T16-47-57-319Z.json';
var raw = JSON.parse(await readFile('recovery/output/' + rawName, 'utf8'));
assert.equal(raw.status, 'FAIL');
assert.equal(raw.mapId, 2);
assert.equal(raw.rounds.length, 1);
var round = raw.rounds[0];
assert.equal(round.round, 1);
assert.deepEqual(round.final[0].match.result, round.final[1].match.result);
for (var world of round.final) {
  assert.equal(world.phase, 'FINISHED');
  assert.equal(world.remaining, 0);
  assert.equal(world.match.result.reason, 'TIME_LIMIT');
  assert.equal(world.players.length, 4);
}
assert.equal(raw.consistency.commonTicks, 883);
assert.equal(raw.consistency.matchedTicks, 883);
assert.deepEqual(raw.consistency.mismatches, []);

var sides = raw.observed.map(function(observed) {
  var frames = observed.frames.filter(function(frame) {
    return frame.stage === 'round1-1920' && frame.phase === 'PLAYING';
  });
  assert(frames.length > 20);
  for (var frame of frames) {
    assert.equal(frame.width, 1920);
    assert.equal(frame.height, 1080);
    assert.equal(frame.hardwareScaling, 1);
  }
  var deltas = frames.map(function(frame) {return frame.delta;}).sort(function(a, b) {return a - b;});
  var second = observed.transitions.find(function(value) {
    return value.round === 2 && value.phase === 'PLAYING';
  });
  assert(second);
  var states = observed.plantStates.filter(function(value) {return value.sourcePlacementId === '327';});
  for (var number of [1, 2]) {
    assert(states.some(function(value) {
      return value.round === number && value.hidden === false && value.rootEnabled === true && value.owners === 29;
    }));
  }
  var castle = Object.values(observed.castleDraws);
  assert(castle.length > 0);
  for (var row of castle) {
    assert.equal(row.id, '305');
    assert.equal(row.action, 'n1');
    assert(row.count > 0 && row.vertices > 0);
  }
  return {
    frameCount: frames.length,
    frameIntervalMs: {median: deltas[Math.floor(deltas.length * 0.5)],
      p95: deltas[Math.floor(deltas.length * 0.95)], maximum: deltas.at(-1)},
    secondRoundPlaying: {round: second.round, remaining: second.snapshot.remaining},
    plant327: states,
    castle305: castle,
  };
});
var evidence = {
  status: 'FINITE_MAP02_NATURAL_ROUND1_1920_REMATCH_PLAYING_OBSERVATION',
  raw: rawName, rawStatus: raw.status,
  round1: {wallMs: round.wallMs, reason: 'TIME_LIMIT', dualResultExact: true},
  consistency: raw.consistency, sides,
  renderer: 'Headless Chromium ANGLE SwiftShader; frame intervals are observations, not a performance acceptance.',
  limitations: ['Second-round finish, 3840 rendering, normal Leave and scene reentry were not reached.',
    'Plant327 was enabled in both observed rounds; no hidden-to-visible restoration is proved.',
    'Castle305 n1 was drawn; c1/c2/c3/n2 remain uncovered.',
    'Final environment owner/audio lifecycle was not copied by this failed run.'],
};
await writeFile('recovery/output/map02-full-session-first-actual.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
