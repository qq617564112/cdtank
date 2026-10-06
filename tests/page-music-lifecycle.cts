import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {PageMusic} from '../apps/web/src/match/page-music';

async function main(): Promise<void> {
  const calls: string[] = [], errors: unknown[] = [];
  const music = new PageMusic({
    async playPage(page) {calls.push(page);},
    async play(mode, mapId) {calls.push(`map:${mode}:${mapId}`);},
    async playResult(flag) {calls.push(`result:${flag}`);},
    dispose() {calls.push('dispose');},
  }, error => errors.push(error));
  music.lobby(); music.lobby();
  music.room('WAITING', 1, 7); music.room('WAITING', 1, 7);
  music.room('PLAYING', 1, 7); music.room('PLAYING', 1, 7);
  music.room('FINISHED', 1, 7);
  music.room('WAITING', 1, 7); music.room('PLAYING', 1, 7);
  music.lobby(); music.dispose(); music.dispose(); music.lobby();
  music.room('PLAYING', 1, 7);
  assert.deepEqual(calls, ['lobby', 'waiting', 'map:1:7', 'waiting', 'map:1:7', 'lobby', 'dispose']);
  assert.equal(errors.length, 0);

  let rejectLobby!: (error: Error) => void;
  const delayed = new PageMusic({
    playPage: () => new Promise<void>((_, reject) => {rejectLobby = reject;}),
    async play() {}, async playResult() {}, dispose() {},
  }, error => errors.push(error));
  delayed.lobby(); delayed.room('PLAYING', 1, 7);
  rejectLobby(new Error('old page'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 0);
  delayed.lobby(); delayed.dispose(); rejectLobby(new Error('disposed page'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 0);
  writeFileSync('recovery/output/page-music-lifecycle.json', JSON.stringify({
    status: 'PASS_PAGE_ROUTING_MODULE_ONLY', calls,
    unchangedSnapshotsContinue: true, finishedKeepsCurrentMap: true,
    rematchReentersWaitingTrack: true, staleErrorsSuppressed: true, disposeOnce: true,
    scope: 'Page routing with a media-player fixture; actual original MP3 playback verified separately.',
  }, null, 2) + '\n');
  console.log('PASS_PAGE_ROUTING_MODULE_ONLY');
}
void main();
