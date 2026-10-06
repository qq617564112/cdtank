import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {EffectSound} from '../apps/web/src/audio/effect-sound';
import {EffectSkillSound, type SkillSoundCatalog} from '../apps/web/src/audio/effect-skill-sound';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';

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
  destination = {};
  listener = Object.fromEntries(['position', 'forward', 'up'].flatMap(name =>
    ['X', 'Y', 'Z'].map(axis => [`${name}${axis}`, {value: 0}])));
  close(): Promise<void> {this.state = 'closed'; return Promise.resolve();}
  createGain(): object {return audioNode();}
  createPanner(): object {return audioNode();}
  createMediaElementSource(): object {return audioNode();}
}
const globals = ['Audio', 'AudioContext', 'window'].map(name =>
  ({name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name)}));
Object.defineProperty(globalThis, 'Audio', {value: AudioBoundary, configurable: true});
Object.defineProperty(globalThis, 'AudioContext', {value: AudioContextBoundary, configurable: true});
const listeners = new Set<unknown>();
Object.defineProperty(globalThis, 'window', {value: {
  addEventListener: (name: string, listener: unknown) => {if (name === 'pointerdown' || name === 'keydown') listeners.add(listener);},
  removeEventListener: (_name: string, listener: unknown) => {listeners.delete(listener);},
}, configurable: true});

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as SkillSoundCatalog;
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('camera', Vector3.Zero(), scene);
const runtime = new EffectRuntime(scene, camera);
const owners = runtime as unknown as {sound: EffectSound; skillSound: EffectSkillSound};
const sounds = owners.sound as unknown as {voices: Map<number, {audio: AudioBoundary}>};
const skills = owners.skillSound as unknown as {context: AudioContextBoundary; voices: Map<number, {audio: AudioBoundary}>};
owners.sound.configure(catalog); owners.skillSound.configure(catalog); runtime.start();
const type4 = owners.sound.play('GA15', 0);
const skill = owners.skillSound.play('GA15', -1, [0, 0, 0]);
const type4Media = sounds.voices.get(type4)!.audio;
const skillMedia = skills.voices.get(skill)!.audio;
const context = skills.context;
scene.dispose();
assert.equal(skillMedia.paused, true, 'scene disposal stops active skill media');
assert.equal(type4Media.paused, true, 'scene disposal stops active Type4 media');
assert.equal(skills.voices.size, 0);
assert.equal(sounds.voices.size, 0);
assert.equal(context.state, 'closed');
assert.equal(listeners.size, 0, 'scene disposal removes input unlock listeners');
engine.dispose();
for (const {name, descriptor} of globals) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
writeFileSync('recovery/output/effects-scene-disposal.json', `${JSON.stringify({status: 'PASS',
  activeSkillStopped: true, activeType4Stopped: true, voices: 0, context: 'closed', unlockListeners: 0,
  scope: 'Production runtime scene-disposal hook and media lifecycle; audio device fixture'}, null, 2)}\n`);
console.log('PASS: scene disposal stops effect media, closes owned context and removes unlock listeners');
