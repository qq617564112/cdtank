import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArcRotateCamera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
const rows = JSON.parse(readFileSync('recovery/output/effect-manager-order-native.json', 'utf8')) as {count: number; update: number[]}[];
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new ArcRotateCamera('camera', 0, 0, 10, Vector3.Zero(), scene);
for (const row of rows) {
  const runtime = new EffectRuntime(scene, camera);
  const updates: number[] = [];
  const state = runtime as unknown as {running: boolean; library: object; instances: object[]};
  state.running = true;
  state.library = {};
  state.instances = Array.from({length: row.count}, (_, index) => ({
    tree: {update: () => updates.push(index), quiescent: false}, draws: [],
  }));
  runtime.update(.016);
  assert.deepEqual(updates, row.update, `Original shared-random traversal for ${row.count} active trees`);
}
scene.dispose(); engine.dispose();
console.log('PASS: production runtime active-tree update order matches original manager');
