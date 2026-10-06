import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, Vector3} from '@babylonjs/core';
import {SceneCrushPresentation} from '../apps/web/src/assets/scenes/scene-crush-presentation';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import {EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const native = JSON.parse(readFileSync('recovery/output/scene-crush07-state-native.json', 'utf8'));
const source = JSON.parse(readFileSync('recovery/output/scene-crush051-resource-contract.json', 'utf8'));
const producer = JSON.parse(readFileSync('recovery/output/scene-crush07-matrix-native.json', 'utf8'));
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
const runtime = new EffectRuntime(scene, camera);
const state = runtime as unknown as {
  library: unknown; textures: Map<string, RawTexture>;
  instances: {handle: number; tree: EffectRuntimeTree; crushRetained: boolean}[];
  loadTexture(asset: string): Promise<void>;
};
state.library = library;
for (const grid of source.textureGrids) {
  const pixels = execFileSync('recovery/.venv/bin/python', ['-c',
    'from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("RGBA").tobytes())',
    'recovery/output/web-assets/' + grid.asset]);
  assert.equal(pixels.length, grid.width * grid.height * 4);
  state.textures.set(grid.asset, RawTexture.CreateRGBATexture(new Uint8Array(pixels), grid.width, grid.height, scene));
}
assert(source.silent && source.soundControls.length === 0);

async function check(): Promise<void> {
  assert.equal(producer.status, 'PASS_MATRIX_PRODUCER');
  assert.equal(producer.objectPair[0], producer.ownerMatrix);
  const parent = [...producer.matrix];
  const handle = await runtime.retainCrushEffect(parent, '76');
  assert(handle > 0);
  const tree = state.instances[0].tree;
  assert.equal(tree.parentMatrix, parent, 'resolved parent remains a live reference');
  assert.deepEqual(tree.nodes.map(n => n.definition.index), [2970, 2971]);
  assert(tree.nodes.every(n => n.lifecycle.phase === 0 && n.lifecycle.retainWhenEnded));
  runtime.start();
  runtime.update(.5);
  assert.equal(state.instances.length, 1, 'inactive retained effect survives render ticks');
  assert(tree.nodes.every(n => n.lifecycle.phase === 0));

  const order: string[] = [];
  const boundary = {
    startCrushEffect(value: number): void {order.push('effectSlot34'); runtime.startCrushEffect(value);},
    stopCrushEffect(value: number): void {runtime.stopCrushEffect(value);},
    releaseSceneEffect(value: number): void {runtime.releaseSceneEffect(value);},
  };
  const view = {hide(): void {order.push('hideBoundary');}};
  const owner = new SceneCrushPresentation(view, boundary, handle);
  for (const row of native.rows.filter((r: {effectPresent: boolean}) => r.effectPresent)) {
    order.length = 0;
    owner.crush();
    assert.deepEqual(order, row.events.map((e: {kind: string}) => e.kind));
    assert.equal(tree.root.lifecycle.phase, 1);
    runtime.update(.1);
    assert(tree.nodes[1].particle!.pool.particles.length > 0);
    runtime.update(2);
    assert.equal(tree.nodes[1].lifecycle.phase, 3, 'source1s naturally ends drawing while owner retains tree');
    assert.equal(state.instances.length, 1);
  }
  owner.crush(); runtime.update(.1);
  assert.equal(tree.nodes[1].lifecycle.phase, 2);
  owner.reset();
  assert.equal(state.instances.length, 1, 'round reset retains the exact owner');
  assert(tree.nodes.every(n => n.lifecycle.phase === 3));
  runtime.update(.1);
  assert.equal(state.instances[0].tree, tree);
  owner.crush(); runtime.update(.1);
  assert.equal(tree.nodes[1].lifecycle.phase, 2, 'next transaction restarts after reset');
  assert.equal(runtime.skillSound.voices.size, 0);
  const absent = new SceneCrushPresentation(view, boundary, 0);
  for (const row of native.rows.filter((r: {effectPresent: boolean}) => !r.effectPresent)) {
    order.length = 0; absent.crush();
    assert.deepEqual(order, row.events.map((e: {kind: string}) => e.kind));
  }
  owner.dispose(); absent.dispose();
  assert.equal(state.instances.length, 0);
  assert.equal(scene.meshes.length, 0);

  let resolveTexture!: () => void;
  state.loadTexture = async () => new Promise<void>(resolve => {resolveTexture = resolve;});
  const late = runtime.retainCrushEffect(parent, '76');
  await new Promise(resolve => setImmediate(resolve));
  runtime.stop(); resolveTexture();
  assert.equal(await late, 0, 'clear cancels asynchronous retained allocation');
  assert.equal(state.instances.length, 0);
  const output = {status: 'PASS_MODULE_ONLY', source: 'scene-crush051-resource-contract.json',
    native: 'scene-crush07-state-native.json', parentProducer: 'scene-crush07-matrix-native.json', checks: ['inactive retention', 'live resolved parent reference',
      'native hide/start order and repeated/null behavior', 'source051 particle startup and natural end',
      'original silence', 'active round stop and retained next-trigger restart', 'explicit stop/release', 'late allocation cancellation'],
    ordinaryGameplayTriggered: false, dualVisibleVerified: false};
  writeFileSync('recovery/output/scene-crush051-consumer.json', JSON.stringify(output, null, 2) + '\n');
  scene.dispose(); engine.dispose();
  console.log('PASS_MODULE_ONLY: retained051 source startup, hide order, silent/end/release; no gameplay claim');
}
check().catch(error => {scene.dispose(); engine.dispose(); throw error;});
