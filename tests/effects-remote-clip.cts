import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import type {EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';

const native = JSON.parse(readFileSync('recovery/output/skill-effect-actor-native.json', 'utf8')) as {
  rows: {oneShot: number; clipped: boolean; local: boolean; present: boolean; result: number}[];
};
for (const row of native.rows.filter(row => row.clipped)) {
  assert.equal(row.result !== 0, row.present && (!row.oneShot || row.local));
}
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
const runtime = new EffectRuntime(scene, camera);
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
const state = runtime as unknown as {library: EffectRuntimeLibrary; instances: {handle: number}[]};
state.library = library; runtime.start();
const root = new TransformNode('remote', scene);
const view = {root, primaryTag: () => EFFECT_IDENTITY} as unknown as TankView;
assert.ok(runtime.spawnAttachedEffect(view, 11, 0, true) > 0, 'remote inside creates');
runtime.clear();
camera.setTarget(new Vector3(0, 0, -200));
assert.equal(runtime.spawnAttachedEffect(view, 11, 0, true), 0,
  'camera turned before render must clip remote one-shot against current view');
assert.ok(runtime.spawnAttachedEffect(view, 11, 0, true, view) > 0, 'local view bypasses clip');
runtime.clear();
assert.ok(runtime.spawnAttachedEffect(view, 11, 0, false) > 0, 'retained bypasses clip');
runtime.clear();
camera.setTarget(Vector3.Zero());
assert.ok(runtime.spawnAttachedEffect(view, 11, 0, true) > 0, 'turning back before render creates remote');
scene.dispose(); engine.dispose();
writeFileSync('recovery/output/effects-remote-clip.json', `${JSON.stringify({status: 'PASS',
  currentCameraBeforeRender: true, outsideRemoteDropped: true, localBypass: true, retainedBypass: true}, null, 2)}\n`);
console.log('PASS: current-camera remote one-shot clipping before render, local and retained exceptions');
