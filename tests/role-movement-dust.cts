import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {NullEngine, Scene, TransformNode, Observable} from '@babylonjs/core';
import {EffectRuntimeTree, EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import {EffectRuntimeStatePool} from '../apps/web/src/render/effects/runtime/effect-runtime-state-pool';
import {TankView} from '../apps/web/src/assets/tanks/tank-view';

const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const native = JSON.parse(readFileSync('recovery/output/role-movement-dust-tree-native.json', 'utf8'));
let randomIndex = 0;
const tree = new EffectRuntimeTree(library as EffectRuntimeLibrary, library.nodes[2424].id,
  [0, 0, 0], undefined, () => [8191, 24575, 16383, 1000][randomIndex++ % 4],
  {play: () => {throw new Error('Original001 must remain silent');}, finished: () => false, stop: () => {}}, {},
  () => {throw new Error('Retained001 child released');}, undefined, undefined, undefined, undefined, undefined, true);
for (const step of native.steps) {
  if (step.label.endsWith('-start')) {
    tree.origin.splice(0, 3, ...(step.label === 'first-start' ? [12.5, 0, 21] : [14.5, 0, 23]));
    tree.start();
  } else if (step.label === 'explicit-stop') tree.stop();
  else tree.update(step.delta);
  for (const row of step.states) {
    const node = tree.nodes.find(node => node.definition.index === row.node)!;
    assert.equal(node.lifecycle.phase, row.phase, `${step.label}/${row.node} phase`);
    assert.equal(node.lifecycle.controller, row.controller);
    assert.ok(Math.abs(node.lifecycle.elapsed - row.elapsed) < .00001);
    if (node.particle) {
      assert.equal(node.particle.pool.particles.length, row.states.length, `${step.label}/${row.node} particle count`);
      for (const [index, particle] of node.particle.pool.particles.entries()) {
        for (let axis = 0; axis < 3; ++axis) {
          assert.ok(Math.abs(particle.position[axis] - row.states[index].position[axis]) < .001);
        }
      }
    }
  }
}
assert.equal(tree.nodes.length, 6);

const engine = new NullEngine();
const scene = new Scene(engine);
const view = Object.create(TankView.prototype) as TankView;
const state = view as unknown as Record<string, any>;
const positions: number[][] = [];
const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 20, 3, 40, 1];
const current = {root: new TransformNode('action', scene), components: [
  {part: 'M', assets: {animationGroups: []}, action: {primaryTags: [{name: 'tag_efsoot', frames: [{}]}]}}],
};
Object.assign(state, {scene, tank: {components: [{part: 'M', actions: []}]}, current,
  root: new TransformNode('tank', scene), disposed: false, alive: true, trackPhase: {elapsed: 0, index: 0},
  actionMessages: new Observable(), movementDustPositions: new Observable(),
  primaryTags: {get: () => matrix}, updatePrimaryTags: () => {}, applyTrackTexture: () => {},
});
view.movementDustPositions.add(position => positions.push([...position]));
state.trackMovementPending = true;
view.advanceAnimations(.05);
assert.equal(positions.length, 0);
state.trackMovementPending = true;
view.advanceAnimations(.051);
assert.deepEqual(positions, [[20, 3, 40]]);
view.advanceAnimations(.2);
assert.equal(positions.length, 1, 'Stopped movement must not emit');
current.components[0].action.primaryTags = [];
state.trackMovementPending = true;
view.advanceAnimations(.101);
assert.equal(positions.length, 1, 'Missing source tag must not emit');
current.components[0].action.primaryTags = [{name: 'tag_efsoot', frames: [{}]}];
matrix[12] = matrix[13] = matrix[14] = 0;
state.trackMovementPending = true;
view.advanceAnimations(.101);
assert.equal(positions.length, 1, 'Identity tag must not emit');
state.alive = false;
matrix[12] = 20;
state.trackMovementPending = true;
view.advanceAnimations(.101);
assert.equal(positions.length, 1, 'Dead actor must not emit');

const runtime = Object.create(EffectRuntime.prototype) as EffectRuntime;
const runtimeState = runtime as unknown as Record<string, any>;
Object.assign(runtimeState, {scene, library, instances: [], running: true, nextInstance: 0,
  randomSeed: 1, sound: {shared: {}, play: () => {throw new Error('001 sound');}},
  statePool: new EffectRuntimeStatePool(), modelBackends: new WeakMap(),
});
const handle = runtime.retainMovementEffect(view);
assert.equal(runtime.retainMovementEffect(view), handle);
assert.equal(runtimeState.instances.length, 1);
assert.equal(runtimeState.instances[0].tree.root.lifecycle.phase, 0);
runtime.startMovementEffect(handle, [1, 2, 3]);
runtime.startMovementEffect(handle, [4, 5, 6]);
assert.equal(runtimeState.instances.length, 1);
assert.deepEqual(runtimeState.instances[0].tree.origin, [4, 5, 6]);
assert.equal(runtimeState.instances[0].tree.root.lifecycle.phase, 1);
runtime.releaseMovementEffect(handle);
assert.equal(runtimeState.instances.length, 0);
runtime.startMovementEffect(handle, [7, 8, 9]);
assert.equal(runtimeState.instances.length, 0);
tree.dispose();
scene.dispose(); engine.dispose();
writeFileSync('recovery/output/role-movement-dust-module.json', JSON.stringify({
  status: 'PASS_RETAINED001_CONSUMER_MODULE', positions,
  scope: 'Real001 tree compared against new original retained repeat-start execution. Real TankView cycle and runtime retain/start/release APIs with supplied tag, model and scene boundaries; no player pixels or ordinary input claim.',
}, null, 2) + '\n');
console.log('PASS: retained001 native repeat lifecycle, movement/tag gates, owner release and source silence');
