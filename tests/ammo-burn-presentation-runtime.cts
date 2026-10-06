import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {AmmoBurnPresentation} from '../apps/web/src/assets/tanks/ammo-burn-presentation';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const engine = new NullEngine(), scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
const runtime = new EffectRuntime(scene, camera);
const state = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
  instances: {handle: number; tree: EffectRuntimeTree; owner: TankView}[]};
state.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const nodes = new Set([2449, 2450, 2451, 2452]);
const textures = state.library.textureGrids.filter(grid => nodes.has(grid.node));
assert(textures.length > 0);
for (const grid of textures) {
  const asset = 'recovery/output/web-assets/' + grid.asset;
  const size = JSON.parse(execFileSync('recovery/.venv/bin/python', ['-c',
    'from PIL import Image; import json,sys; print(json.dumps(Image.open(sys.argv[1]).size))', asset], {encoding: 'utf8'}));
  const pixels = execFileSync('recovery/.venv/bin/python', ['-c',
    'from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("RGBA").tobytes())', asset]);
  state.textures.set(grid.asset, RawTexture.CreateRGBATexture(new Uint8Array(pixels), size[0], size[1], scene));
}
const parent = [...EFFECT_IDENTITY], root = new TransformNode('victim', scene);
const victim = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
const sounds: unknown[][] = [];
const consumer = new AmmoBurnPresentation({
  spawnAttachedEffect: (...args) => runtime.spawnAttachedEffect(...args),
  stopEffect: handle => runtime.stopEffect(handle),
  playSkillSound: (...args) => {sounds.push(['play', ...args]); return 1;},
  stopSkillSound: handle => {sounds.push(['stop', handle]);},
}, () => victim);
const players = [{id: 'P2', alive: true, ammoBurn: {
  itemId: 2007 as const, skillId: 4005 as const, startedAt: 100, expiresAt: 9100}}];
runtime.start(); consumer.reconcile(players, 'room:1', true);
assert.equal(state.instances.length, 1);
const tree = state.instances[0].tree;
assert.deepEqual(tree.nodes.map(n => n.definition.index), [...nodes]);
assert.equal(tree.parentMatrix, parent);
assert.deepEqual(sounds, [['play', victim, 'SE03', -1]]);
for (let step = 0; step < 220; step++) {
  runtime.update(.05);
  consumer.reconcile(players, 'room:1', true);
}
assert.equal(state.instances.length, 1, 'source zero lifetime remains active until authority removes burn');
assert.equal(sounds.length, 1, 'snapshot updates do not replay retained sound');
assert(scene.meshes.some(mesh => mesh.getTotalVertices() > 0), 'original014 particles submit geometry');
parent[12] = 4; runtime.update(.05);
assert.equal(tree.parentMatrix[12], 4);
consumer.reconcile([{id: 'P2', alive: true}], 'room:1', true);
assert.deepEqual(sounds.at(-1), ['stop', 1]);
for (let step = 0; step < 100; step++) runtime.update(.05);
assert.equal(state.instances.length, 0);
assert.equal(scene.meshes.length, 0);
consumer.reconcile(players, 'room:2', true); runtime.update(.7);
consumer.clear(); runtime.stop();
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
writeFileSync('recovery/output/ammo-burn-presentation-runtime.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', source: 'published original014 and skill-effect-message retained contract',
  textures: textures.map(grid => ({node: grid.node, asset: grid.asset})),
  checks: ['actual014 tree/decoded published textures', 'original particle geometry', 'live victim tag0',
    'zero lifetime persists beyond expiresAt metadata', 'duplicate does not restart effect or sound',
    'authority absence stops particles and releases tree/meshes', 'clear/runtime stop releases'],
  soundBoundary: 'SE03 selector-1; recording backend only',
  ordinaryGameplayTriggered: false, actualPixelsOrAudioOutputVerified: false,
}, null, 2) + '\n');
scene.dispose(); engine.dispose();
console.log('PASS_MODULE_ONLY original014 sustained geometry/live parent/authority stop/release');
