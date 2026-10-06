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
interface Config {node: number; type: number; timing: EffectTimelineConfig; controls: (EffectSpriteController | EffectParticleController)[];}
interface Row {node: number; phase: number; elapsed: number; controller: number; [key: string]: unknown;}
const fixture = JSON.parse(readFileSync(`recovery/output/effect-online004-tree${process.argv.includes('--parent') ? '-parent' : process.argv.includes('--retained') ? '-retained' : ''}-native.json`, 'utf8')) as {
  retained?: boolean; configs: Config[]; origin: EffectVec3; parent?: number[]; steps: {parent?: number[]; delta: number; states: Row[]; randomValues: number[]; events: object[]; childCount: number}[];
};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as {nodes: {id: number; index: number; children: number[]}[]};
const nodes = new Map<number, EffectNodeLifecycle>();
const sprites = new Map<number, EffectSpriteNodeState>();
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
const tree = new EffectRuntimeTree(runtimeLibrary, runtimeLibrary.nodes[2429].id, fixture.origin, fixture.parent ?? undefined, random,
  {play: () => 0, finished: () => false, stop: () => {}}, {}, node => events.push({kind: 'release', node}), statePool);
for (const node of tree.nodes) {
  const index = node.definition.index;
  nodes.set(index, node.lifecycle);
  if (node.sprite) sprites.set(index, node.sprite);
  if (node.particle) particles.set(index, node.particle);
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
    assert.deepEqual(normalize(actual), normalize(row), `node${row.node} tick${index}`);
  }
  assert.equal(randomIndex, values.length);
  assert.deepEqual(events, step.events);
  assert.equal(root.children.length, step.childCount);
}
console.log(`PASS: original online004 mixed source tree / ${fixture.steps.length} full ticks`);
