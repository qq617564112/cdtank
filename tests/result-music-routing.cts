import assert from 'node:assert/strict';
import {PageMusic} from '../apps/web/src/match/page-music';

const calls: string[] = [];
const errors: unknown[] = [];
const music = new PageMusic({
  async playPage(page) {calls.push(page);},
  async play(mode, mapId) {calls.push(`map:${mode}:${mapId}`);},
  async playResult(flag) {calls.push(`result:${flag}`);},
  dispose() {calls.push('dispose');},
}, error => errors.push(error));

music.room('PLAYING', 4, 7);
music.room('FINISHED', 4, 7, 1, 1, 'R1');
for (let index = 0; index < 20; index++) music.room('FINISHED', 4, 7, 1, 1, 'R1');
assert.deepEqual(calls, ['map:4:7', 'result:1']);
music.room('PLAYING', 4, 7);
music.room('FINISHED', 4, 7, 1, 2, 'R1');
assert.deepEqual(calls.slice(-2), ['map:4:7', 'result:1']);
music.room('FINISHED', 4, 7, 2, 1, 'R2');
assert.equal(calls.at(-1), 'result:2');
music.room('FINISHED', 4, 7, undefined, 2, 'R2');
assert.equal(calls.at(-1), 'map:4:7', 'draw has no result-track request');
music.lobby();
music.dispose();
music.room('FINISHED', 4, 7, 1, 3, 'R2');
assert.deepEqual(calls.slice(-2), ['lobby', 'dispose']);
assert.deepEqual(errors, []);
console.log('PASS: result routing deduplicates snapshots, restores map on rematch/draw, and isolates room/round');
