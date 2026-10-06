import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const source = JSON.parse(readFileSync('recovery/output/combat-shot-player-result-2009-source.json', 'utf8'));
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
runtime.start(); runtime.spawnAttachedEffect(victim, 11, 0, true, victim);
assert.equal(state.instances.length, 1);
const tree = state.instances[0].tree;
assert.equal(tree.parentMatrix, parent);
assert.deepEqual(tree.nodes.map(n => n.definition.index), [2637, 2643, 2663, 2664, 2665, 2666, 2667, 2830, 2834]);
runtime.update(.05);
assert(scene.meshes.filter(m => m.getTotalVertices() > 0).length >= 2, 'original sprite and particle geometry both submit');
parent[12] = 4; runtime.update(.1);
assert.equal(tree.parentMatrix[12], 4, 'victim matrix remains a live reference');
for (let step = 0; step < 60; step++) runtime.update(.05);
assert.equal(state.instances.length, 0, 'source011 ends naturally and releases instance');
assert.equal(scene.meshes.length, 0);
runtime.spawnAttachedEffect(victim, 11, 0, true, victim); runtime.update(.05); runtime.detach(victim);
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
runtime.spawnAttachedEffect(victim, 11, 0, true, victim); runtime.update(.05); runtime.stop();
assert.equal(state.instances.length, 0); assert.equal(scene.meshes.length, 0);
writeFileSync('recovery/output/combat-shot-player-result-2009-runtime.json', JSON.stringify({status: 'PASS_MODULE_ONLY',
  source: 'combat-shot-player-result-2009-source.json', checks: ['real011 tree/original decoded textures',
    'sprite and particle geometry', 'live victim tag_efcenter', 'source longest2.3299999s natural release', 'victim detach and runtime stop release'],
  ordinaryGameplayTriggered: false, actualPixelsOrAudioOutputVerified: false}, null, 2) + '\n');
scene.dispose(); engine.dispose();
console.log('PASS_MODULE_ONLY 2009 victim011 original geometry/live parent/natural end/detach/stop');
