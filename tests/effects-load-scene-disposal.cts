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

async function check(): Promise<void> {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const runtime = new EffectRuntime(scene, new FreeCamera('camera', Vector3.Zero(), scene));
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  Object.defineProperty(globalThis, 'fetch', {configurable: true, value: async (path: string) => {
    await pending;
    return {ok: true, json: async () => JSON.parse(readFileSync(`recovery/output/web-assets${path}`, 'utf8'))};
  }});
  const state = runtime as unknown as {skillSound: {context?: AudioContextBoundary}; textures: Map<string, unknown>; library?: unknown};
  try {
    const loading = runtime.load();
    scene.dispose(); release(); await loading;
    assert.equal(state.skillSound.context, undefined, 'late load must not create AudioContext after disposal');
    assert.equal(state.textures.size, 0, 'late load must not publish textures after disposal');
    assert.equal(state.library, undefined, 'late load must not activate disposed runtime');
    assert.equal(listeners.size, 0);
    writeFileSync('recovery/output/effects-load-scene-disposal.json', `${JSON.stringify({status: 'PASS',
      lateAudioContext: false, lateTextures: 0, lateLibrary: false, unlockListeners: 0,
      scope: 'Production load with delayed original exported JSON; terminal scene disposal before response'}, null, 2)}\n`);
    console.log('PASS: async effect load after Scene disposal creates no context, textures or runtime library');
  } finally {
    engine.dispose();
    if (fetchDescriptor) Object.defineProperty(globalThis, 'fetch', fetchDescriptor);
    for (const {name, descriptor} of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
void check();
