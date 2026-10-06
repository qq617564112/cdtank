import {Camera, Color4, Engine, FreeCamera, Scene, Texture, Vector3, VertexBuffer} from '@babylonjs/core';
import {effectBoltDrawVertices} from '../../../apps/web/src/render/effects/bolts/effect-bolt-draw';
import {EffectStripVertex} from '../../../apps/web/src/render/effects/common/effect-quad';
import {EffectVec3} from '../../../apps/web/src/render/effects/common/types';
import {EffectRenderPass, EffectSpriteMesh} from '../../../apps/web/src/render/effects/common/effect-sprite-mesh';
import {EffectRuntime} from '../../../apps/web/src/render/effects/runtime/effect-runtime';
import {TankView} from '../../../apps/web/src/assets/tanks/tank-view';

interface NativeRow {
  node: number; segments: number[][]; matrix: number[]; eye: EffectVec3; width: number; color: number;
  vertices: EffectStripVertex[];
}

async function verify(): Promise<unknown> {
  const canvas = document.querySelector<HTMLCanvasElement>('#effect-bolt-check')!;
  const engine = new Engine(canvas, false, {preserveDrawingBuffer: true}, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.04, .06, .08, 1);
  const camera = new FreeCamera('bolt-check', Vector3.Zero(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = camera.orthoBottom = -35;
  camera.orthoRight = camera.orthoTop = 35;
  camera.minZ = .1;
  const [library, fixture] = await Promise.all([
    fetch('/effect-library.json').then(response => response.json()) as Promise<{
      boltTextures: {node: number; asset: string}[];
      boltControls: {node: number; flag: boolean}[];
      rendering: {scripts: {techniques: {passes: EffectRenderPass[]}[]}[]};
    }>,
    fetch('/effect-bolt-browser-native.json').then(response => response.json()) as Promise<{rows: NativeRow[]}>,
  ]);
  const grid = library.boltTextures.find(row => row.node === 131)!;
  const texture = await new Promise<Texture>((resolve, reject) => {
    const loaded = new Texture(`/${grid.asset}`, scene, true, false, Texture.NEAREST_SAMPLINGMODE,
      () => resolve(loaded), message => reject(new Error(message)));
  });
  texture.anisotropicFilteringLevel = 1;
  const selector = library.boltControls.find(row => row.node === 131)!.flag ? 7 : 6;
  const renderer = new EffectSpriteMesh(scene, library.rendering.scripts[selector].techniques[0].passes[0], texture);
  const results = [];
  try {
    for (const row of fixture.rows) {
      camera.position.set(-row.eye[0], row.eye[1], row.eye[2]);
      const middle = row.vertices[Math.floor(row.vertices.length / 2)].position;
      camera.setTarget(new Vector3(-middle[0], middle[1], middle[2]));
      renderer.updateTriangleStrip(row.vertices);
      await renderer.material.forceCompilationAsync(renderer.mesh);
      scene.render();
      const reference = await engine.readPixels(0, 0, 256, 256);
      renderer.updateTriangleStrip(effectBoltDrawVertices(row.segments, row.matrix, row.eye, row.width, row.color));
      scene.render();
      const readback = await engine.readPixels(0, 0, 256, 256);
      const expected = new Uint8Array(reference.buffer, reference.byteOffset, 256 * 256 * 4);
      const actual = new Uint8Array(readback.buffer, readback.byteOffset, 256 * 256 * 4);
      let maxError = 0, visiblePixels = 0;
      for (let index = 0; index < actual.length; index += 4) {
        if (actual[index] > 12 || actual[index + 1] > 18 || actual[index + 2] > 23) ++visiblePixels;
        for (let channel = 0; channel < 3; ++channel) {
          maxError = Math.max(maxError, Math.abs(actual[index + channel] - expected[index + channel]));
        }
      }
      if (maxError > 2 || visiblePixels === 0) throw new Error(`Lightning framebuffer mismatch: ${maxError}, ${visiblePixels}`);
      results.push({maxError, visiblePixels, vertices: renderer.mesh.getTotalVertices(), indices: renderer.mesh.getTotalIndices()});
    }
    const positionData = renderer.mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const retainedVertexCount = positionData.length;
    renderer.updateTriangleStrip([]);
    if (renderer.mesh.isEnabled()) throw new Error('Empty lightning remains visible');
    renderer.dispose();
    const runtime = new EffectRuntime(scene, camera);
    runtime.start();
    await runtime.playWorldEffect({} as TankView, '_root\\other\\1000\\11001\\s5\\1_COPY\\shandian', [0, 0, 0]);
    runtime.update(.016);
    const runtimeMesh = scene.meshes.find(mesh => mesh.metadata?.sourceNode === 131);
    if (!runtimeMesh || runtimeMesh.getTotalVertices() < 4 || !runtimeMesh.isEnabled()) {
      throw new Error('Production source runtime did not render lightning');
    }
    const runtimeVertices = runtimeMesh.getTotalVertices();
    scene.render();
    runtime.stop();
    if (scene.meshes.length !== 0) throw new Error('Production runtime retained lightning after stop');
    return {passed: true, node: 131, selector, asset: grid.asset, results,
      retainedVertexCount, runtimeVertices, retainedMeshes: scene.meshes.length, textureRetained: scene.textures.includes(texture)};
  } finally {
    renderer.dispose(); texture.dispose(); scene.dispose(); engine.dispose();
  }
}

(window as unknown as {effectBoltRenderCheck: Promise<unknown>}).effectBoltRenderCheck = verify();
