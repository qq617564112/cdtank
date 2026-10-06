import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Mesh, NullEngine, PBRMaterial, RawTexture, Scene, ShaderMaterial} from '@babylonjs/core';
import {PlantMaterialModel, ScenePlant05413MaterialOwner} from '../recovery/prepared/scene-plant-four-model-material-owner';

const fields = JSON.parse(readFileSync('recovery/output/scene-plant04-material-fields-source.json', 'utf8'));
const primary = JSON.parse(readFileSync('recovery/output/scene-plant02-material-source.json', 'utf8')).parts[0].properties;
const engine = new NullEngine();
const scene = new Scene(engine);
const models: {model: PlantMaterialModel; properties: number[]}[] = [
  {model: 'obj05413', properties: primary}, ...fields.models,
];
let textureDisposals = 0;
const textures = models.map(() => RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
textures.forEach(texture => texture.onDisposeObservable.add(() => textureDisposals++));
const originals = textures.map((texture, index) => {
  const material = new PBRMaterial(models[index].model, scene);
  material.albedoTexture = texture;
  return material;
});
const meshes = originals.map((material, index) => {
  const mesh = new Mesh(`${models[index].model}/placement`, scene);
  mesh.material = material;
  return mesh;
});
const baseline = scene.materials.length;
const owner = new ScenePlant05413MaterialOwner(primary);
const separateOwner = new ScenePlant05413MaterialOwner(primary);
owner.register(meshes[0]);
for (let index = 1; index < models.length; index++) {
  owner.register(meshes[index], models[index].model, models[index].properties);
}
const sibling = new Mesh('obj05405/sibling', scene);
sibling.material = originals[3];
separateOwner.register(sibling, 'obj05405', models[3].properties);
const siblingMaterial = sibling.material;
const materials = meshes.map(mesh => mesh.material as ShaderMaterial);
assert.equal(new Set(materials).size, 4);
for (let index = 0; index < models.length; index++) {
  assert.equal(materials[index].metadata.sourcePlantModel, models[index].model);
  assert.deepEqual(materials[index].metadata.sourceProperties, models[index].properties);
  assert.equal(materials[index].getActiveTextures()[0], textures[index]);
}
assert.deepEqual(materials[3].metadata.sourceProperties.slice(12, 15), [1, 1, 1]);
assert.deepEqual(materials[1].metadata.sourceProperties.slice(12, 15), [0, 0, 0]);
owner.dispose();
meshes.forEach((mesh, index) => assert.equal(mesh.material, originals[index]));
assert.equal(sibling.material, siblingMaterial);
assert.equal(textureDisposals, 0);
separateOwner.dispose();
assert.equal(sibling.material, originals[3]);
assert.equal(scene.materials.length, baseline);
assert.equal(textureDisposals, 0);
writeFileSync('recovery/output/scene-plant-four-model-material-owner-prepared.json', JSON.stringify({
  status: 'PASS_PREPARED_FOUR_NAMED_MODEL_OWNERSHIP',
  models: models.map(value => value.model), distinctMaterials: true,
  ownPropertiesAndBorrowedTexture: true, default05413Preserved: true,
  separateOwnerPreserved: true, originalsRestored: true, borrowedTextureDisposals: 0,
  scope: 'Isolated prepared ownership module; original recorded material fields. No production registration or browser output.',
}, null, 2) + '\n');
scene.dispose();
engine.dispose();
console.log('PASS_PREPARED_FOUR_NAMED_MODEL_OWNERSHIP');
