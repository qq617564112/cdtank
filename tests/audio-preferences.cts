import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDIO_PREFERENCES_KEY, readAudioPreferences, writeAudioPreferences} from
  '../apps/web/src/interface/settings/audio-preferences';

const defaults = {music: 0.5, sound: 0.5};
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8'));
assert.equal(catalog.defaultMusicVolume, defaults.music);
assert.equal(catalog.defaultSoundVolume, defaults.sound);
let stored: string | null = null;
let writes = 0;
const storage = {
  getItem(key: string): string | null {assert.equal(key, AUDIO_PREFERENCES_KEY); return stored;},
  setItem(key: string, value: string): void {
    assert.equal(key, AUDIO_PREFERENCES_KEY);
    stored = value;
    writes++;
  },
};
assert.deepEqual(readAudioPreferences(storage, defaults), {preferences: defaults, storageAvailable: true});
assert.equal(writeAudioPreferences(storage, {music: 0, sound: 1}), true);
assert.deepEqual(readAudioPreferences(storage, defaults).preferences, {music: 0, sound: 1});
for (const value of ['{', 'null', '[]', 'true', '"saved"']) {
  stored = value;
  assert.deepEqual(readAudioPreferences(storage, defaults).preferences, defaults);
}
for (const bad of [-1, 2, null, '0', false]) {
  stored = JSON.stringify({music: bad, sound: 0});
  assert.deepEqual(readAudioPreferences(storage, defaults).preferences, {music: 0.5, sound: 0});
  stored = JSON.stringify({music: 1, sound: bad});
  assert.deepEqual(readAudioPreferences(storage, defaults).preferences, {music: 1, sound: 0.5});
}
const before = writes;
for (const value of [-1, 2, NaN, Infinity]) {
  assert.equal(writeAudioPreferences(storage, {music: value, sound: 0.5}), false);
}
assert.equal(writes, before);
const unavailable = {
  getItem(): never {throw new Error('SecurityError');},
  setItem(): never {throw new Error('QuotaExceededError');},
};
assert.deepEqual(readAudioPreferences(unavailable, defaults), {preferences: defaults, storageAvailable: false});
assert.equal(writeAudioPreferences(unavailable, {music: 0, sound: 0}), false);
console.log('PASS: source defaults, zero/boundary persistence, per-field corrupt fallback and unavailable storage');
