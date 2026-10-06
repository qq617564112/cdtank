import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {ArcRotateCamera, NullEngine, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {ScenePreview} from '../apps/web/src/assets/scenes/scene-preview';
import {SceneCrushPresentation} from '../apps/web/src/assets/scenes/scene-crush-presentation';
import type {EffectNativeMatrix} from '../apps/web/src/render/effects/common/effect-native-space';

const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new ArcRotateCamera('camera', 0, 0, 1, Vector3.Zero(), scene);
const preview = new ScenePreview(scene, camera);
const hooks = preview as unknown as {
  registerCrush(id: string, root: TransformNode, matrix: EffectNativeMatrix,
    presentation: SceneCrushPresentation, enabled: boolean): void;
};
const starts: number[] = [], stops: number[] = [], releases: number[] = [];
const runtime = {
  startCrushEffect(handle: number): void {starts.push(handle);},
  stopCrushEffect(handle: number): void {stops.push(handle);},
  releaseSceneEffect(handle: number): void {releases.push(handle);},
};
const native = JSON.parse(readFileSync('recovery/output/scene-crush07-matrix-native.json', 'utf8'));
const roots = new Map<string, TransformNode>();
function loadOwner(id: string): void {
  const source = native.placements.find((row: {id: string}) => row.id === id);
  const root = new TransformNode(id, scene);
  roots.set(id, root);
  hooks.registerCrush(id, root, source.matrix,
    new SceneCrushPresentation({hide: () => root.setEnabled(false)}, runtime, Number(id)),
    Boolean(source.enabled));
}

// Snapshot arrives while assets are still loading: no past effect is replayed.
preview.reconcileCrushes([{sourcePlacementId: '76', enabled: true, hidden: true}], 1);
loadOwner('75'); loadOwner('76'); loadOwner('77');
assert.equal(roots.get('75')!.isEnabled(), false);
assert.equal(roots.get('76')!.isEnabled(), false);
assert.equal(roots.get('77')!.isEnabled(), true);
preview.crush('75');
assert.deepEqual(starts, []);
// An accepted result following the hidden snapshot still starts once.
preview.crush('76'); preview.crush('76');
assert.deepEqual(starts, [76]);
preview.crush('77'); preview.crush('77');
assert.deepEqual(starts, [76, 77], 'Repeated event must not restart a consumed result');
assert.equal(roots.get('77')!.isEnabled(), false);
preview.reconcileCrushes([
  {sourcePlacementId: '76', enabled: true, hidden: true},
  {sourcePlacementId: '77', enabled: true, hidden: true},
], 1);
assert.deepEqual(starts, [76, 77]);
assert.deepEqual(stops, [], 'Same-round snapshot does not stop a live event effect');

// New round stops retained effects and restores original source visibility.
preview.reconcileCrushes([], 2);
assert.deepEqual(stops, [75, 76, 77]);
assert.deepEqual(releases, [], 'Round reset retains owner handles');
assert.equal(roots.get('75')!.isEnabled(), false);
assert.equal(roots.get('76')!.isEnabled(), true);
assert.equal(roots.get('77')!.isEnabled(), true);
preview.crush('76');
assert.deepEqual(starts, [76, 77, 76]);
preview.clear();
assert.deepEqual(releases, [75, 76, 77]);
preview.crush('76');
assert.deepEqual(starts, [76, 77, 76]);
// Clear removes cached old hidden state before entering another room.
loadOwner('76');
assert.equal(roots.get('76')!.isEnabled(), true);
preview.clear();
writeFileSync('recovery/output/scene-crush07-reconcile.json', JSON.stringify({
  status: 'PASS_RECONCILE_MODULE', starts, stops, releases,
  lateLoadHidden: true, duplicateRejected: true, resetRetained: true,
  clearRemovedSnapshot: true,
  scope: 'ScenePreview reconciliation and real presentation with recording runtime boundaries in NullEngine; no ordinary player, effect pixels or server permission claim.',
}, null, 2) + '\n');
scene.dispose(); engine.dispose();
console.log('PASS_RECONCILE_MODULE: late-load hide, duplicate guard, retained round reset and clear');
