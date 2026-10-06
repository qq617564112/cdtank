import assert from 'node:assert/strict';
import {FreeCamera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {effectCameraCorners} from '../apps/web/src/render/effects/camera/effect-camera';
import {effectBillboardCorners} from '../apps/web/src/render/effects/camera/effect-billboard';
import type {EffectVec3} from '../apps/web/src/render/effects/common/types';
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('camera-check', Vector3.Zero(), scene);
let cases = 0;
for (const position of [[0, 0, -10], [20, 15, -30], [-100, 40, 25]]) {
  camera.position.copyFromFloats(...position as EffectVec3);
  camera.setTarget(new Vector3(-3, 5, 7));
  for (const center of [[3, 5, 7], [-14, 20, 4]] as EffectVec3[]) {
    for (const angle of [0, 30, 90, -45]) {
      const worldCorners = effectCameraCorners(camera, center, [2, 3, 99], angle);
      const view = camera.getViewMatrix();
      const centerCamera = Vector3.TransformCoordinates(new Vector3(-center[0], center[1], center[2]), view);
      const expected = effectBillboardCorners([-centerCamera.x, centerCamera.y, centerCamera.z], [2, 3, 99], angle);
      for (let index = 0; index < 4; ++index) {
        const world = worldCorners[index];
        const projected = Vector3.TransformCoordinates(new Vector3(-world[0], world[1], world[2]), view);
        for (const [actual, target] of [[-projected.x, expected[index][0]],
          [projected.y, expected[index][1]], [projected.z, expected[index][2]]]) {
          assert.ok(Math.abs(actual - target) < 0.0001);
        }
      }
      const a = Vector3.FromArray(worldCorners[0]);
      const b = Vector3.FromArray(worldCorners[1]);
      const d = Vector3.FromArray(worldCorners[3]);
      assert.ok(Math.abs(Vector3.Distance(a, b) - 4) < .0001);
      assert.ok(Math.abs(Vector3.Distance(a, d) - 6) < .0001);
      ++cases;
    }
  }
}
scene.dispose();
engine.dispose();
console.log(`PASS: ${cases} translated/rotated Web camera billboards, native reflection and half-size preservation`);
