import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {ArcRotateCamera, NullEngine, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {ScenePreview} from '../apps/web/src/assets/scenes/scene-preview';

const entry = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json', 'utf8'))
  .find((value: {id: string}) => value.id === '0002');
const source = entry.records.find((value: {className: string}) => value.className === 'SYcScnObjPlant');
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new ArcRotateCamera('plant-owner-test', 0, 0, 1, Vector3.Zero(), scene);
const preview = new ScenePreview(scene, camera);
const register = preview as unknown as {registerPlant(id: string, root: TransformNode, enabled: boolean): void};
const root = new TransformNode('original-plant-' + source.id, scene);
const visible = {sourcePlacementId: source.id, enabled: Boolean(source.enabled), hidden: false};
const hidden = {...visible, hidden: true};

preview.reconcilePlants([hidden], 1);
register.registerPlant(source.id, root, Boolean(source.enabled));
assert.equal(root.isEnabled(), false, 'Snapshot preceding root registration must hide the new root');
preview.reconcilePlants([hidden], 1);
assert.equal(root.isEnabled(), false, 'Repeated hidden snapshot must stay hidden');
preview.reconcilePlants([visible], 2);
assert.equal(root.isEnabled(), true, 'New-round visible source must restore the root');
preview.reconcilePlants([hidden], 2);
assert.equal(root.isEnabled(), false);
preview.clear();
const next = new TransformNode('fresh-plant-' + source.id, scene);
register.registerPlant(source.id, next, Boolean(source.enabled));
assert.equal(next.isEnabled(), true, 'Cleared ledger must not hide a fresh registration');
preview.reconcilePlants([hidden], 3);
assert.equal(next.isEnabled(), false);
preview.reconcilePlants([], 4);
assert.equal(next.isEnabled(), true, 'A complete snapshot without an entry falls back to source visibility');
scene.dispose();
engine.dispose();
writeFileSync('recovery/output/scene-plant02-visibility.json', JSON.stringify({
  status: 'PASS_MAP02_PLANT_SOURCE_VISIBILITY_OWNER', sourcePlacementId: source.id,
  snapshotBeforeRegister: true, repeatedHidden: true, roundRestore: true,
  clearLedger: true, sourceFallback: true,
  scope: 'Actual ScenePreview/TransformNode ownership on NullEngine; no GPU, gameplay contact or native-source claim',
}, null, 2) + '\n');
console.log('PASS_MAP02_PLANT_SOURCE_VISIBILITY_OWNER');
