import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Constants, LoadAssetContainerAsync, NullEngine, Scene, ShaderMaterial, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {SceneTerrainMaterial} from '../apps/web/src/assets/scenes/scene-terrain-material';

async function main(): Promise<void> {
  const mapId = Number(process.argv[2] ?? 2);
  const mapName = String(mapId).padStart(4, '0');
  const expectedParts = mapId === 4 ? 146 : mapId === 17 ? 120 : mapId === 14 ? 47 : mapId === 6 ? 125 : mapId === 10 ? 112 : mapId === 5 ? 124 : mapId === 22 ? 72 : mapId === 21 ? 103 : mapId === 20 ? 190 : mapId === 7 ? 56 : mapId === 11 ? 118 : mapId === 18 ? 21 : 76;
  const expectedOpaque = mapId === 4 ? 123 : mapId === 17 ? 90 : mapId === 14 ? 38 : mapId === 6 ? 97 : mapId === 10 ? 67 : mapId === 5 ? 82 : mapId === 22 ? 46 : mapId === 21 ? 70 : mapId === 20 ? 139 : mapId === 7 ? 33 : mapId === 11 ? 93 : mapId === 18 ? 21 : 58;
  const expectedTransparent = mapId === 4 ? 23 : mapId === 17 ? 30 : mapId === 14 ? 9 : mapId === 6 ? 28 : mapId === 10 ? 45 : mapId === 5 ? 42 : mapId === 22 ? 26 : mapId === 21 ? 33 : mapId === 20 ? 51 : mapId === 7 ? 23 : mapId === 11 ? 25 : mapId === 18 ? 0 : 18;
  const resource = JSON.parse(readFileSync(`recovery/output/web-assets/scene-terrain-material-${mapName}.json`, 'utf8'));
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const bytes = readFileSync(`recovery/output/web-assets/Data/map/${mapName}/${mapName}.glb`);
  const terrain = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {pluginExtension: '.glb'});
  const before = terrain.meshes.map(mesh => ({mesh, material: mesh.material,
    positions: Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) ?? []),
    colors: Array.from(mesh.getVerticesData(VertexBuffer.ColorKind) ?? []),
    uvs: Array.from(mesh.getVerticesData(VertexBuffer.UVKind) ?? [])}));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(resource));
  const owner = new SceneTerrainMaterial();
  await owner.load(mapName, terrain);
  assert.equal(terrain.meshes.filter(mesh => mesh.material instanceof ShaderMaterial).length, expectedParts);
  let opaque = 0, alphaTest = 0;
  for (const part of resource.parts) {
    const mesh = terrain.meshes.find(mesh => mesh.name === part.mesh)!;
    const material = mesh.material as ShaderMaterial;
    assert.equal(material.metadata.sourceTerrainShader, part.shader);
    assert.equal(material.needAlphaBlending(), part.kind === 1);
    assert.equal(material.needAlphaTesting(), part.kind === 1);
    assert.equal(material.forceDepthWrite, true);
    assert.equal(material.depthFunction, Constants.LESS);
    part.kind === 1 ? alphaTest++ : opaque++;
  }
  for (const part of resource.withheldParts ?? []) {
    const value = before.find(value => value.mesh.name === part.mesh)!;
    assert.equal(value.mesh.material, value.material);
    assert.ok(!(value.mesh.material instanceof ShaderMaterial));
  }
  for (const value of before) {
    assert.deepEqual(Array.from(value.mesh.getVerticesData(VertexBuffer.PositionKind) ?? []), value.positions);
    assert.deepEqual(Array.from(value.mesh.getVerticesData(VertexBuffer.ColorKind) ?? []), value.colors);
    assert.deepEqual(Array.from(value.mesh.getVerticesData(VertexBuffer.UVKind) ?? []), value.uvs);
  }
  assert.equal(opaque, expectedOpaque); assert.equal(alphaTest, expectedTransparent);
  owner.dispose();
  for (const value of before) assert.equal(value.mesh.material, value.material);
  assert.equal(scene.materials.filter(material => material.name.startsWith(`terrain${String(mapId).padStart(2, '0')}/`)).length, 0);
  let resolveFetch!: (response: Response) => void;
  globalThis.fetch = () => new Promise(resolve => {resolveFetch = resolve;});
  const late = new SceneTerrainMaterial();
  const loading = late.load(mapName, terrain);
  late.dispose();
  resolveFetch(new Response(JSON.stringify(resource)));
  await loading;
  for (const value of before) assert.equal(value.mesh.material, value.material);
  globalThis.fetch = originalFetch;
  terrain.dispose(); scene.dispose(); engine.dispose();
  writeFileSync(`recovery/output/scene-terrain${String(mapId).padStart(2, '0')}-material-module.json`, JSON.stringify({
    status: 'PASS_MODULE_ONLY', mapId, originalGlbParts: expectedParts, opaque, alphaTest,
    withheldPartsUnchanged: (resource.withheldParts ?? []).map((part: {mesh: string}) => part.mesh),
    geometryColorsUvsUnchanged: true, restoreBorrowedMaterials: true,
    shaderMaterialsReleased: true, lateLoadCancelled: true,
    scope: 'Real original published terrain GLB/material resources and selector identity. '
      +'No raster/GPU compilation or ordinary player appearance proof.',
  }, null, 2)+'\n');
  console.log('PASS_MODULE_ONLY: original terrain selector/material modes and owner release');
}
void main();
