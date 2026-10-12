import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {applyLocalRolePoseCorrection, type LocalRolePoseCorrectionProvider} from './role-local-pose-correction-sol.js';

interface NativeRow {
  name: string;
  accepted: boolean;
  input: {
    messageState: number;
    command: number;
    receivedPosition: number[];
    receivedTimeSeconds: number;
    receivedMove: number;
    receivedTurn: number;
  };
  look: number[];
  forward: number[];
  cache: string;
  events: {entry: string; selector?: number; value?: number}[];
}
const native = JSON.parse(readFileSync(resolve(__dirname, '../../output/role-local-pose-correction-native.json'), 'utf8')) as {rows: NativeRow[]};

for (const row of native.rows) {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, row.input.command, true);
  view.setUint32(4, row.input.messageState, true);
  view.setFloat32(8, row.input.receivedPosition[0], true);
  view.setFloat32(12, row.input.receivedPosition[2], true);
  for (const [selector, offset] of [[18, 16], [19, 20]]) {
    const direction = row.events.find(event => event.entry === '0x433250' &&
      event.selector === selector);
    view.setInt32(offset, direction?.value ?? 0, true);
  }
  view.setFloat32(24, row.input.receivedTimeSeconds, true);
  view.setFloat32(28, row.input.receivedMove, true);
  view.setFloat32(32, row.input.receivedTurn, true);
  const events: string[] = [];
  let cache = new Uint8Array(36).fill(0xa5);
  let receivedPosition: readonly number[] | undefined;
  let command: number | undefined;
  const expectedCache = Buffer.from(row.cache, 'hex');
  const provider: LocalRolePoseCorrectionProvider = {
    rolePresent: row.name !== 'missing-local-role',
    setCommand(value) {events.push('command'); command = value;},
    setPosition(value) {events.push('position'); receivedPosition = value;},
    setLook(value) {
      events.push('look');
      value.forEach((part, index) => assert.ok(Math.abs(part - row.look[index]) < 1e-7, row.name));
    },
    setForward(value) {
      events.push('forward');
      value.forEach((part, index) => assert.ok(Math.abs(part - row.forward[index]) < 1e-7, row.name));
    },
    publishImmediatePose() {events.push('publish');},
    separateRoleOverlap() {events.push('separate');},
    cacheCommandBytes(value) {
      events.push('cache');
      assert.equal(events.at(-2), 'separate', row.name);
      assert.deepEqual(value, bytes, row.name);
      assert.notEqual(value, bytes, row.name);
      cache = value;
    },
    relativeSeconds() {events.push('clock'); return expectedCache.readFloatLE(24);},
    writeCachedTime(seconds) {
      events.push('write-time');
      new DataView(cache.buffer, cache.byteOffset, cache.byteLength).setFloat32(24, seconds, true);
    },
  };
  assert.equal(applyLocalRolePoseCorrection(bytes, provider), row.accepted, row.name);
  assert.deepEqual(Buffer.from(cache), expectedCache, row.name);
  if (row.accepted) {
    assert.equal(command, row.input.command, row.name);
    assert.deepEqual(receivedPosition, row.input.receivedPosition, row.name);
    assert.deepEqual(events, ['command', 'position', 'look', 'forward', 'publish',
      'separate', 'cache', 'clock', 'write-time'], row.name);
  } else {
    assert.deepEqual(events, [], row.name);
  }
}
console.log(`PASS_LOCAL_POSE_CORRECTION_CONTRACT ${native.rows.length} saved native rows/cache/directions/provider order`);
