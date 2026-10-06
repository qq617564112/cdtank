import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {NullEngine, Scene, ShaderMaterial} from '@babylonjs/core';
import {SceneBreachVisual} from '../recovery/prepared/scene-breach-resource-ready';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';

async function main(): Promise<void> {
  const library = JSON.parse(readFileSync('recovery/output/web-assets/scene-breach-0014.json', 'utf8'));
  const originalFetch = globalThis.fetch;
  const originalCompile = ShaderMaterial.prototype.forceCompilationAsync;
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const baseline = {meshes: scene.meshes.length, materials: scene.materials.length,
    textures: scene.textures.length};
  const pending: Array<() => void> = [];
  const compileMeshes: object[] = [];
  let visibleDuringCompilation = false;
  globalThis.fetch = async input => {
    assert.equal(input, '/scene-breach-0014.json');
    return new Response(JSON.stringify(library), {status: 200});
  };
  ShaderMaterial.prototype.forceCompilationAsync = function(mesh) {
    assert(mesh);
    compileMeshes.push(mesh);
    visibleDuringCompilation ||= mesh.isEnabled();
    const gate = new Promise<void>(resolve => pending.push(resolve));
    return gate;
  };
  const rows: object[] = [];
  try {
    for (const disposeWhileWaiting of [false, true]) {
      pending.length = 0;
      compileMeshes.length = 0;
      const visual = new SceneBreachVisual(scene, '198', [...EFFECT_IDENTITY],
        'obj05425', '/scene-breach-0014.json');
      let loaded = false;
      const loading = visual.load().then(() => {loaded = true;});
      const deadline = performance.now() + 5000;
      while (pending.length !== 8 && performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      assert.equal(pending.length, 8, 'Every original model part requests compilation');
      assert.equal(loaded, false, 'Load must await the compilation barrier');
      const renderer = (visual as any).renderer;
      const meshes = [...renderer.meshes];
      const materials = meshes.map(mesh => mesh.material);
      assert.equal(meshes.length, 8);
      assert.deepEqual(compileMeshes, meshes);
      assert(meshes.every(mesh => mesh.getTotalVertices() === 36 && !mesh.isEnabled()));
      assert(renderer.animations.every((clock: any) => clock.time === 0 && clock.rate === 0));
      if (disposeWhileWaiting) visual.dispose();
      for (const resolve of pending) resolve();
      await loading;
      if (!disposeWhileWaiting) {
        assert(meshes.every(mesh => !mesh.isEnabled()));
        assert(renderer.animations.every((clock: any) => clock.time === 0));
        visual.advance(.1, .8, true);
        assert.deepEqual(renderer.meshes, meshes, 'Advance reuses the prepared geometry');
        assert.deepEqual(renderer.meshes.map((mesh: any) => mesh.material), materials);
        assert(meshes.every(mesh => mesh.isEnabled()));
        assert(renderer.animations.every((clock: any) => clock.time > 0));
        assert.equal(compileMeshes.length, 8, 'Advance does not recreate or recompile');
        visual.dispose();
      }
      assert.equal(scene.meshes.length, baseline.meshes);
      assert.equal(scene.materials.length, baseline.materials);
      assert.equal(scene.textures.length, baseline.textures);
      rows.push({disposeWhileWaiting, parts: 8, loadWaitsForCompilation: true,
        hiddenAtTimeZero: true, advanceReusesGeometry: !disposeWhileWaiting,
        resourcesReleased: true});
    }
    assert.equal(visibleDuringCompilation, false);
    writeFileSync('recovery/output/scene-breach-resource-ready-prepared.json', JSON.stringify({
      status: 'PASS_PREPARED_BREACH_HIDDEN_RESOURCE_READY_LIFECYCLE', rows,
      scope: 'Prepared SceneBreachVisual load using the real renderer, NullEngine texture and '
        + 'geometry and a deferred compilation callback to verify the load barrier. No GPU '
        + 'timing, ordinary input, animation pose coverage or original shader equivalence claim.',
    }, null, 2) + '\n');
    console.log('PASS_PREPARED_BREACH_HIDDEN_RESOURCE_READY_LIFECYCLE');
  } finally {
    globalThis.fetch = originalFetch;
    ShaderMaterial.prototype.forceCompilationAsync = originalCompile;
    scene.dispose();
    engine.dispose();
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
