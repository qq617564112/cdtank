import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {BattleMusic} from '../apps/web/src/audio/battle-music';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8'));
const interactions = new Map<string, Set<() => void>>();
class Media {
  loop = false;
  preload = '';
  hidden = false;
  dataset: Record<string, string> = {};
  volume = 1;
  paused = true;
  currentTime = 0;
  src = '';
  loads = 0;
  plays = 0;
  removed = false;
  listeners = new Map<string, () => void>();
  addEventListener(name: string, listener: () => void) {this.listeners.set(name, listener);}
  removeEventListener(name: string) {this.listeners.delete(name);}
  async play() {this.paused = false; this.plays++;}
  pause() {this.paused = true;}
  load() {this.loads++; this.currentTime = 0;}
  removeAttribute(name: string) {assert.equal(name, 'src'); this.src = '';}
  remove() {this.removed = true;}
}
const media: Media[] = [];
let fetchCatalog: () => Promise<unknown> = async () => catalog;
Object.assign(globalThis, {
  document: {createElement: () => {const value = new Media(); media.push(value); return value;},
    body: {append() {}}},
  window: {
    addEventListener: (name: string, listener: () => void) => {
      if (!interactions.has(name)) interactions.set(name, new Set());
      interactions.get(name)!.add(listener);
    },
    removeEventListener: (name: string, listener: () => void) => {interactions.get(name)?.delete(listener);},
  },
  fetch: async () => ({ok: true, json: () => fetchCatalog()}),
});

async function main(): Promise<void> {
  const subject = new BattleMusic();
  const audio = media[0];
  await subject.play(1, 7);
  subject.setVolume(0.25);
  await subject.playResult(1);
  assert.equal(audio.dataset.musicId, '190');
  assert.equal(audio.src, '/audio/music/UIM08.mp3');
  assert.equal(audio.loop, false);
  assert.equal(audio.volume, 0.25);
  audio.currentTime = 2;
  const plays = audio.plays;
  const loads = audio.loads;
  await subject.playResult(1);
  assert.equal(audio.currentTime, 2);
  assert.equal(audio.loads, loads);
  assert.equal(audio.plays, plays);
  audio.paused = true;
  audio.listeners.get('ended')!();
  assert.equal(audio.dataset.state, 'ended');
  for (const listener of interactions.get('pointerdown')!) listener();
  await subject.playResult(1);
  assert.equal(audio.plays, plays, 'finished once-track cannot restart on interaction or duplicate result');
  await subject.playResult(2);
  assert.equal(audio.dataset.musicId, '191');
  assert.equal(audio.src, '/audio/music/UIM09.mp3');
  assert.equal(audio.loop, false);
  await subject.play(1, 7);
  assert.equal(audio.loop, true, 'normal rematch restores map loop');
  await subject.playPage('lobby');
  assert.equal(audio.dataset.musicId, '183');
  assert.equal(audio.loop, true);
  subject.dispose();
  assert(audio.removed && audio.paused && !audio.src);
  assert.equal(audio.listeners.size, 0);
  assert.equal(interactions.get('pointerdown')!.size, 0);
  assert.equal(interactions.get('keydown')!.size, 0);
  let resolveCatalog: (value: unknown) => void = () => {};
  fetchCatalog = () => new Promise(resolve => {resolveCatalog = resolve;});
  const late = new BattleMusic();
  const pending = late.playResult(1);
  await Promise.resolve();
  late.dispose();
  resolveCatalog(catalog);
  await pending;
  assert.equal(media[1].plays, 0);
  assert.equal(media[1].src, '');
  writeFileSync('recovery/output/result-music-consumer.json', JSON.stringify({
    status: 'PASS_RESULT_MUSIC_MODULE_ONLY', selection: {'1': '190/UIM08', '2': '191/UIM09'},
    once: true, endedDuplicateAndInteractionSilent: true, rematchAndLeaveRestoreLoop: true,
    volumeRetained: true, lateDisposedRequestSilent: true, listenersReleased: true,
    scope: 'Recording media only; formal result-field semantic mapping and ordinary audio output are separate.'}, null, 2) + '\n');
  console.log('PASS_RESULT_MUSIC_MODULE_ONLY: original flags/once/end/no replay/map/Leave/dispose');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
