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
  addEventListener() {}
  removeEventListener() {}
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
await subject.playPage('lobby');
assert.equal(audio.dataset.musicId, '183');
assert.equal(audio.src, '/audio/music/UIM01.mp3');
assert(audio.loop && !audio.paused);
audio.currentTime = 17;
const loads = audio.loads;
const plays = audio.plays;
await subject.playPage('lobby');
assert.equal(audio.currentTime, 17);
assert.equal(audio.loads, loads);
assert.equal(audio.plays, plays);
subject.setVolume(0);
await subject.playPage('waiting');
assert.equal(audio.dataset.musicId, '184');
assert.equal(audio.src, '/audio/music/UIM02.mp3');
assert.equal(audio.volume, 0);
await subject.play(1, 7);
assert.equal(audio.dataset.musicId, String(catalog.maps.find((r: {mode: number; mapId: number}) => r.mode === 1 && r.mapId === 7).musicId));
assert.equal(audio.volume, 0);
await subject.playPage('lobby');
subject.dispose();
assert(audio.removed && audio.paused);
assert.equal(audio.src, '');
assert.equal(interactions.get('pointerdown')!.size, 0);
assert.equal(interactions.get('keydown')!.size, 0);
await subject.playPage('waiting');
assert.equal(audio.src, '');

let resolveCatalog: (value: unknown) => void = () => {};
fetchCatalog = () => new Promise(resolve => {resolveCatalog = resolve;});
const late = new BattleMusic();
const pending = late.playPage('lobby');
await Promise.resolve();
late.dispose();
resolveCatalog(catalog);
await pending;
assert.equal(media[1].src, '');
assert.equal(media[1].plays, 0);
assert(media[1].removed);

fetchCatalog = async () => catalog;
const latest = new BattleMusic();
await Promise.all([latest.playPage('lobby'), latest.playPage('waiting')]);
assert.equal(media[2].dataset.musicId, '184');
assert.equal(media[2].plays, 1);
latest.stop();
assert.equal(media[2].src, '');
latest.dispose();
writeFileSync('recovery/output/page-music-consumer.json', JSON.stringify({
  status: 'PASS_MODULE_LIFECYCLE_ONLY', pages: {lobby: '183/UIM01', waiting: '184/UIM02'},
  sameTrackPreservesTime: true, changeStopsPrevious: true, mutedAcrossTransitions: true,
  latestPendingSelectionWins: true, disposedLateLoadSilent: true, listenersReleased: true,
  fixture: 'Recording HTML media and catalog fetch; no browser playback or waveform assertion.'}, null, 2) + '\n');
console.log('PASS_MODULE_LIFECYCLE_ONLY: page selection/same-track/volume/latest load/dispose');

}
void main().catch(error => {console.error(error); process.exitCode = 1;});
