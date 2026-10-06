import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const source = JSON.parse(readFileSync('recovery/output/combat-shot-player-result-2016-source.json', 'utf8'));
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
const runtime = new EffectRuntime(scene, camera);
const state = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
  instances: {handle: number; tree: EffectRuntimeTree; owner: TankView; draws: unknown[]}[]};
state.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
for (const grid of source.textures) {
  if (state.textures.has(grid.asset)) continue;
  const pixels = execFileSync('recovery/.venv/bin/python', ['-c',
    'from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("RGBA").tobytes())',
    'recovery/output/web-assets/' + grid.asset]);
  state.textures.set(grid.asset, RawTexture.CreateRGBATexture(new Uint8Array(pixels), grid.size[0], grid.size[1], scene));
}
const parent = [...EFFECT_IDENTITY], root = new TransformNode('victim', scene);
const victim = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
runtime.start();
const present = (): void => {runtime.spawnAttachedEffect(victim, 25, 0, true, victim);};
present();
assert.equal(state.instances.length, 1);
const tree = state.instances[0].tree;
assert.equal(tree.parentMatrix, parent);
assert.deepEqual(tree.nodes.map(n => n.definition.index), [2738, 2739, 2740, 2794, 2795, 2808, 2966, 2967, 2968, 2969, 2807]);
const geometry = new Map<number, number>();
const collectGeometry = (): void => {
  for (const mesh of scene.meshes) if (mesh.metadata?.sourceNode !== undefined && mesh.getTotalVertices() > 0) {
    geometry.set(mesh.metadata.sourceNode, mesh.getTotalVertices());
  }
};
runtime.update(.05); collectGeometry();
assert(scene.meshes.filter(m => m.getTotalVertices() > 0).length >= 2, 'original红包/text/impact/point geometry submits');
parent[12] = 4; runtime.update(.1);
assert.equal(tree.parentMatrix[12], 4, 'victim matrix remains a live reference');
for (let step = 0; step < 120; step++) {runtime.update(.05); collectGeometry();}
assert.deepEqual([...geometry.keys()].sort((a, b) => a - b), [2739, 2740, 2794, 2795, 2807, 2808, 2966, 2967, 2968, 2969],
  'original红包/text/impact/point creates nonempty geometry through source controller phases');
assert.equal(state.instances.length, 1, 'original zero-lifetime2807 remains native-active');
const survivor = tree.nodes.find(node => node.definition.index === 2807)!;
assert.notEqual(survivor.lifecycle.phase, 0);
assert.equal(survivor.particle!.controller, 1);
assert.equal(survivor.particle!.pool.particles.length, 0, 'original particle content ends without freeing node');
assert.deepEqual(tree.nodes.filter(node => node.definition.type !== 0 && node.lifecycle.phase !== 0).map(node => node.definition.index), [2807]);
const nativeActiveEmptyNode = {node: 2807, phase: survivor.lifecycle.phase, controller: survivor.particle!.controller, particles: 0};
runtime.stopEffect(state.instances[0].handle);
for (let step = 0; step < 20 && state.instances.length; step++) runtime.update(.05);
assert.equal(state.instances.length, 0);
assert.equal(scene.meshes.length, 0);
present(); runtime.update(.05); runtime.detach(victim);
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
present(); runtime.update(.05); runtime.stop();
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
writeFileSync('recovery/output/combat-shot-player-result-2016-runtime.json', JSON.stringify({status: 'PASS_MODULE_DRAW_EXPLICIT_CLEAR_ONLY_NATURAL_TREE_RELEASE_GAP', nativeActiveEmptyNode,
  source: 'combat-shot-player-result-2016-source.json', checks: ['real025 tree/original decoded textures',
    'original红包/text/impact/point geometry', 'live victim tag_efcenter', 
    'finite visible content; original zero-lifetime2807 stays active without particles; explicit stop API clears', 'victim detach and runtime stop release'],
  geometry: [...geometry].map(([node, vertices]) => ({node, vertices})),
  ordinaryStopCallerVerified: false, ordinaryGameplayTriggered: false, actualPixelsOrAudioOutputVerified: false}, null, 2) + '\n');
scene.dispose(); engine.dispose();
console.log('PASS_MODULE_DRAW_EXPLICIT_CLEAR_ONLY_NATURAL_TREE_RELEASE_GAP 2016 source025');
