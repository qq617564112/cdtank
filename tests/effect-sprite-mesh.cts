import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Constants, FreeCamera, Material, NullEngine, RawTexture, Scene, Texture, Vector3, VertexBuffer} from '@babylonjs/core';
import {EffectSpriteMesh} from '../apps/web/src/render/effects/common/effect-sprite-mesh';
import {effectCameraCorners} from '../apps/web/src/render/effects/camera/effect-camera';
const engine = new NullEngine();
const scene = new Scene(engine);
const texture = RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1,
  scene, false, false, Texture.NEAREST_SAMPLINGMODE);
const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const corners: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] =
  [[-1, -2, 0], [1, -2, 0], [1, 2, 0], [-1, 2, 0]];
for (const index of [6, 7, 8, 9]) {
  const sprite = new EffectSpriteMesh(scene, library.rendering.scripts[index].techniques[0].passes[0], texture);
  sprite.update(corners, [0, 0, .25, .25], 0xff7f3fbf);
  assert.deepEqual(Array.from(sprite.mesh.getVerticesData(VertexBuffer.PositionKind)!),
    [1, -2, 0, -1, -2, 0, 1, 2, 0, 1, 2, 0, -1, -2, 0, -1, 2, 0]);
  assert.equal(sprite.material.backFaceCulling, false);
  assert.equal(sprite.material.disableDepthWrite, true);
  assert.equal(sprite.material.depthFunction, index === 7 || index === 9 ? Constants.LEQUAL : Constants.ALWAYS);
  assert.equal(sprite.material.alphaMode, index < 8 ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE);
  assert.equal(texture.wrapU, Texture.WRAP_ADDRESSMODE);
  sprite.update(corners, [.75, .75, 1, 1], 0x80ffffff);
  assert.deepEqual(Array.from(sprite.mesh.getVerticesData(VertexBuffer.UVKind)!),
    [.75, .75, 1, .75, .75, 1, .75, 1, 1, .75, 1, 1]);
  sprite.dispose();
  sprite.dispose();
  sprite.update(corners, [0, 0, 1, 1], 0xffffffff);
  assert.ok(sprite.mesh.isDisposed());
  assert.equal(scene.meshes.length, 0);
  assert.equal(scene.materials.includes(sprite.material), false);
  assert.equal(scene.textures.includes(texture), true);
}
assert.throws(() => new EffectSpriteMesh(scene, library.rendering.scripts[0].techniques[0].passes[0], texture));
assert.equal(scene.materials.length, 0);
const camera = new FreeCamera('explosion-culling', new Vector3(0, 0, -100), scene);
const explosionPass = library.rendering.scripts.find((script: {index: number}) => script.index === 3).techniques[0].passes[0];
for (const cull of ['CCW', 'CW', 'NONE']) {
  const sprite = new EffectSpriteMesh(scene, {states: [...explosionPass.states,
    {name: 'CullMode', value: cull}]}, texture);
  for (const position of [new Vector3(0, 0, -100), new Vector3(100, 60, -80)]) {
    camera.position.copyFrom(position);
    camera.setTarget(Vector3.Zero());
    sprite.update(effectCameraCorners(camera, [0, 0, 0], [40, 40, 40], 0),
      [0, 0, .25, .25], 0xffffffff);
    const positions = sprite.mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix());
    const [a, b, c] = [0, 3, 6].map(offset =>
      Vector3.TransformCoordinates(Vector3.FromArray(positions, offset), transform));
    const signedArea = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    assert.ok(signedArea < 0, 'reflected explosion billboard faces clockwise in clip space');
    const frontFacing = signedArea < 0 ?
      sprite.material.sideOrientation === Material.ClockWiseSideOrientation :
      sprite.material.sideOrientation === Material.CounterClockWiseSideOrientation;
    assert.equal(!sprite.material.backFaceCulling || frontFacing, cull !== 'CW',
      `native ${cull} must preserve its visible side after reflection`);
  }
  sprite.dispose();
}
texture.dispose();
scene.dispose();
engine.dispose();
console.log('PASS: source GBF mesh/state, projected explosion culling, reflected vertices, UV updates, ownership/disposal; unresolved cull rejected');
