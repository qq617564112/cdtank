import {Camera, Color4, Engine, FreeCamera, MeshBuilder, RawTexture, Scene, ShaderMaterial, Texture, Vector3} from '@babylonjs/core';
import {EffectSpriteMesh} from '../../../apps/web/src/render/effects/common/effect-sprite-mesh';
import {EffectSpriteAtlas} from '../../../apps/web/src/render/effects/sprites/effect-sprite-atlas';
import type {EffectVec3} from '../../../apps/web/src/render/effects/common/types';
import {packEffectColor, unpackEffectColor} from '../../../apps/web/src/render/effects/common/effect-color';
import {effectCameraCorners} from '../../../apps/web/src/render/effects/camera/effect-camera';

async function verify(): Promise<unknown> {
  const canvas = document.querySelector<HTMLCanvasElement>('#effect-check')!;
  const engine = new Engine(canvas, false, {preserveDrawingBuffer: true, alpha: true}, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(20 / 255, 40 / 255, 60 / 255, 1);
  const camera = new FreeCamera('check', new Vector3(0, 0, -10), scene);
  camera.setTarget(Vector3.Zero());
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = camera.orthoBottom = -2;
  camera.orthoRight = camera.orthoTop = 2;
  const texture = RawTexture.CreateRGBATexture(new Uint8Array([200, 100, 50, 128]), 1, 1,
    scene, false, false, Texture.NEAREST_SAMPLINGMODE);
  const library = await (await fetch('/effect-library.json')).json();
  const blocker = MeshBuilder.CreatePlane('depth-check', {size: 2}, scene);
  blocker.position.z = -1;
  const blockerMaterial = new ShaderMaterial('depth-check', scene, {
    vertexSource: 'precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;void main(){gl_Position=worldViewProjection*vec4(position,1.0);}',
    fragmentSource: 'precision highp float;void main(){gl_FragColor=vec4(0.2,0.4,0.6,1.0);}',
  }, {attributes: ['position'], uniforms: ['worldViewProjection']});
  blockerMaterial.backFaceCulling = false;
  blocker.material = blockerMaterial;
  blocker.setEnabled(false);
  const results = [];
  try {
    for (const index of [6, 7, 8, 9]) {
      const sprite = new EffectSpriteMesh(scene, library.rendering.scripts[index].techniques[0].passes[0], texture);
      try {
        sprite.update([[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], [0, 0, 1, 1], 0xff7fffff);
        await sprite.material.forceCompilationAsync(sprite.mesh);
        scene.render();
        const pixels = await engine.readPixels(32, 32, 1, 1);
        const actual = Array.from(new Uint8Array(pixels.buffer, pixels.byteOffset, 4));
        const source = [200 * 127 / 255, 100, 50];
        const alpha = 128 / 255;
        const background = [20, 40, 60];
        const expected = source.map((v, channel) => Math.round(v * alpha +
          background[channel] * (index < 8 ? 1 : 1 - alpha)));
        if (expected.some((v, channel) => Math.abs(v - actual[channel]) > 2)) {
          throw new Error(`GBF ${index} pixel ${actual} expected RGB ${expected}`);
        }
        results.push({index, actual, expected});
        blocker.setEnabled(true);
        await blockerMaterial.forceCompilationAsync(blocker);
        scene.render();
        const blockedPixels = await engine.readPixels(32, 32, 1, 1);
        const blockedActual = Array.from(new Uint8Array(blockedPixels.buffer, blockedPixels.byteOffset, 4));
        const blockerRGB = [51, 102, 153];
        const blockedExpected = index === 7 || index === 9 ? blockerRGB :
          source.map((v, channel) => Math.round(v * alpha +
            blockerRGB[channel] * (index < 8 ? 1 : 1 - alpha)));
        if (blockedExpected.some((v, channel) => Math.abs(v - blockedActual[channel]) > 2)) {
          throw new Error(`GBF ${index} depth pixel ${blockedActual} expected ${blockedExpected}`);
        }
        results[results.length - 1] = {index, actual, expected, blockedActual, blockedExpected};
        blocker.setEnabled(false);
      } finally {
        sprite.dispose();
      }
    }
    blocker.dispose();
    blockerMaterial.dispose();
    const explosion = await verifyOriginalAtlas(engine, scene, library);
    return {passed: true, results, explosion, retainedMeshes: scene.meshes.length,
      textureRetained: scene.textures.includes(texture), resolution: [engine.getRenderWidth(), engine.getRenderHeight()]};
  } finally {
    texture.dispose();
    scene.dispose();
    engine.dispose();
  }
}

async function verifyOriginalAtlas(engine: Engine, scene: Scene, library: any): Promise<unknown> {
  const grid = library.textureGrids.find((r: {node: number}) => r.node === 2431);
  const control = library.spriteControls.find((r: {node: number}) => r.node === 2431);
  const selection = library.rendering.spriteSelections.find((r: {node: number}) => r.node === 2431);
  const assetBytes = await (await fetch(`/${grid.asset}`)).arrayBuffer();
  const assetHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', assetBytes)))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (assetHash !== grid.assetSha256) throw new Error('Original explosion PNG hash mismatch');
  const image = new Image();
  image.src = `/${grid.asset}`;
  await image.decode();
  const reference = document.createElement('canvas');
  reference.width = image.width;
  reference.height = image.height;
  const context = reference.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const original = context.getImageData(0, 0, image.width, image.height).data;
  // Native D3D UV origin is the image top. Keep PNG row order on upload.
  const texture = await new Promise<Texture>((resolve, reject) => {
    const loaded = new Texture(`/${grid.asset}`, scene, true, false, Texture.NEAREST_SAMPLINGMODE,
      () => resolve(loaded), (message, exception) => {
        loaded.dispose();
        reject(exception ?? new Error(message));
      });
  });
  const sprite = new EffectSpriteMesh(scene,
    library.rendering.scripts[selection.selector].techniques[0].passes[0], texture);
  const atlas = new EffectSpriteAtlas(sprite, control, grid.uvFrames, () => {
    throw new Error('Original clamped explosion must not consume random');
  });
  const corners = effectCameraCorners(scene.activeCamera!, [0, 0, 0], [2, 2, 0], 0);
  scene.clearColor = new Color4(0, 0, 0, 1);
  const frames = [];
  const packed = packEffectColor(control.appearance.color);
  const color = unpackEffectColor(packed);
  try {
    atlas.reset(corners, packed);
    await sprite.material.forceCompilationAsync(sprite.mesh);
    for (let frame = 0; frame < 16; ++frame) {
      let selected = atlas.clock.frame;
      if (frame === 1) {
        const half = atlas.update(control.frameInterval / 2, corners, packed);
        if (half !== 0) throw new Error('Original explosion advanced at half interval');
        selected = atlas.update(control.frameInterval / 2, corners, packed);
      } else if (frame > 1) {
        selected = atlas.update(control.frameInterval, corners, packed);
      }
      if (selected !== frame) throw new Error(`Original frame clock selected ${selected} instead of ${frame}`);
      scene.render();
      const pixels = await engine.readPixels(0, 0, 64, 64);
      const actual = new Uint8Array(pixels.buffer, pixels.byteOffset, 64 * 64 * 4);
      const cellX = frame % 4 * 64, cellY = Math.floor(frame / 4) * 64;
      let maxError = 0, visiblePixels = 0, litPixels = 0;
      for (let y = 0; y < 64; ++y) {
        for (let x = 0; x < 64; ++x) {
          // Native X is reflected to Web; framebuffer readback starts at bottom.
          const source = ((cellY + y) * 256 + cellX + 63 - x) * 4;
          const target = (y * 64 + x) * 4;
          const alpha = original[source + 3] / 255;
          if (alpha > 0) ++visiblePixels;
          if (actual[target] > 0 || actual[target + 1] > 0 || actual[target + 2] > 0) ++litPixels;
          for (let channel = 0; channel < 3; ++channel) {
            maxError = Math.max(maxError, Math.abs(actual[target + channel] -
              Math.round(original[source + channel] * color[channel] * alpha * color[3])));
          }
        }
      }
      if (maxError > 2) throw new Error(`Original explosion frame ${frame} pixel error ${maxError}`);
      const pixelHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(actual))))
        .map(value => value.toString(16).padStart(2, '0')).join('');
      frames.push({frame, maxError, visiblePixels, litPixels, pixelHash});
    }
    const clamped = atlas.update(1, corners, packed);
    if (clamped !== 15) throw new Error('Original explosion last frame did not clamp');
    return {node: 2431, asset: grid.asset, assetHash, packedColor: packed,
      invertY: texture.invertY, frames, halfIntervalRetained: true, clamped};
  } finally {
    sprite.dispose();
    texture.dispose();
  }
}

(window as unknown as {effectRenderCheck: Promise<unknown>}).effectRenderCheck = verify();
