import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

var rawName = 'browser-map02-full-session-2026-10-05T16-55-46-820Z.json';
var raw = JSON.parse(await readFile('recovery/output/' + rawName, 'utf8'));
assert.equal(raw.status, 'PASS');
assert.deepEqual(raw.failures, []);
assert.equal(raw.mapId, 2);
assert.equal(raw.modeId, 1);
assert.equal(raw.rounds.length, 2);
var rounds = raw.rounds.map(function(round) {
  assert.deepEqual(round.final[0].match.result, round.final[1].match.result);
  for (var world of round.final) {
    assert.equal(world.phase, 'FINISHED');
    assert.equal(world.match.round, round.round);
    assert.equal(world.match.result.reason, 'TIME_LIMIT');
    assert.equal(world.remaining, 0);
  }
  return {round: round.round, wallMs: round.wallMs, reason: 'TIME_LIMIT', dualResultExact: true};
});
assert.equal(raw.consistency.commonTicks, raw.consistency.matchedTicks);
assert(raw.consistency.commonTicks > 0);
assert.deepEqual(raw.consistency.mismatches, []);
assert.notEqual(raw.roomId, raw.reentryRoomId);
for (var world of raw.reentry) {
  assert.equal(world.roomId, raw.reentryRoomId);
  assert.equal(world.phase, 'PLAYING');
  assert.equal(world.mapId, 2);
  assert.equal(world.match.scenePlants.length, 29);
  assert.equal(world.match.sceneObjects.filter(function(value) {return value.id.startsWith('ENV:');}).length, 60);
}
assert.equal(raw.cleanups.length, 2);
for (var cleanup of raw.cleanups) {
  assert.equal(cleanup.cleanup.length, 2);
  for (var side of cleanup.cleanup) {
    for (var key of ['players', 'breakables', 'plantRoots', 'plantSnapshots', 'effects', 'sceneVoices', 'treeVoices', 'battleVoices']) {
      assert.equal(side[key], 0);
    }
    assert.equal(side.plantRound, null);
    assert.equal(side.world, null);
    assert.equal(side.inputIntervalActive, false);
  }
}
var sides = raw.environment.map(function(environment, index) {
  assert.equal(environment.sounds.length, 2);
  var identities;
  for (var load of environment.sounds) {
    var ids = load.voices.map(function(voice) {return voice.id;}).sort();
    assert.deepEqual(ids, ['318', '319', '338', '339']);
    for (var voice of load.voices) {
      assert.equal(voice.paused, false);
      assert.equal(voice.loop, true);
      assert.equal(voice.playing, true);
    }
    if (identities) assert.deepEqual(ids, identities);
    identities = ids;
  }
  assert(environment.sounds[1].revision > environment.sounds[0].revision);
  var clears = environment.lifecycle.filter(function(row) {return row.kind === 'soundClear' && row.oldAudioPaused.length === 4;});
  assert.equal(clears.length, 2);
  for (var clear of clears) {
    assert.equal(clear.voices, 0);
    assert.equal(clear.master, false);
    assert.equal(clear.map, false);
    assert(clear.oldAudioPaused.every(function(voice) {return voice.paused;}));
  }
  assert(clears[0].at < environment.sounds[1].at);
  for (var kind of ['plantDispose', 'waterDispose']) {
    var disposals = environment.lifecycle.filter(function(row) {return row.kind === kind;});
    assert.equal(disposals.length, 2);
    for (var row of disposals) {
      if (kind === 'plantDispose') {
        assert.equal(row.owners, 0); assert.equal(row.resources, 0); assert.equal(row.materialOwner, false);
      } else {
        assert.equal(row.containers, 0); assert.equal(row.textures, 0); assert.equal(row.water, false); assert.equal(row.wave, false);
      }
    }
  }
  assert.equal(environment.plants.length, 58);
  var firstIds = environment.plants.slice(0, 29).map(function(row) {return row.id;}).sort();
  assert.equal(new Set(firstIds).size, 29);
  assert.deepEqual(environment.plants.slice(29).map(function(row) {return row.id;}).sort(), firstIds);
  var frames = raw.observed[index].frames;
  var timing = [['round1-1920', 1920, 1080], ['round2-3840', 3840, 2160]].map(function(scope) {
    var samples = frames.filter(function(frame) {
      return frame.stage === scope[0] && frame.phase === 'PLAYING' && frame.width === scope[1] && frame.height === scope[2];
    });
    assert(samples.length >= 20);
    for (var frame of samples) {
      assert.equal(frame.width, scope[1]); assert.equal(frame.height, scope[2]); assert.equal(frame.hardwareScaling, 1);
    }
    var deltas = samples.map(function(frame) {return frame.delta;}).sort(function(a, b) {return a - b;});
    return {stage: scope[0], width: scope[1], height: scope[2], frames: samples.length,
      frameIntervalMs: {median: deltas[Math.floor(deltas.length * 0.5)], p95: deltas[Math.floor(deltas.length * 0.95)], maximum: deltas.at(-1)}};
  });
  var resolutionTransitions = frames.filter(function(frame) {
    return frame.stage === 'round1-1920' && frame.phase === 'PLAYING' && frame.width === 3840;
  });
  return {plantLoads: 2, plantsPerLoad: 29, soundLoads: environment.sounds, soundClears: clears,
    lifecycle: environment.lifecycle, plant327: raw.observed[index].plantStates, resolutionTransitions, timing};
});
var evidence = {status: 'PASS_FINITE_MAP02_TWO_NATURAL_ROUNDS_NORMAL_REENTRY_ENVIRONMENT_CLEAR_HD_DIMENSIONS',
  raw: rawName, rounds, consistency: raw.consistency, rooms: [raw.roomId, raw.reentryRoomId],
  cleanups: raw.cleanups.map(function(row) {return {label: row.label, cleanup: row.cleanup};}), sides,
  limitations: ['ANGLE SwiftShader frame timings do not establish hardware GPU or fluent HD performance.',
    'Plant327 remained enabled/unhidden; hidden-to-visible round restoration was not exercised.',
    'Castle305 damaged/destroyed actions and original GPU equivalence remain open.',
    'This scope is mode1; modes2/3 rendered coverage and active-room reconnect are separate.']};
await writeFile('recovery/output/map02-full-session-actual.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
