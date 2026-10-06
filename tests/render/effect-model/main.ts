import {Camera, Color4, Engine, FreeCamera, Scene, Texture, Vector3} from '@babylonjs/core';
import {EffectModelAnimation, EffectModelAnimationNode, effectModelVertices} from '../../../apps/web/src/render/effects/models/effect-model-animation';
import {effectModelAmbient} from '../../../apps/web/src/render/effects/models/effect-model-material';
import {EffectModelMesh} from '../../../apps/web/src/render/effects/models/effect-model-mesh';
import {EffectRuntime} from '../../../apps/web/src/render/effects/runtime/effect-runtime';
import {TankView} from '../../../apps/web/src/assets/tanks/tank-view';
interface Step {delta: number; time: number; matrix: number[];}
interface Row {rate: number; duration: number; node: EffectModelAnimationNode; steps: Step[];}

async function verify(): Promise<unknown> {
  const engine = new Engine(document.querySelector<HTMLCanvasElement>('#effect-model-check')!, false,
    {preserveDrawingBuffer: true}, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.05, .1, .15, 1);
  const camera = new FreeCamera('model-check', new Vector3(0, 0, -80), scene);
  camera.setTarget(Vector3.Zero());
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = camera.orthoBottom = -30;
  camera.orthoRight = camera.orthoTop = 30;
  const fixture = await fetch('/effect-model-browser-native.json').then(response => response.json()) as {
    animation: {rows: Row[]};
    geometry: {frames: number[][][]; times: number[]; indices: number[]; rows: {time: number; vertices: number[][]}[]};
  };
  const texture = await new Promise<Texture>((resolve, reject) => {
    const loaded = new Texture('/Data/effect/effect/online/00012A.png', scene, true, false,
      Texture.BILINEAR_SAMPLINGMODE, () => resolve(loaded), message => reject(new Error(message)));
  });
  texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 1;
  // The original geom_t GBF plus supplied inherited CW/depth/blend states.
  const renderer = new EffectModelMesh(scene, texture,
    {cull: 'CW', depthWrite: true, depthTest: true, blend: true, alphaTest: true});
  const ambient = effectModelAmbient([1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,12.8], .75,
    {ambient: [.2,.2,.2,1], emissive: 0});
  const results = [];
  const pixels = async (): Promise<Uint8Array> => {
    scene.render();
    const output = await engine.readPixels(0, 0, 256, 256);
    return new Uint8Array(output.buffer, output.byteOffset, 256 * 256 * 4).slice();
  };
  try {
    for (const row of fixture.animation.rows) {
      const animation = new EffectModelAnimation(row.node, row.duration);
      animation.setRate(row.rate);
      for (const step of row.steps) {
        animation.update(step.delta);
        const native = fixture.geometry.rows.find(sample => sample.time === step.time)!;
        renderer.update(native.vertices, fixture.geometry.indices, step.matrix, ambient);
        await renderer.material.forceCompilationAsync(renderer.mesh);
        const expected = await pixels();
        renderer.update(effectModelVertices(fixture.geometry.frames, fixture.geometry.times, animation.time),
          fixture.geometry.indices, animation.matrix, ambient);
        const actual = await pixels();
        let maxError = 0, changedPixels = 0;
        for (let index = 0; index < actual.length; index += 4) {
          if ([0,1,2].some(channel => actual[index + channel] !== Math.round([.05,.1,.15][channel] * 255))) ++changedPixels;
          for (let channel = 0; channel < 3; ++channel) maxError = Math.max(maxError, Math.abs(actual[index + channel] - expected[index + channel]));
        }
        if (maxError > 2) throw new Error(`Model RGB mismatch ${row.rate}/${step.time}: ${maxError}`);
        results.push({rate: row.rate, time: step.time, maxError, changedPixels});
      }
    }
    renderer.dispose();
    const runtime = new EffectRuntime(scene, camera);
    runtime.start();
    await runtime.load();
    const source = await fetch('/effect-library.json').then(response => response.json()) as {
      nodes: {index: number; name: string}[];
    };
    const production = [];
    camera.orthoLeft = camera.orthoBottom = -150;
    camera.orthoRight = camera.orthoTop = 150;
    for (const index of [91,1175,2827]) {
      await runtime.playWorldEffect({} as TankView, source.nodes.find(node => node.index === index)!.name, [0,0,0]);
      for (let tick = 0; tick < (index === 2827 ? 11 : 1); ++tick) runtime.update(.05);
      scene.render();
      const models = scene.meshes.filter(mesh => mesh.metadata?.sourceNode === index);
      if (!models.length || models.some(mesh => !mesh.isEnabled() || mesh.getTotalVertices() === 0)) {
        throw new Error(`Production type5 model missing ${index}`);
      }
      await Promise.all(models.map(mesh => mesh.material!.forceCompilationAsync(mesh)));
      const actual = await pixels();
      models.forEach(mesh => mesh.setEnabled(false));
      const baseline = await pixels();
      let changedPixels = 0;
      for (let offset = 0; offset < actual.length; offset += 4) {
        if ([0,1,2].some(channel => actual[offset + channel] !== baseline[offset + channel])) ++changedPixels;
      }
      if (!changedPixels) throw new Error(`Production type5 model invisible ${index}`);
      production.push({node: index, meshes: models.length, changedPixels,
        vertices: models.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)});
      runtime.clear();
      if (scene.meshes.some(mesh => mesh.metadata?.originalEffect)) throw new Error('Production type5 cleanup retained meshes');
    }
    runtime.stop();
    return {passed: true, sourceInvocation: 'diagnostic', serverSkillTriggered: false,
      graphicsState: 'explicit fixture', results, production, vertices: fixture.geometry.frames[0].length,
      retainedMeshes: scene.meshes.length};
  } finally {renderer.dispose(); texture.dispose(); scene.dispose(); engine.dispose();}
}

(window as unknown as {effectModelRenderCheck: Promise<unknown>}).effectModelRenderCheck = verify();
