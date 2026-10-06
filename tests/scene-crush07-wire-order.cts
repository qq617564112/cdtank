import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {ArcRotateCamera, NullEngine, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {ScenePreview} from '../apps/web/src/assets/scenes/scene-preview';
import {SceneCrushPresentation} from '../apps/web/src/assets/scenes/scene-crush-presentation';
import type {EffectNativeMatrix} from '../apps/web/src/render/effects/common/effect-native-space';
const engine = new NullEngine(); const scene = new Scene(engine);
const preview = new ScenePreview(scene, new ArcRotateCamera('c', 0, 0, 1, Vector3.Zero(), scene));
const hooks = preview as unknown as {registerCrush(id: string, root: TransformNode, matrix: EffectNativeMatrix,
  presentation: SceneCrushPresentation, enabled: boolean): void};
const starts: number[] = [], stops: number[] = [], releases: number[] = [];
const runtime = {startCrushEffect: (h: number) => {starts.push(h);}, stopCrushEffect: (h: number) => {stops.push(h);},
  releaseSceneEffect: (h: number) => {releases.push(h);}};
const root = new TransformNode('76', scene);
hooks.registerCrush('76', root, [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  new SceneCrushPresentation({hide: () => root.setEnabled(false)}, runtime, 76), true);
preview.reconcileCrushes([{sourcePlacementId:'76', enabled:true, hidden:false}], 1);
starts.length = 0; stops.length = 0;
// The real transport sends the hidden snapshot before the accepted ShotItem event.
preview.reconcileCrushes([{sourcePlacementId:'76', enabled:true, hidden:true}], 1);
assert.equal(root.isEnabled(), false); assert.deepEqual(starts, []);
preview.crush('76'); preview.crush('76'); assert.deepEqual(starts, [76]);
preview.reconcileCrushes([{sourcePlacementId:'76', enabled:true, hidden:true}], 1);
assert.deepEqual(starts, [76]); assert.deepEqual(stops, []);
preview.reconcileCrushes([{sourcePlacementId:'76', enabled:true, hidden:false}], 2);
assert.equal(root.isEnabled(), true); assert.deepEqual(stops, [76]);
preview.reconcileCrushes([{sourcePlacementId:'76', enabled:true, hidden:true}], 2);
preview.crush('76'); assert.deepEqual(starts, [76,76]);
preview.clear(); assert.deepEqual(releases, [76]);
writeFileSync('recovery/output/scene-crush07-wire-order.json', JSON.stringify({status:'PASS_WIRE_ORDER_MODULE',
  checks:['snapshot-before-event starts once', 'repeat rejected', 'snapshot does not replay/stop', 'round stop/restore permits next result', 'clear release'],
  scope:'Real ScenePreview and SceneCrushPresentation with recording runtime; network/pixels not covered'}, null, 2));
scene.dispose(); engine.dispose(); console.log('PASS snapshot-before-event Crush consumption and round reset');
