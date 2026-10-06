import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Mesh, NullEngine, Scene, TransformNode, VertexBuffer} from '@babylonjs/core';
import {ScenePlantSway} from '../apps/web/src/assets/scenes/scene-plant-sway';

const native = JSON.parse(readFileSync('recovery/output/scene-plant02-sway-native.json', 'utf8'));
const resource = JSON.parse(readFileSync('recovery/output/web-assets/scene-plant-0002.json', 'utf8'));
const glb = readFileSync('recovery/output/web-assets/Data/scnobj/obj05413/obj05413.glb');
const jsonSize = glb.readUInt32LE(12);
const model = JSON.parse(glb.subarray(20, 20+jsonSize).toString());
const binaryStart = 28+jsonSize;
const primitive = model.meshes[0].primitives[0];
const accessor = model.accessors[primitive.attributes.POSITION];
const view = model.bufferViews[accessor.bufferView];
const offset = binaryStart+(view.byteOffset ?? 0)+(accessor.byteOffset ?? 0);
const positions = Float32Array.from({length: accessor.count*3}, (_, index) => glb.readFloatLE(offset+index*4));

async function main(): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(resource));
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const template = new Mesh('original-05413', scene);
  template.setVerticesData(VertexBuffer.PositionKind, positions, false);
  template.setIndices(Array.from({length: accessor.count}, (_, index) => index));
  const roots = ['327', '322'].map(id => {
    const root = new TransformNode(id, scene);
    root.position.set(id === '327' ? 1984.561767578125 : 1250.9818115234375, 0,
      id === '327' ? 404.0833740234375 : 929.8328857421875);
    template.createInstance(id).parent = root;
    return root;
  });
  const sway = new ScenePlantSway();
  await sway.load('0002');
  roots.forEach(root => {sway.register(root.name, root);});
  const hooks = sway as unknown as {owners: Map<string, {
    phase: number; parameter: number; height: number; meshes: {mesh: Mesh}[];
  }>; resources: Map<string, unknown>};
  assert.equal(hooks.resources.size, 29);
  const owner = hooks.owners.get('327')!;
  const other = hooks.owners.get('322')!;
  assert.notEqual(owner.meshes[0].mesh.geometry, other.meshes[0].mesh.geometry);
  assert.notEqual(owner.meshes[0].mesh.geometry, template.geometry);
  for (const row of native.rows) {
    owner.phase = Math.fround(row.initial);
    other.phase = Math.fround(row.initial+1);
    sway.advance(row.delta);
    assert.equal(owner.phase, row.phase);
    assert.ok(Math.abs(owner.parameter-row.parameter) <= 1e-9);
    const actual = owner.meshes[0].mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for (let index = 0; index < positions.length; index += 3) {
      const y = positions[index+1];
      const expected = Math.fround(positions[index]+Math.fround(Math.fround(owner.parameter*y)*y));
      assert.equal(actual[index], expected);
      assert.equal(actual[index+1], positions[index+1]);
      assert.equal(actual[index+2], positions[index+2]);
    }
    const mesh = owner.meshes[0].mesh;
    const worldBounds = mesh.getBoundingInfo().boundingBox;
    assert.ok(worldBounds.minimumWorld.x > 1900 && worldBounds.minimumWorld.z > 400,
      'Deformed original327 world bounds must retain its placement for frustum culling');
    const before = Array.from(actual);
    if (owner.phase <= native.period) {
      sway.advance(0);
      assert.deepEqual(Array.from(owner.meshes[0].mesh.getVerticesData(VertexBuffer.PositionKind)!), before,
        'Zero delta must not accumulate vertex deformation');
    }
  }
  assert.deepEqual(Array.from(template.getVerticesData(VertexBuffer.PositionKind)!), Array.from(positions));
  const clones = [...hooks.owners.values()].flatMap(value => value.meshes.map(value => value.mesh));
  sway.dispose();
  assert.equal(hooks.owners.size, 0);
  assert.equal(hooks.resources.size, 0);
  assert.ok(clones.every(mesh => mesh.isDisposed()));
  assert.equal(template.isDisposed(), false);
  sway.advance(.1);

  let releaseFetch!: (response: Response) => void;
  globalThis.fetch = () => new Promise(resolve => {releaseFetch = resolve;});
  const late = new ScenePlantSway();
  const loading = late.load('0002');
  late.dispose();
  releaseFetch(new Response(JSON.stringify(resource)));
  await loading;
  assert.equal((late as unknown as {resources: Map<string, unknown>}).resources.size, 0);
  scene.dispose(); engine.dispose(); globalThis.fetch = originalFetch;
  writeFileSync('recovery/output/scene-plant02-sway-module.json', JSON.stringify({
    status: 'PASS_MODULE_ONLY', nativeRows: native.rows.length, originalVertices: accessor.count,
    independentGeometry: true, sourceTemplateUnchanged: true, nonAccumulating: true,
    ownerClear: true, lateLoadCancelled: true, worldBoundsRetainPlacement: true,
    scope: 'Actual published original GLB vertices and original native phase/coefficient oracle in NullEngine. '
      +'CPU expression follows plant80.gbf; no original GPU precision or ordinary player pixels.',
  }, null, 2)+'\n');
  console.log('PASS_MODULE_ONLY: Plant native phase, source vertex deformation, independent instances and cleanup');
}
void main();
