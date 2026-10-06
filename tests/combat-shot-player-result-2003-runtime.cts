import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {TankShotPlayerResult} from '../apps/web/src/assets/tanks/shot-player-result';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const source = JSON.parse(readFileSync('recovery/output/combat-shot-player-result-2003-source.json', 'utf8'));
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
const runtime = new EffectRuntime(scene, camera);
const state = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
  instances: {handle: number; tree: EffectRuntimeTree; owner: TankView; draws: unknown[]}[]};
state.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
for (const grid of source.textures) {
  const pixels = execFileSync('recovery/.venv/bin/python', ['-c',
    'from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("RGBA").tobytes())',
    'recovery/output/web-assets/' + grid.asset]);
  state.textures.set(grid.asset, RawTexture.CreateRGBATexture(new Uint8Array(pixels), grid.size[0], grid.size[1], scene));
}
const parent = [...EFFECT_IDENTITY], root = new TransformNode('victim', scene);
const victim = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
const calls: unknown[][] = [];
const consumer = new TankShotPlayerResult({spawnAttachedEffect: (...args) => runtime.spawnAttachedEffect(...args),
  playSkillSound: (...args) => {calls.push(args); return 1;}}, catalog);
runtime.start(); consumer.showPlayerResult(victim, 2003, victim);
assert.equal(state.instances.length, 1);
const tree = state.instances[0].tree;
assert.equal(tree.parentMatrix, parent);
assert.deepEqual(tree.nodes.map(n => n.definition.index), [3047, 3048, 3049, 3050, 3051, 3052]);
assert.deepEqual(calls, [[victim, 'SE32', 1]]);
runtime.update(.05);
for (let step = 0; step < 12; step++) runtime.update(.05);
assert(scene.meshes.filter(m => m.getTotalVertices() > 0).length >= 3, 'original particle/sprite/strip geometry submits');
parent[12] = 4; runtime.update(.1);
assert.equal(tree.parentMatrix[12], 4, 'victim matrix remains a live reference');
for (let step = 0; step < 60; step++) runtime.update(.05);
assert.equal(state.instances.length, 0, 'source009 ends naturally and releases instance');
assert.equal(scene.meshes.length, 0);
consumer.showPlayerResult(victim, 2003, victim); runtime.update(.05); runtime.detach(victim);
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
consumer.showPlayerResult(victim, 2003, victim); runtime.update(.05); runtime.stop();
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
writeFileSync('recovery/output/combat-shot-player-result-2003-runtime.json', JSON.stringify({status: 'PASS_MODULE_ONLY',
  source: 'combat-shot-player-result-2003-source.json', checks: ['real009 tree/original decoded textures',
    'particle/sprite/strip geometry', 'live victim tag_efcenter', 'spatialSE32 selector1 boundary',
    'original finite child lifetime natural release', 'victim detach and runtime stop release'],
  ordinaryGameplayTriggered: false, actualPixelsOrAudioOutputVerified: false}, null, 2) + '\n');
scene.dispose(); engine.dispose();
console.log('PASS_MODULE_ONLY 2003 victim009 original geometry/live parent/natural end/detach/stop');
