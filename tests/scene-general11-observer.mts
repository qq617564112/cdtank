import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {LoadAssetContainerAsync, NullEngine, Scene} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const engine = new NullEngine();
const scene = new Scene(engine);
const oldRegistered = new Set<object>();
const fixedRegistered = new Set<object>();
scene.onNewMeshAddedObservable.add(mesh => {
  const value = mesh as unknown as {_draw?: unknown; _processRendering?: unknown; sourceMesh?: object};
  if (typeof value._draw === 'function' && typeof value._processRendering === 'function') oldRegistered.add(mesh);
  const source = (value.sourceMesh ?? mesh) as {_draw?: unknown; _processRendering?: unknown};
  if (typeof source._draw === 'function' && typeof source._processRendering === 'function') fixedRegistered.add(source);
});
const asset = await LoadAssetContainerAsync(new Uint8Array(readFileSync(
  'recovery/output/web-assets/Data/scnobj/obj05431/obj05431.glb')), scene, {pluginExtension: '.glb'});
const source = asset.meshes.find(mesh => mesh.name === 'anangua04/0')!;
assert.ok(source);
assert.equal(scene.meshes.includes(source), false);
const instance = asset.instantiateModelsToScene(name => `General-observer/${name}`, false,
  {doNotInstantiate: false});
assert.equal(oldRegistered.has(source), false);
assert.equal(fixedRegistered.has(source), true);
writeFileSync('recovery/output/scene-general11-observer-module.json', JSON.stringify({
  status: 'PASS_OBSERVER_ENTRANCE_ONLY', sourceMesh: source.name,
  cachedSourceNotAddedToScene: true, oldObserverMissesSource: true,
  instanceSourceRedirectRegistersOriginalDraw: true,
  scope: 'Original GLB AssetContainer/InstancedMesh observation entrance. No render, visibility, or player output proof.',
}, null, 2) + '\n');
instance.dispose(); asset.dispose(); scene.dispose(); engine.dispose();
console.log('PASS_OBSERVER_ENTRANCE_ONLY: cached original source requires InstancedMesh source redirect');
