import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ReloadProgress} from '../apps/web/src/interface/battle/reload-progress';

interface FrameRow {
  durationSeconds: number;
  totalSeconds: number;
  deltaSeconds: number;
  remainingSeconds: number;
  events: {kind: string; window: number; value: number}[];
}
const evidence: {status: string; crossbarRows: FrameRow[]} =
  JSON.parse(readFileSync('recovery/output/reload-hud-native.json', 'utf8'));
assert.equal(evidence.status, 'PASS');
let priorDuration = -1;
let nativeProgress = 0;
const projection = new ReloadProgress();
for (const row of evidence.crossbarRows) {
  if (row.durationSeconds !== priorDuration) {
    projection.reset();
    priorDuration = row.durationSeconds;
    nativeProgress = 0;
    assert.equal(projection.update({duration: row.durationSeconds, startedAt: 1000}, 1000, 0), 0);
  }
  if (row.events.length) nativeProgress = row.events[0].value;
  assert.equal(projection.update({duration: row.durationSeconds, startedAt: 1000}, 1000, row.deltaSeconds),
    nativeProgress, `native duration ${row.durationSeconds}, delta ${row.deltaSeconds}`);
}
projection.reset();
assert.equal(projection.update({duration: 0.8, startedAt: 0}, 0, 0), 1);
console.log(`PASS: ${evidence.crossbarRows.length} original crossbar frame fractions and idle reset`);
