import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArcRotateCamera, Camera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {EffectCameraShakeView} from '../apps/web/src/render/effects/camera/effect-camera-shake-view';
import {configureBattleCamera, followBattleCamera, originalActorCameraHeading, originalBattleCameraPose} from '../apps/web/src/render/battle-camera';
const native = JSON.parse(readFileSync('recovery/output/battle-camera-native.json', 'utf8'));
for (const row of native.headingRows) assert(Math.abs(originalActorCameraHeading(row.bodyYaw)-row.actorYawDegrees)<.0001);
let maxError = 0;
for (const row of native.rows) {
  const actual = originalBattleCameraPose(row.position, row.actorYawDegrees);
  for (const key of ['eye','target','up'] as const) actual[key].forEach((value,i) => {
    const error = Math.abs(value - row[key][i]); maxError = Math.max(maxError,error);
    assert(error < .0001, `${key}[${i}]: ${value} versus ${row[key][i]}`);
  });
}
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new ArcRotateCamera('camera',0,1,700,Vector3.Zero(),scene);
configureBattleCamera(camera);
assert.deepEqual(Object.keys(camera.inputs.attached), []);
assert.equal(camera.minZ,10);assert.equal(camera.maxZ,5000);
for (const row of native.rows) {
  const web = new Vector3(-row.position[0],row.position[1],row.position[2]);
  followBattleCamera(camera, web, row.actorYawDegrees*Math.PI/180);
  camera.getViewMatrix(true);
  const expected=originalBattleCameraPose(row.position,originalActorCameraHeading(row.actorYawDegrees*Math.PI/180));
  assert(Vector3.Distance(camera.position,new Vector3(-expected.eye[0],expected.eye[1],expected.eye[2]))<.0001);
  assert(Vector3.Distance(camera.target,new Vector3(-expected.target[0],expected.target[1],expected.target[2]))<.0001);
}
const shake = new EffectCameraShakeView(camera, () => .75);
const baseline = Array.from(camera.getViewMatrix(true).m);
shake.activate(1,.5,10);shake.update(.1);
assert(Array.from(camera.getViewMatrix().m).some((v,i) => Math.abs(v-baseline[i])>1e-6));
shake.clear();assert(Array.from(camera.getViewMatrix(true).m).every((v,i)=>Math.abs(v-baseline[i])<1e-6));
shake.dispose();
// A new round restores the same pose even after another role pose was displayed.
const origin = new Vector3(100,0,200);
followBattleCamera(camera,origin,.7);const firstRound=Array.from(camera.getViewMatrix(true).m);
followBattleCamera(camera,new Vector3(-900,30,700),2);
configureBattleCamera(camera);followBattleCamera(camera,origin,.7);
assert(Array.from(camera.getViewMatrix(true).m).every((v,i)=>Math.abs(v-firstRound[i])<1e-6));
scene.dispose();engine.dispose();
for (const row of native.projections) {
  const projectionEngine = new NullEngine({renderWidth: row.width, renderHeight: row.height,
    textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4});
  const projectionScene = new Scene(projectionEngine);
  const projectionCamera = new ArcRotateCamera('projection',0,1,174,Vector3.Zero(),projectionScene);
  configureBattleCamera(projectionCamera);
  assert.equal(projectionCamera.fovMode, Camera.FOVMODE_HORIZONTAL_FIXED);
  const m = projectionCamera.getProjectionMatrix(true).m;
  assert(Math.abs(projectionCamera.minZ/m[0]-row.nearHalfWidth)<.00001);
  assert(Math.abs(projectionCamera.minZ/m[5]-row.nearHalfHeight)<.00001);
  projectionScene.dispose();projectionEngine.dispose();
}
console.log(`PASS: ${native.rows.length} native poses, maximum error ${maxError}; production Babylon eye/target, input removal and clip planes`);
