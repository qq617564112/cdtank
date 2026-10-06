import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {LoadAssetContainerAsync, Mesh, NullEngine, Scene, TransformNode, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {ScenePlantSway} from '../apps/web/src/assets/scenes/scene-plant-sway';

async function main(): Promise<void> {
  const resource = JSON.parse(readFileSync('recovery/output/web-assets/scene-plant-0004.json', 'utf8'));
  const native = JSON.parse(readFileSync('recovery/output/scene-plant02-sway-native.json', 'utf8'));
  const sceneRecords = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json', 'utf8'))
    .find((entry: {id: string}) => entry.id === '0004').records;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(resource));
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const sway = new ScenePlantSway();
  await sway.load('0004');
  const hooks = sway as unknown as {resources: Map<string, unknown>; owners: Map<string, {
    phase: number; parameter: number; height: number;
    meshes: {mesh: Mesh; source: Float32Array; positions: Float32Array}[];
  }>};
  assert.equal(hooks.resources.size, 106);
  const assets = [];
  const templates: {mesh: Mesh; positions: number[]}[] = [];
  const roots: TransformNode[] = [];
  let changedVertices = 0;
  const models = [...new Set<string>(resource.plants.map((plant: {model: string}) => plant.model))];
  for (const model of models) {
    const plant = resource.plants.find((plant: {model: string}) => plant.model === model);
    const placement = sceneRecords.find((record: {id: string}) => record.id === plant.sourcePlacementId);
    const bytes = readFileSync(`recovery/output/web-assets/Data/scnobj/${model}/${model}.glb`);
    const asset = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {pluginExtension: '.glb'});
    assets.push(asset);
    for (const mesh of asset.meshes) {
      if (mesh instanceof Mesh && mesh.getTotalVertices()) {
        templates.push({mesh, positions: Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!)});
      }
    }
    const instance = asset.instantiateModelsToScene(name => `${plant.sourcePlacementId}/${name}`, false);
    const root = new TransformNode(plant.sourcePlacementId, scene);
    root.position.set(-placement.position[0], placement.position[1], placement.position[2]);
    instance.rootNodes.forEach(node => {node.parent = root;});
    roots.push(root);
    sway.register(plant.sourcePlacementId, root);
    const owner = hooks.owners.get(plant.sourcePlacementId)!;
    assert.equal(owner.height, plant.height);
    assert.equal(owner.meshes.length, 1);
    assert.ok(templates.every(template => template.mesh.geometry !== owner.meshes[0].mesh.geometry));
  }
  for (const row of native.rows) {
    for (const owner of hooks.owners.values()) owner.phase = Math.fround(row.initial);
    sway.advance(row.delta);
    for (const owner of hooks.owners.values()) {
      assert.equal(owner.phase, row.phase);
      const parameter = Math.fround(Math.cos(owner.phase)/owner.height*Math.fround(.15));
      assert.equal(owner.parameter, parameter);
      for (const value of owner.meshes) {
        const actual = value.mesh.getVerticesData(VertexBuffer.PositionKind)!;
        for (let i = 0; i < value.source.length; i += 3) {
          const y = value.source[i+1];
          assert.equal(actual[i], Math.fround(value.source[i]+Math.fround(Math.fround(parameter*y)*y)));
          assert.equal(actual[i+1], y);
          assert.equal(actual[i+2], value.source[i+2]);
          if (actual[i] !== value.source[i]) changedVertices++;
        }
        const bounds = value.mesh.getBoundingInfo().boundingBox;
        const root = roots.find(root => root.name === value.mesh.metadata.sourcePlantSway)!;
        assert.ok(Math.abs(bounds.centerWorld.x-root.position.x) < 100);
        assert.ok(Math.abs(bounds.centerWorld.z-root.position.z) < 100);
      }
    }
  }
  assert.ok(changedVertices > 0);
  templates.forEach(value => assert.deepEqual(Array.from(value.mesh.getVerticesData(VertexBuffer.PositionKind)!), value.positions));
  const meshes = [...hooks.owners.values()].flatMap(owner => owner.meshes.map(value => value.mesh));
  sway.dispose();
  assert.equal(hooks.resources.size, 0);
  assert.equal(hooks.owners.size, 0);
  assert.ok(meshes.every(mesh => mesh.isDisposed()));
  assert.ok(templates.every(value => !value.mesh.isDisposed()));
  let releaseFetch!: (response: Response) => void;
  globalThis.fetch = () => new Promise(resolve => {releaseFetch = resolve;});
  const late = new ScenePlantSway();
  const loading = late.load('0004');
  late.dispose();
  releaseFetch(new Response(JSON.stringify(resource)));
  await loading;
  assert.equal((late as unknown as {resources: Map<string, unknown>}).resources.size, 0);
  roots.forEach(root => root.dispose());
  assets.forEach(asset => asset.dispose());
  scene.dispose(); engine.dispose(); globalThis.fetch = originalFetch;
  writeFileSync('recovery/output/scene-plant04-sway-module.json', JSON.stringify({
    status: 'PASS_MODULE_ONLY', mapId: 4, placements: 106, models,
    nativePhaseRowsReused: native.rows.length, changedVertices,
    sourceTemplatesUnchanged: true, independentGeometry: true,
    worldBoundsRetainPlacement: true, ownerClear: true, lateLoadCancelled: true,
    scope: 'Original published four Plant GLBs with existing native phase and CPU shader-expression contract; no ordinary player pixels or ambient material proof.',
  }, null, 2)+'\n');
  console.log('PASS_MODULE_ONLY: four original Plant models/sway/placed bounds/owner clear');
}
void main();
