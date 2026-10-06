import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FreeCamera, Material, NullEngine, RawTexture, Scene, Texture, Vector3, VertexBuffer} from '@babylonjs/core';
import {EffectModelMesh} from '../apps/web/src/render/effects/models/effect-model-mesh';
import {EffectOverlayMesh} from '../apps/web/src/render/effects/overlays/effect-overlay-mesh';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';

const engine = new NullEngine();
const scene = new Scene(engine);
const texture = RawTexture.CreateRGBATexture(new Uint8Array([255, 128, 64, 128]),
  1, 1, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
const camera = new FreeCamera('culling', new Vector3(0, 0, -10), scene);
camera.setTarget(Vector3.Zero());
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const pass = library.rendering.overlayScripts.find((row: {textured: boolean}) => row.textured)
  .techniques[0].passes[0];
const area = ([a, b, c]: Vector3[]): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const visible = (material: Material, signedArea: number): boolean =>
  !material.backFaceCulling || (signedArea < 0 ?
    material.sideOrientation === Material.ClockWiseSideOrientation :
    material.sideOrientation === Material.CounterClockWiseSideOrientation);

for (const cull of ['CCW', 'CW', 'NONE'] as const) {
  const model = new EffectModelMesh(scene, texture,
    {cull, depthWrite: true, depthTest: true, blend: true, alphaTest: true});
  model.update([[-1, -1, 0, 0, 0, 0, 0, 0], [1, -1, 0, 0, 0, 0, 1, 0],
    [-1, 1, 0, 0, 0, 0, 0, 1]], [0, 1, 2], EFFECT_IDENTITY, [1, 1, 1, 1]);
  const positions = model.mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix());
  const signedArea = area([0, 3, 6].map(offset =>
    Vector3.TransformCoordinates(Vector3.FromArray(positions, offset), transform)));
  assert.ok(signedArea < 0);
  assert.equal(visible(model.material, signedArea), cull !== 'CW');
  assert.equal(visible(model.material, -signedArea), cull !== 'CCW');
  model.dispose();

  const overlay = new EffectOverlayMesh(scene, {states: [...pass.states,
    {name: 'CullMode', value: cull}, {name: 'AlphaTestEnable', value: 'FALSE'}]}, texture);
  overlay.update({rectangle: [0, 64, 64, 0, 0, 0, 1, 1], z: 0, color: 0xffffffff});
  const screen = overlay.mesh.getVerticesData(VertexBuffer.PositionKind)!;
  // Match the overlay shader's pixel-to-clip transform, including its Y flip.
  const overlayArea = area([0, 3, 6].map(offset =>
    new Vector3(screen[offset] * 2 / 64 - 1, 1 - screen[offset + 1] * 2 / 64, 0)));
  assert.ok(overlayArea > 0);
  assert.equal(visible(overlay.material, overlayArea), cull !== 'CCW');
  assert.equal(visible(overlay.material, -overlayArea), cull !== 'CW');
  overlay.dispose();
  assert.ok(scene.textures.includes(texture));
}
assert.equal(scene.meshes.length, 0);
texture.dispose();
scene.dispose();
engine.dispose();
console.log('PASS: reflected model and screen-space overlay front/back culling, all GBF modes, texture ownership');
