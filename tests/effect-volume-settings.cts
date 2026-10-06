import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {EffectSound} from '../apps/web/src/audio/effect-sound';
import {EffectSkillSound, type SkillSoundCatalog} from '../apps/web/src/audio/effect-skill-sound';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import {EffectSoundNodeState} from '../apps/web/src/render/effects/runtime/effect-sound-node';

class AudioBoundary extends EventTarget {
  volume = 1;
  loop = false;
  paused = true;
  constructor(readonly src: string) {super();}
  play(): Promise<void> {this.paused = false; return Promise.resolve();}
  pause(): void {this.paused = true;}
}
function audioNode(): object {
  return {connect: () => {}, disconnect: () => {}, gain: {value: 1},
    positionX: {value: 0}, positionY: {value: 0}, positionZ: {value: 0},
    orientationX: {value: 0}, orientationY: {value: 0}, orientationZ: {value: 0}};
}
class AudioContextBoundary {
  state = 'running';
  close(): Promise<void> {this.state = 'closed'; return Promise.resolve();}
  destination = {};
  listener = Object.fromEntries(['position', 'forward', 'up'].flatMap(name =>
    ['X', 'Y', 'Z'].map(axis => [`${name}${axis}`, {value: 0}])));
  createGain(): object {return audioNode();}
  createPanner(): object {return audioNode();}
  createMediaElementSource(): object {return audioNode();}
}
const globals = ['Audio', 'AudioContext', 'window'].map(name =>
  ({name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name)}));
Object.defineProperty(globalThis, 'Audio', {value: AudioBoundary, configurable: true});
Object.defineProperty(globalThis, 'AudioContext', {value: AudioContextBoundary, configurable: true});
Object.defineProperty(globalThis, 'window', {value: {addEventListener: () => {}, removeEventListener: () => {}}, configurable: true});

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as SkillSoundCatalog;
assert.ok(catalog.sounds.some(sound => sound.name === 'GA15'));
const engine = new NullEngine();
const scene = new Scene(engine);
try {
  const camera = new FreeCamera('camera', Vector3.Zero(), scene);
  for (const initialVolume of [0, .375]) {
    const runtime = new EffectRuntime(scene, camera);
    const owners = runtime as unknown as {sound: EffectSound; skillSound: EffectSkillSound};
    const type4 = owners.sound as unknown as {voices: Map<number, {audio: AudioBoundary}>};
    const skill = owners.skillSound as unknown as {
      master: {gain: {value: number}};
      voices: Map<number, {audio: AudioBoundary}>;
    };
    runtime.setVolume(initialVolume);
    owners.sound.configure(catalog);
    owners.skillSound.configure(catalog);
    runtime.start();
    const play = (): {node: EffectSoundNodeState<number>; media: AudioBoundary; skillMedia: AudioBoundary} => {
      const node = new EffectSoundNodeState('GA15', 0, false, owners.sound, owners.sound.shared);
      node.start(); node.update();
      const media = type4.voices.get(node.handle!)!.audio;
      const handle = owners.skillSound.play('GA15', 1, [0, 0, 0]);
      assert.ok(handle > 0);
      const skillMedia = skill.voices.get(handle)!.audio;
      assert.equal(media.paused, false);
      assert.equal(skillMedia.paused, false);
      return {node, media, skillMedia};
    };
    const initial = play();
    assert.equal(initial.media.volume, initialVolume, 'Type4 initialization preserves volume');
    assert.equal(skill.master.gain.value, initialVolume, 'skill initialization preserves volume');
    runtime.setVolume(.25);
    assert.equal(initial.media.volume, .25, 'active Type4 media volume');
    assert.equal(skill.master.gain.value, .25, 'active skill master volume');
    const changed = play();
    assert.equal(changed.media.volume, .25, 'future Type4 media volume');
    runtime.setVolume(0);
    assert.equal(initial.media.volume, 0);
    assert.equal(changed.media.volume, 0);
    assert.equal(skill.master.gain.value, 0);
    const muted = play();
    assert.equal(muted.media.volume, 0, 'future Type4 media stays muted');
    muted.node.end();
    assert.equal(muted.media.paused, true, 'Type4 end stops muted voice');
    runtime.stop();
    for (const voice of [initial, changed, muted]) {
      assert.equal(voice.media.paused, true);
      assert.equal(voice.skillMedia.paused, true);
    }
    assert.equal(type4.voices.size, 0);
    assert.equal(skill.voices.size, 0);
    assert.equal(owners.sound.shared.last, undefined);
    runtime.start();
    owners.sound.configure(catalog);
    owners.skillSound.configure(catalog);
    const reentered = play();
    assert.equal(reentered.media.volume, 0, 'Type4 reentry preserves mute');
    assert.equal(skill.master.gain.value, 0, 'skill reentry preserves mute');
    runtime.stop();
    assert.equal(type4.voices.size, 0);
    assert.equal(skill.voices.size, 0);
    assert.equal(reentered.media.paused, true);
    assert.equal(reentered.skillMedia.paused, true);
  }
  writeFileSync('recovery/output/effect-volume-settings.json', `${JSON.stringify({
    status: 'PASS',
    paths: ['EffectRuntime.setVolume', 'EffectSound', 'EffectSkillSound', 'EffectSoundNodeState (Type4)'],
    reference: 'GA15',
    beforeInitialization: [0, .375],
    afterInitialization: [.25, 0],
    activeAndFutureVoices: true,
    type4EndStopsMedia: true,
    runtimeStopClearsVoices: true,
    reentryVolume: 0,
    scope: 'Production sound classes and runtime volume/stop with media and AudioContext fixture boundaries; no device playback or original sound fidelity acceptance',
  }, null, 2)}\n`);
  console.log('PASS: EffectSound, EffectSkillSound and Type4 volume before/after initialization, muted stop and reentry');
} finally {
  scene.dispose(); engine.dispose();
  for (const {name, descriptor} of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
