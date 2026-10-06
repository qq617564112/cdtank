import {Color4, Engine, FreeCamera, Scene, Texture, Vector3} from '@babylonjs/core';
import {EffectOverlayMesh} from '../../../apps/web/src/render/effects/overlays/effect-overlay-mesh';
import {EffectOverlayRectangle} from '../../../apps/web/src/render/effects/overlays/effect-overlay-draw';
import {unpackEffectColor} from '../../../apps/web/src/render/effects/common/effect-color';
import {EffectRenderPass} from '../../../apps/web/src/render/effects/common/effect-sprite-mesh';
import {EffectRuntime} from '../../../apps/web/src/render/effects/runtime/effect-runtime';
import {TankView} from '../../../apps/web/src/assets/tanks/tank-view';

async function verify(): Promise<unknown> {
  const canvas = document.querySelector<HTMLCanvasElement>('#effect-overlay-check')!;
  const engine = new Engine(canvas, false, {preserveDrawingBuffer: true}, false);
  const scene = new Scene(engine);
  const background = [40, 80, 120];
  scene.clearColor = new Color4(40 / 255, 80 / 255, 120 / 255, 1);
  const camera = new FreeCamera('overlay-check', new Vector3(0, 0, -80), scene);
  camera.setTarget(Vector3.Zero());
  const [library, fixture] = await Promise.all([
    fetch('/effect-library.json').then(response => response.json()) as Promise<{
      textureGrids: {node: number; asset: string}[];
      rendering: {overlayScripts: {textured: boolean; techniques: {passes: EffectRenderPass[]}[]}[]};
    }>,
    fetch('/effect-overlay-browser-native.json').then(response => response.json()) as Promise<{
      rows: {frame: number; draw: EffectOverlayRectangle}[];
    }>,
  ]);
  const grid = library.textureGrids.find(row => row.node === 905)!;
  const image = new Image(); image.src = `/${grid.asset}`; await image.decode();
  const reference = document.createElement('canvas'); reference.width = image.width; reference.height = image.height;
  const context = reference.getContext('2d')!; context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const texture = await new Promise<Texture>((resolve, reject) => {
    const loaded = new Texture(`/${grid.asset}`, scene, true, false, Texture.NEAREST_SAMPLINGMODE,
      () => resolve(loaded), message => reject(new Error(message)));
  });
  texture.anisotropicFilteringLevel = 1;
  const pass = library.rendering.overlayScripts.find(row => row.textured)!.techniques[0].passes[0];
  const renderer = new EffectOverlayMesh(scene, {states: [...pass.states,
    {name: 'CullMode', value: 'NONE'}, {name: 'AlphaTestEnable', value: 'FALSE'}]}, texture);
  const results = [];
  try {
    for (const row of fixture.rows) {
      const draw: EffectOverlayRectangle = {...row.draw,
        rectangle: [0, 128, 128, 0, ...row.draw.rectangle.slice(4) as [number, number, number, number]]};
      renderer.update(draw);
      await renderer.material.forceCompilationAsync(renderer.mesh);
      scene.render();
      const readback = await engine.readPixels(0, 0, 128, 128);
      const actual = new Uint8Array(readback.buffer, readback.byteOffset, 128 * 128 * 4);
      const [u0, v0, u1, v1] = draw.rectangle.slice(4);
      const color = unpackEffectColor(draw.color);
      let maxError = 0, changedPixels = 0;
      let worst: unknown;
      for (let y = 0; y < 128; ++y) for (let x = 0; x < 128; ++x) {
        const tx = Math.min(image.width - 1, Math.floor((u0 + (x + .5) / 128 * (u1 - u0)) * image.width));
        const ty = Math.min(image.height - 1, Math.floor((v0 + (y + .5) / 128 * (v1 - v0)) * image.height));
        const offset = (ty * image.width + tx) * 4;
        const alpha = pixels[offset + 3] / 255 * color[3];
        if (alpha > 0) ++changedPixels;
        for (let channel = 0; channel < 3; ++channel) {
          const expected = Math.round(pixels[offset + channel] * color[channel] * alpha + background[channel] * (1 - alpha));
          const error = Math.abs(actual[(y * 128 + x) * 4 + channel] - expected);
          if (error > maxError) {maxError = error; worst = {x, y, tx, ty, channel, expected, actual: actual[(y * 128 + x) * 4 + channel], alpha};}
        }
      }
      if (maxError > 2) throw new Error(`Overlay RGB mismatch frame ${row.frame}: ${maxError} ${JSON.stringify(worst)}`);
      results.push({frame: row.frame, maxError, changedPixels});
    }
    renderer.dispose();
    const runtime = new EffectRuntime(scene, camera);
    runtime.start();
    // A preceding original world pass supplies the inherited CullMode/AlphaTest state.
    await runtime.playWorldEffect({} as TankView, '_root\\other\\1000\\11001\\s5\\1_COPY\\shandian', [0, 0, 0]);
    runtime.update(.016);
    await runtime.playWorldEffect({} as TankView, '_root\\other\\1000\\11009\\s3\\2\\liefen', [0, 0, 0]);
    runtime.update(.8);
    const mesh = scene.meshes.find(row => row.metadata?.sourceNode === 905);
    if (!mesh || mesh.getTotalVertices() !== 6) throw new Error('Production runtime did not draw overlay');
    scene.render();
    runtime.stop();
    if (scene.meshes.length) throw new Error('Overlay runtime retained meshes');
    return {passed: true, node: 905, asset: grid.asset, results, runtimeVertices: 6, retainedMeshes: scene.meshes.length};
  } finally {
    renderer.dispose(); texture.dispose(); scene.dispose(); engine.dispose();
  }
}

(window as unknown as {effectOverlayRenderCheck: Promise<unknown>}).effectOverlayRenderCheck = verify();
