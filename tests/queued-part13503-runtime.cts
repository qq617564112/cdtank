import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const source = JSON.parse(readFileSync('recovery/output/queued-part13503-source.json', 'utf8'));
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
const runtime = new EffectRuntime(scene, camera);
const state = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
  instances: {handle: number; tree: EffectRuntimeTree; owner: TankView}[]};
state.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
for (const texture of source.textures) {
  const pixels = execFileSync('recovery/.venv/bin/python', ['-c',
    'from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("RGBA").tobytes())',
    'recovery/output/web-assets/' + texture.asset]);
  state.textures.set(texture.asset, RawTexture.CreateRGBATexture(new Uint8Array(pixels), texture.size[0], texture.size[1], scene));
}
const parent = [...EFFECT_IDENTITY], root = new TransformNode('equipped-actor', scene);
const victim = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
runtime.start();
const present = (): void => {runtime.spawnAttachedEffect(victim, 33, 0, false, victim);};
present();
assert.equal(state.instances.length, 1);
const tree = state.instances[0].tree;
assert.equal(tree.parentMatrix, parent);
assert.deepEqual(tree.nodes.map(node => node.definition.index), [2605, 2606, 2607]);
const geometry = new Map<number, number>();
for (let step = 0; step < 100; step++) {
  if (step === 2) parent[12] = 8;
  runtime.update(.05);
  assert.equal(tree.parentMatrix, parent);
  for (const mesh of scene.meshes) {
    if (mesh.metadata?.sourceNode !== undefined && mesh.getTotalVertices() > 0) {
      geometry.set(mesh.metadata.sourceNode, mesh.getTotalVertices());
    }
  }
}
assert.deepEqual([...geometry.keys()].sort((a, b) => a - b), [2606, 2607]);
assert.equal(state.instances.length, 1);
assert.equal(tree.quiescent, false);
runtime.stopEffect(state.instances[0].handle);
for (let step = 0; step < 100 && state.instances.length; step++) runtime.update(.05);
assert.equal(state.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert(tree.quiescent);
present(); runtime.update(.05); runtime.detach(victim);
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
present(); runtime.update(.05); runtime.stop();
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
const result = {status: 'PASS_13503_033_PERSISTENT_TREE_MODULE_ONLY', source: 'queued-part13503-source.json',
  geometry: [...geometry].map(([node, vertices]) => ({node, vertices})),
  checks: ['original033/decoded textures', 'live victim tag0', 'two drawable geometries',
    'persistent before stop and finite tail after stop', 'detach/stop zero resources'],
  ordinaryPlayerTriggered: false, pixelsOrAudioOutputVerified: false,
  scope: 'Original033 persistent actor-attached tree in NullEngine; stop completes original particle tail. No formal13503 qualification, ordinary pixels or audio output claimed.'};
writeFileSync('recovery/output/queued-part13503-runtime.json', JSON.stringify(result, null, 2) + '\n');
scene.dispose(); engine.dispose();
console.log(result.status);
