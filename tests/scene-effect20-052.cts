import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, Vector3} from '@babylonjs/core';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import {EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {MapSceneEffects} from '../apps/web/src/assets/scenes/map-scene-effects';

const map = JSON.parse(readFileSync('recovery/output/web-assets/scene-effects-0020.json', 'utf8')) as {
  effects: {id: string; name: string; matrix: number[]}[];
};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero());
const runtime = new EffectRuntime(scene, camera);
const state = runtime as unknown as {
  library: unknown; textures: Map<string, RawTexture>;
  instances: {handle: number; scenePlacement: boolean; tree: EffectRuntimeTree}[];
  loadTexture(asset: string): Promise<void>;
};
state.library = library;
for (const row of library.textureGrids.filter((row: {node: number}) => [2988,2989].includes(row.node))) {
  state.textures.set(row.asset, RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]), 1,1,scene));
}
const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')!;
Object.defineProperty(globalThis, 'fetch', {configurable: true, value: async () => ({ok: true, json: async () => map})});

async function check(): Promise<void> {
  const owner = new MapSceneEffects(runtime);
  await owner.load(20);
  assert.equal(state.instances.length, 5, 'all offscreen placements exist before runtime start');
  const trees = state.instances.map(row => row.tree);
  for (const [index, tree] of trees.entries()) {
    assert.deepEqual(tree.parentMatrix, map.effects[index].matrix);
    assert.ok(tree.nodes.every(node => node.lifecycle.retainWhenEnded));
    assert.equal(tree.nodes.length, 3);
  }
  runtime.start(); runtime.update(0.1); runtime.update(0.2);
  assert.ok(trees.every(tree => tree.root.lifecycle.elapsed > 0));
  assert.ok(trees.every(tree => tree.nodes.filter(node => node.sprite).every(node => node.lifecycle.phase === 2)));
  const ordinary = runtime.spawnWorldEffect('_root\\online\\052', [0,0,0]);
  assert.ok(ordinary);
  runtime.releaseSceneEffect(ordinary);
  assert.equal(state.instances.length, 6, 'scene release cannot remove an ordinary owner');
  runtime.clearRoundEffects();
  assert.deepEqual(state.instances.map(row => row.tree), trees, 'round clear retains exact live map trees');
  owner.clear();
  assert.equal(state.instances.length, 0);
  assert.equal(scene.meshes.length, 0);
  await owner.load(20); runtime.clear(); assert.equal(state.instances.length, 0);
  owner.clear();

  const normalLoadTexture = state.loadTexture.bind(runtime);
  let release!: () => void;
  // Both052 sprites share a texture; resolve both pending callbacks together.
  let gates: (() => void)[] = [];
  state.loadTexture = async () => new Promise<void>(resolve => {gates.push(resolve);});
  const late = runtime.spawnSceneEffect(map.effects[0].name, map.effects[0].matrix);
  await new Promise(resolve => setImmediate(resolve));
  runtime.stop(); gates.forEach(resolve => resolve());
  assert.equal(await late, 0); assert.equal(state.instances.length, 0);
  state.loadTexture = normalLoadTexture;

  const handles = new Set<number>();
  const released: number[] = [];
  let next = 0;
  let failAt = 0;
  let gate: Promise<void> | undefined;
  const boundary = {
    spawnSceneEffect: async () => {
      await gate;
      if (++next === failAt) throw new Error('texture failure');
      handles.add(next); return next;
    },
    releaseSceneEffect: (handle: number) => {handles.delete(handle); released.push(handle);},
  };
  const isolated = new MapSceneEffects(boundary);
  failAt = 3;
  await assert.rejects(isolated.load(20), /texture failure/);
  assert.equal(handles.size, 0); assert.deepEqual(released, [1,2]);
  failAt = 0;
  gate = new Promise(resolve => {release = resolve;});
  const pending = isolated.load(20);
  await new Promise(resolve => setImmediate(resolve));
  isolated.clear(); release(); await pending;
  assert.equal(handles.size, 0, 'late spawned handle released after owner clear');
  gate = undefined;
  await isolated.load(20); assert.equal(handles.size, 5);
  await isolated.load(21); assert.equal(handles.size, 0);

  let pendingSecond!: () => void;
  let calls = 0;
  const partialHandles = new Set<number>();
  const partialOwner = new MapSceneEffects({
    spawnSceneEffect: async () => {
      const handle = ++calls;
      if (handle === 2) await new Promise<void>(resolve => {pendingSecond = resolve;});
      partialHandles.add(handle); return handle;
    },
    releaseSceneEffect: handle => {partialHandles.delete(handle);},
  });
  const partial = partialOwner.load(20);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...partialHandles], [1]);
  partialOwner.clear(); assert.equal(partialHandles.size, 0, 'clear immediately releases completed first tree');
  pendingSecond(); await partial;
  assert.equal(partialHandles.size, 0); assert.equal(calls, 2, 'late second tree released without creating third');

  gates = [];
  state.loadTexture = async () => new Promise<void>(resolve => {gates.push(resolve);});
  const disposed = runtime.spawnSceneEffect(map.effects[0].name, map.effects[0].matrix);
  await new Promise(resolve => setImmediate(resolve));
  scene.dispose(); gates.forEach(resolve => resolve());
  assert.equal(await disposed, 0); assert.equal(state.instances.length, 0);
  writeFileSync('recovery/output/scene-effect20-052-rules.json', JSON.stringify({status:'PASS',
    offscreenPreStartPlacements:5, retainedNodes:15, roundKeepsExactTrees:true, fullClear:true,
    sceneReleaseIgnoresOrdinary:true, lateStopNoInstance:true, lateOwnerClearNoInstance:true,
    partialFailureReleased:2, unsupportedMapReleases:true, lateDisposedNoInstance:true,
    pendingSecondClearImmediatelyReleasesFirst:true, lateSecondReleasedWithoutThird:true,
    boundaries:['NullEngine and one-pixel texture resource', 'owner async spawn/error timing'],
  }, null, 2)+'\n');
  console.log('PASS:052 retained map trees, round/full release, late stop/disposal and owner partial-failure cleanup');
}
void check().finally(() => {engine.dispose(); Object.defineProperty(globalThis, 'fetch', fetchDescriptor);});
