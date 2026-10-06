import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {basename} from 'node:path';

var path = process.argv[2];
assert(path, 'Supply the new ordinary-session raw containing renderTiming');
var raw = JSON.parse(await readFile(path, 'utf8'));
assert.equal(raw.mapId, 2);
assert(Array.isArray(raw.renderTiming) && raw.renderTiming.length === 2);
var summarize = function(values) {
  var sorted = values.filter(Number.isFinite).sort(function(a, b) {return a - b;});
  if (!sorted.length) return {samples: 0};
  var middle = Math.floor(sorted.length * 0.5);
  var median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {samples: sorted.length, median,
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
    maximum: sorted.at(-1)};
};
var sides = raw.renderTiming.map(function(side) {
  assert(!side.error && Array.isArray(side.frames));
  var groups = new Map();
  for (var frame of side.frames) {
    if (frame.phase !== 'PLAYING') continue;
    assert(frame.roomId && frame.round !== undefined);
    var key = JSON.stringify([frame.roomId, frame.round, frame.width, frame.height, frame.hardwareScaling]);
    var group = groups.get(key);
    if (!group) {
      group = {roomId: frame.roomId, round: frame.round, width: frame.width,
        height: frame.height, hardwareScaling: frame.hardwareScaling, frames: []};
      groups.set(key, group);
    }
    group.frames.push(frame);
  }
  return {renderer: side.renderer, recordedFrames: side.frames.length,
    playing: [...groups.values()].map(function(group) {
      var frames = group.frames;
      return {roomId: group.roomId, round: group.round, width: group.width,
        height: group.height, hardwareScaling: group.hardwareScaling, frames: frames.length,
        intervalMs: summarize(frames.map(function(frame) {return frame.intervalMs;})),
        environmentAdvanceMs: summarize(frames.map(function(frame) {return frame.environmentAdvanceMs;})),
        sceneSubmitWallMs: summarize(frames.map(function(frame) {return frame.sceneSubmitMs;})),
        activeMeshes: summarize(frames.map(function(frame) {return frame.activeMeshes;})),
        activeIndices: summarize(frames.map(function(frame) {return frame.activeIndices;}))};
    })};
});
var evidence = {status: 'ACTUAL_MAP02_RENDER_TIMING_OBSERVATION', raw: basename(path),
  rawStatus: raw.status, modeId: raw.modeId, sides,
  interpretation: ['environmentAdvanceMs measures the wrapped ScenePreview.advance wall interval.',
    'sceneSubmitWallMs measures BeforeRender to AfterRender and includes synchronous backend waits; it is not pure CPU or GPU time.',
    'Frame intervals include rendering, presentation and scheduling. These intervals cannot be attributed to a component by subtraction.',
    'gpuTimerAvailable is only a capability flag; no GPU query or GPU duration was collected.',
    'Observed dimensions and finite timings do not establish fluent HD performance or original GPU equivalence.']};
await writeFile('recovery/output/map02-render-timing-actual.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
