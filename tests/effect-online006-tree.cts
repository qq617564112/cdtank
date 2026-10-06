import assert from 'node:assert/strict';
import {EffectRuntimeStatePool, EffectRuntimeRetainedState} from '../apps/web/src/render/effects/runtime/effect-runtime-state-pool';
import {EffectObjectPool} from '../apps/web/src/render/effects/runtime/effect-object-pool';
import {EffectRuntimeTree, EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {readFileSync} from 'node:fs';
import {EffectNodeLifecycle} from '../apps/web/src/render/effects/runtime/effect-lifecycle';
import {EffectSpriteNodeState, EffectSpriteController} from '../apps/web/src/render/effects/sprites/effect-sprite-node';
import {EffectParticleNodeState, EffectParticleController} from '../apps/web/src/render/effects/particles/effect-particle-node';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
import {EffectStripNodeState, EffectStripController} from '../apps/web/src/render/effects/strips/effect-strip-node';
import {EffectSoundNodeState, EffectSoundStore} from '../apps/web/src/render/effects/runtime/effect-sound-node';
interface SoundControl {reference: string; parameter: number; stopPrevious: boolean;}
interface Config {frames: [number, number, number, number][];node: number; type: number; timing: EffectTimelineConfig; controls: (EffectSpriteController | EffectParticleController | EffectStripController | SoundControl)[];}
interface Row {node: number; phase: number; elapsed: number; controller: number; [key: string]: unknown;}
const fixture = JSON.parse(readFileSync(`recovery/output/effect-online006-tree${process.argv.includes('--parent') ? '-parent' : process.argv.includes('--retained') ? '-retained' : ''}-native.json`, 'utf8')) as {
  retained?: boolean; configs: Config[]; origin: EffectVec3; parent?: number[]; steps: {parent?: number[]; delta: number; states: Row[]; randomValues: number[]; events: object[]; childCount: number}[];
};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as {nodes: {id: number; index: number; children: number[]}[]};
const nodes = new Map<number, EffectNodeLifecycle>();
const sprites = new Map<number, EffectSpriteNodeState>();
const strips = new Map<number, EffectStripNodeState>();
const sounds = new Map<number, EffectSoundNodeState<number>>();
const soundShared: EffectSoundStore<number> = {};
let nextHandle = 0;
const particles = new Map<number, EffectParticleNodeState>();
let values: number[] = [], randomIndex = 0, events: object[] = [];
const random = (): number => {
  assert.ok(randomIndex < values.length);
  return values[randomIndex++];
};
const runtimeLibrary = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
const statePool = new EffectRuntimeStatePool();
if (fixture.retained) {
  const state = statePool as unknown as {pools: Map<number, EffectObjectPool<EffectRuntimeRetainedState>>};
  for (const type of [1, 7]) state.pools.set(type, new EffectObjectPool(() => ({
    type, trailElapsed: Math.fround(.013), stripScroll: .375,
  }), () => {}));
}
const tree = new EffectRuntimeTree(runtimeLibrary, runtimeLibrary.nodes[2504].id, fixture.origin, fixture.parent ?? undefined, random,
  {play: (reference, parameter) => {const handle = ++nextHandle; events.push({kind: 'play', handle, reference, parameter}); return handle;},
  finished: handle => {events.push({kind: 'finished', handle, result: false}); return false;},
  stop: handle => events.push({kind: 'stop', handle})}, soundShared, node => events.push({kind: 'release', node}), statePool);
for (const node of tree.nodes) {
  const index = node.definition.index;
  nodes.set(index, node.lifecycle);
  if (node.sprite) sprites.set(index, node.sprite);
  if (node.particle) particles.set(index, node.particle);
  if (node.strip) strips.set(index, node.strip);
  if (node.sound) sounds.set(index, node.sound);
}
const root = tree.root.lifecycle;
root.start();
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value === 0 ? 0 : value;
};
for (const [index, step] of fixture.steps.entries()) {
  values = step.randomValues;
  randomIndex = 0;
  events = [];
  if (fixture.parent && step.parent) fixture.parent.splice(0, 16, ...step.parent);
  root.tick(step.delta);
  for (const row of step.states) {
    const node = nodes.get(row.node)!;
    const actual: Row = {node: row.node, phase: node.phase, elapsed: node.elapsed, controller: node.controller};
    const sprite = sprites.get(row.node), particle = particles.get(row.node);
    if (sprite?.history) Object.assign(actual, {states: sprite.history.entries, frameRemainder: sprite.frameRemainder, trailElapsed: sprite.history.elapsed});
    else if (sprite) Object.assign(actual, {states: [], frameRemainder: 0, trailElapsed: 0});
    if (particle) Object.assign(actual, {states: particle.pool.particles, spaces: particle.spaces.map(space => [...space.position, ...space.orbitOffset]),
      burst: particle.emitter.burstEmitted, fraction: particle.emitter.fraction});
    const strip = strips.get(row.node), sound = sounds.get(row.node);
    if (strip) Object.assign(actual, {states: strip.state ? {position: strip.state.position, orbitOffset: strip.state.orbitOffset,
      velocity: strip.state.velocity, angles: strip.state.angles, scale: strip.state.scale, color: strip.state.color, frame: strip.state.frame} : {
      position: [0, 0, 0], orbitOffset: [0, 0, 0], velocity: [0, 0, 0], angles: [0, 0, 0], scale: [0, 0, 0], color: [0, 0, 0, 0], frame: 0},
      frameRemainder: strip.state?.frameRemainder ?? 0, scroll: strip.scroll, uvs: strip.geometry.map(segment => segment.uv)});
    if (sound) Object.assign(actual, {started: sound.started, handle: sound.handle ?? 0});
    assert.deepEqual(normalize(actual), normalize(row), `node${row.node} tick${index}`);
  }
  assert.equal(randomIndex, values.length);
  assert.deepEqual(events, step.events);
  assert.equal(root.children.length, step.childCount);
}
console.log(`PASS: original online006 mixed source tree / ${fixture.steps.length} full ticks`);
