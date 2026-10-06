import {ArcRotateCamera, Color3, Color4, Engine, FreeCamera, Matrix, MeshBuilder, Scene, StandardMaterial, Vector3} from '@babylonjs/core';
import {EffectCameraShakeView} from '../../../apps/web/src/render/effects/camera/effect-camera-shake-view';
import {EffectCameraPose} from '../../../apps/web/src/render/effects/camera/effect-camera-shake';
import {EffectVec3} from '../../../apps/web/src/render/effects/common/types';
import {EffectRuntime} from '../../../apps/web/src/render/effects/runtime/effect-runtime';
import {TankView} from '../../../apps/web/src/assets/tanks/tank-view';

interface Row {
  node: number; config: {parameter: number; strength: number}; duration: number;
  steps: {delta: number; pose: EffectCameraPose; eye: EffectVec3; target: EffectVec3; active: boolean; seed: number}[];
}
const web = (value: EffectVec3): Vector3 => new Vector3(-value[0], value[1], value[2]);

async function verify(): Promise<unknown> {
  const canvas = document.querySelector<HTMLCanvasElement>('#effect-shake-check')!;
  const engine = new Engine(canvas, false, {preserveDrawingBuffer: true}, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.03, .04, .05, 1);
  const camera = new FreeCamera('shake-check', new Vector3(0, 0, -40), scene);
  camera.setTarget(Vector3.Zero());
  camera.minZ = .1;
  const referenceCamera = new FreeCamera('base-camera', new Vector3(0, 0, -40), scene);
  referenceCamera.minZ = .1;
  const box = MeshBuilder.CreateBox('marker', {size: 8}, scene);
  box.position.set(-15, 20, 0);
  const material = new StandardMaterial('marker', scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1, .4, .1);
  box.material = material;
  await material.forceCompilationAsync(box);
  const fixture = await (await fetch('/effect-camera-shake-browser-native.json')).json() as {rows: Row[]};
  let seed = 1;
  const adapter = new EffectCameraShakeView(camera, () => {
    seed = (Math.imul(seed, 214013) + 2531011) >>> 0;
    return (seed >>> 16) & 32767;
  });
  const results = [];
  try {
    for (const row of fixture.rows) {
      seed = 1;
      adapter.activate(row.config.parameter, row.duration, row.config.strength);
      let maxMatrixError = 0, changedPixels = 0;
      for (const step of row.steps) {
        camera.position.copyFrom(web(step.pose.eye));
        camera.setTarget(web(step.pose.target));
        adapter.update(step.delta);
        const actual = camera.getViewMatrix().clone();
        const expected = Matrix.LookAtLH(web(step.eye), web(step.target), Vector3.Up());
        actual.m.forEach((value, index) => {maxMatrixError = Math.max(maxMatrixError, Math.abs(value - expected.m[index]));});
        if (maxMatrixError > .00001) throw new Error(`Native camera matrix mismatch ${row.node}: ${maxMatrixError}`);
        if (seed !== step.seed || adapter.state.active !== step.active) throw new Error('Native camera state/RNG mismatch');
        scene.render();
        const shifted = await engine.readPixels(0, 0, 256, 256);
        referenceCamera.position.copyFrom(web(step.pose.eye)); referenceCamera.setTarget(web(step.pose.target));
        scene.activeCamera = referenceCamera;
        scene.render();
        const baseline = await engine.readPixels(0, 0, 256, 256);
        const a = new Uint8Array(shifted.buffer, shifted.byteOffset, 256 * 256 * 4);
        const b = new Uint8Array(baseline.buffer, baseline.byteOffset, 256 * 256 * 4);
        for (let index = 0; index < a.length; index += 4) {
          if (a[index] !== b[index] || a[index + 1] !== b[index + 1] || a[index + 2] !== b[index + 2]) ++changedPixels;
        }
        scene.activeCamera = camera;
      }
      results.push({node: row.node, maxMatrixError, changedPixels});
      adapter.clear();
    }
    adapter.dispose();
    const arc = new ArcRotateCamera('battle-camera', -.7, .8, 80, new Vector3(15, 20, 0), scene);
    scene.activeCamera = arc;
    const baseline = arc.getViewMatrix(true).clone();
    const target = arc.target.clone(), position = arc.position.clone();
    const runtime = new EffectRuntime(scene, arc);
    runtime.start();
    await runtime.playWorldEffect({} as TankView, '_root\\other\\1000\\11001\\s12\\3\\zhendong', [0, 0, 0]);
    const runtimeState = runtime as unknown as {randomSeed: number};
    runtime.update(.2);
    if (!arc.getViewMatrix().equalsWithEpsilon(baseline, .00001)) throw new Error('Shake started before original next camera update');
    if (runtimeState.randomSeed !== 1) throw new Error('Shake activation consumed camera random values');
    runtime.update(.016);
    const moved = !arc.getViewMatrix().equalsWithEpsilon(baseline, .00001);
    if (!moved) throw new Error('Production source shake did not move battle camera view');
    const expectedSeed = (Math.imul((214013 + 2531011) >>> 0, 214013) + 2531011) >>> 0;
    if (runtimeState.randomSeed !== expectedSeed) throw new Error('Shake did not consume two shared runtime CRT random values');
    if (!arc.target.equals(target) || !arc.position.equals(position)) throw new Error('Shake changed battle camera input pose');
    scene.render();
    await runtime.playWorldEffect({} as TankView, '_root\\other\\1000\\11001\\s12\\3\\zhendong', [0, 0, 0]);
    runtime.update(.2);
    const reactivationRestored = arc.getViewMatrix().equalsWithEpsilon(baseline, .00001);
    if (!reactivationRestored) throw new Error('Repeated activation did not clear the previous camera offset');
    runtime.update(.016);
    runtime.update(.5);
    runtime.update(0);
    const expiryRestored = arc.getViewMatrix().equalsWithEpsilon(baseline, .00001);
    if (!expiryRestored) throw new Error('Expired shake did not restore battle camera');
    await runtime.playWorldEffect({} as TankView, '_root\\other\\1000\\11001\\s12\\3\\zhendong', [0, 0, 0]);
    runtime.update(.2); runtime.update(.016);
    runtime.stop();
    if (!arc.getViewMatrix().equalsWithEpsilon(baseline, .00001)) throw new Error('Stop did not restore battle camera');
    return {passed: true, results, delayedActivation: true, battleCameraMoved: moved,
      battlePoseRetained: true, expiryRestored, reactivationRestored, sharedRandomValues: 2, stopRestored: true,
      retainedEffects: scene.meshes.filter(mesh => mesh.metadata?.originalEffect).length};
  } finally {
    adapter.dispose(); scene.dispose(); engine.dispose();
  }
}
(window as unknown as {effectCameraShakeRenderCheck: Promise<unknown>}).effectCameraShakeRenderCheck = verify();
