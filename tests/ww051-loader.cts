import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {EffectSound} from '../apps/web/src/audio/effect-sound';
const native = JSON.parse(readFileSync('recovery/output/ww051-loader-native.json', 'utf8'));
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8'));
assert.equal(native.reference, 'ww051');
assert.equal(native.calls[0].exists, false);
assert.equal(native.loaderReached, false);
assert.equal(native.descriptorValid, false);
assert.equal(native.finished, true);
assert.equal(native.stopReachedDevice, false);
assert(!catalog.sounds.some((sound: {name: string}) => sound.name.toLowerCase() === native.reference));
const sound = new EffectSound();
sound.configure(catalog);
// No browser Audio constructor exists here: attempting media playback would fail.
const handle = sound.play(native.reference, native.parameter);
assert.equal(sound.finished(handle), native.finished);
sound.stop(handle);
assert.equal(sound.finished(handle), true);
const next = sound.play(native.reference, native.parameter);
sound.update();
assert.equal(sound.finished(next), true);
sound.clear();
writeFileSync('recovery/output/ww051-loader-runtime.json', JSON.stringify({status: 'PASS',
  reference: native.reference, noMediaPlayback: true, finished: true, stopNoMedia: true,
  scope: 'Current actual missing source reference, native gate/finish/stop evidence versus real EffectSound. Web numeric handle allocation differs from native invalid descriptor identity; no audio content or successful decoding claim.'}, null, 2));
console.log('PASS: current missing ww051 completes without media playback and stopping matches native boundary');
