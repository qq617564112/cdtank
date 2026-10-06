import {Camera, Color4, Engine, FreeCamera, Scene, Texture, Vector3} from '@babylonjs/core';
import {EffectParticleRenderer} from '../../../apps/web/src/render/effects/particles/effect-particle-renderer';
import {EffectParticlePool} from '../../../apps/web/src/render/effects/particles/effect-particle-pool';
import {advanceEffectParticle, EffectParticleState, EffectParticleUpdateConfig} from '../../../apps/web/src/render/effects/particles/effect-particle-state';
import {packEffectColor, unpackEffectColor} from '../../../apps/web/src/render/effects/common/effect-color';
import {EffectRenderPass} from '../../../apps/web/src/render/effects/common/effect-sprite-mesh';
import {effectBillboardCorners} from '../../../apps/web/src/render/effects/camera/effect-billboard';

interface NativeFixture {
  node: number;
  initial: EffectParticleState[];
  config: EffectParticleUpdateConfig;
  steps: {delta: number; states: EffectParticleState[]}[];
}
interface Grid {
  node: number;
  asset: string;
  uvFrames: [number, number, number, number][];
}

async function verify(): Promise<unknown> {
  const canvas = document.querySelector<HTMLCanvasElement>('#effect-particle-check')!;
  const engine = new Engine(canvas, false, {preserveDrawingBuffer: true}, false);
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const subpixelBits = gl!.getParameter(gl!.SUBPIXEL_BITS) as number;
  const subpixelScale = 2 ** subpixelBits;
  const scene = new Scene(engine);
  const background = [20, 40, 60];
  scene.clearColor = new Color4(...background.map(v => v / 255) as [number, number, number], 1);
  const camera = new FreeCamera('particle-check', new Vector3(0, 0, -80), scene);
  camera.setTarget(Vector3.Zero());
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = camera.orthoBottom = -48;
  camera.orthoRight = camera.orthoTop = 48;
  const library = await (await fetch('/effect-library.json')).json() as {
    textureGrids: Grid[];
    rendering: {particleSelections: {node: number; selector: number}[];
      scripts: {techniques: {passes: EffectRenderPass[]}[]}[]};
  };
  const fixture = await (await fetch('/effect-particle-browser-native.json')).json() as NativeFixture;
  const grid = library.textureGrids.find(g => g.node === fixture.node)!;
  const selection = library.rendering.particleSelections.find(s => s.node === fixture.node)!;
  const image = new Image();
  image.src = `/${grid.asset}`;
  await image.decode();
  const reference = document.createElement('canvas');
  reference.width = image.width;
  reference.height = image.height;
  const context = reference.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const original = context.getImageData(0, 0, image.width, image.height).data;
  const texture = await new Promise<Texture>((resolve, reject) => {
    const loaded = new Texture(`/${grid.asset}`, scene, true, false, Texture.NEAREST_SAMPLINGMODE,
      () => resolve(loaded), (message, exception) => reject(exception ?? new Error(message)));
  });
  texture.anisotropicFilteringLevel = 1;
  const renderer = new EffectParticleRenderer(scene,
    library.rendering.scripts[selection.selector].techniques[0].passes[0], texture, grid.uvFrames);
  const pool = new EffectParticlePool<EffectParticleState>(150, state => structuredClone(state));
  const results = [];
  try {
    pool.emit(fixture.initial.length, () => structuredClone(fixture.initial[pool.particles.length]));
    renderer.update(camera, pool.particles);
    await renderer.sprite.material.forceCompilationAsync(renderer.sprite.mesh);
    results.push(await checkPixels('initial', pool.particles));
    results.push(await checkPixels('reversed', [...pool.particles].reverse()));
    results.push(await checkPixels('hidden', pool.particles.map((state, index) =>
      ({...state, visible: index !== 1}))));
    for (const [index, step] of fixture.steps.entries()) {
      pool.update(step.delta, (state, delta) => advanceEffectParticle(state, fixture.config, delta,
        () => {throw new Error('Node17 must not consume random frame values');}));
      if (JSON.stringify(pool.particles) !== JSON.stringify(step.states)) {
        throw new Error(`Native particle state mismatch at step ${index}`);
      }
      results.push(await checkPixels(`step${index}`, pool.particles));
    }
    pool.emit(1, () => structuredClone(fixture.initial[2]));
    results.push(await checkPixels('restart', pool.particles));
    pool.clear();
    results.push(await checkPixels('clear', pool.particles));
    renderer.dispose();
    return {passed: true, node: fixture.node, asset: grid.asset, selector: selection.selector,
      invertY: texture.invertY, results, retainedMeshes: scene.meshes.length,
      textureRetained: scene.textures.includes(texture), nativeSteps: fixture.steps.length, subpixelBits};
  } finally {
    renderer.dispose();
    texture.dispose();
    scene.dispose();
    engine.dispose();
  }

  async function checkPixels(label: string, states: readonly EffectParticleState[]): Promise<unknown> {
    renderer.update(camera, states);
    scene.render();
    const readback = await engine.readPixels(0, 0, 128, 128);
    const actual = new Uint8Array(readback.buffer, readback.byteOffset, 128 * 128 * 4);
    let worst: unknown;
    let maxError = 0, litPixels = 0, overlappingPixels = 0, orderSensitivePixels = 0;
    const snap = (coordinate: number): number =>
      Math.round((coordinate + 48) * 128 / 96 * subpixelScale) / subpixelScale;
    const particles = states.filter(s => s.visible).map(state => {
      const corners = effectBillboardCorners(state.position,
        [state.scale, state.scale, 0], state.angles[2]);
      return {state, color: unpackEffectColor(packEffectColor(state.color)),
        vertices: [0, 1, 3, 3, 1, 2].flatMap(index => corners[index].map(snap))};
    });
    for (let y = 0; y < 128; ++y) {
      for (let x = 0; x < 128; ++x) {
        const samples: {rgb: number[]; alpha: number}[] = [];
        for (const {state, color, vertices} of particles) {
          // Quantized vertices make the two triangles differ from one affine quad.
          let coordinates: [number, number] | undefined;
          for (const triangle of [0, 3]) {
            const vertex = triangle * 3;
            const ax = vertices[vertex], ay = vertices[vertex + 1];
            const bx = vertices[vertex + 3] - ax, by = vertices[vertex + 4] - ay;
            const cx = vertices[vertex + 6] - ax, cy = vertices[vertex + 7] - ay;
            const dx = 127.5 - x - ax, dy = y + .5 - ay;
            const determinant = bx * cy - by * cx;
            const second = (dx * cy - dy * cx) / determinant;
            const third = (bx * dy - by * dx) / determinant;
            if (second >= 0 && third >= 0 && second + third <= 1) {
              coordinates = triangle === 0 ? [second, third] : [second + third, 1 - second];
              break;
            }
          }
          if (!coordinates) continue;
          const [u, v] = coordinates;
          const uv = grid.uvFrames[state.frame];
          const texelX = Math.floor((uv[0] + u * (uv[2] - uv[0])) * image.width);
          const texelY = Math.floor((uv[1] + v * (uv[3] - uv[1])) * image.height);
          const offset = (texelY * image.width + texelX) * 4;
          const alpha = original[offset + 3] / 255 * color[3];
          if (alpha > 0) samples.push({rgb: color.slice(0, 3).map((c, i) => c * original[offset + i]), alpha});
        }
        const blend = (samplesInOrder: typeof samples): number[] => samplesInOrder.reduce((rgb, sample) =>
          rgb.map((c, i) => Math.round(sample.rgb[i] * sample.alpha + c * (1 - sample.alpha))), [...background]);
        const expected = blend(samples);
        const reversed = blend([...samples].reverse());
        if (samples.length) ++litPixels;
        if (samples.length > 1) ++overlappingPixels;
        if (expected.some((c, i) => Math.abs(c - reversed[i]) > 2)) ++orderSensitivePixels;
        for (let channel = 0; channel < 3; ++channel) {
          const error = Math.abs(actual[(y * 128 + x) * 4 + channel] - expected[channel]);
          if (error > maxError) {
            maxError = error;
            worst = {x, y, expected,
              actual: Array.from(actual.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4))};
          }
        }
      }
    }
    if (maxError > 2) throw new Error(`${label}: particle RGB error ${maxError}: ${JSON.stringify(worst)}`);
    return {label, particles: states.length, visible: particles.length, maxError, litPixels,
      overlappingPixels, orderSensitivePixels, meshEnabled: renderer.sprite.mesh.isEnabled()};
  }
}

(window as unknown as {effectParticleRenderCheck: Promise<unknown>}).effectParticleRenderCheck = verify();
