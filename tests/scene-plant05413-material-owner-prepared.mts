import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {LoadAssetContainerAsync, NullEngine, PBRMaterial, Scene, ShaderMaterial} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {ScenePlant05413MaterialOwner} from '../recovery/prepared/scene-plant05413-material-owner';

const source = JSON.parse(readFileSync('recovery/output/scene-plant02-material-source.json', 'utf8'));
const engine = new NullEngine();
const scene = new Scene(engine);
const asset = await LoadAssetContainerAsync(new Uint8Array(readFileSync(
  'recovery/output/web-assets/Data/scnobj/obj05413/obj05413.glb')), scene,
  {pluginExtension: '.glb'});
const template = asset.meshes.find(mesh => mesh.name === 'plane507/0')!;
const original = template.material as PBRMaterial;
const texture = original.albedoTexture!;
let textureDisposals = 0;
texture.onDisposeObservable.add(() => textureDisposals++);
const before = scene.materials.length;
const first = template.clone('447/plane507/0')!;
const second = template.clone('448/plane507/0')!;
first.makeGeometryUnique();
second.makeGeometryUnique();
const firstOwner = new ScenePlant05413MaterialOwner(source.parts[0].properties);
const secondOwner = new ScenePlant05413MaterialOwner(source.parts[0].properties);
firstOwner.register(first);
secondOwner.register(second);
const secondMaterial = second.material as ShaderMaterial;
assert.notEqual(first.material, second.material);
assert.equal(template.material, original);
assert.equal(secondMaterial.metadata.sourcePlantModel, 'obj05413');
firstOwner.dispose();
assert.equal(first.material, original);
assert.equal(second.material, secondMaterial);
assert.equal(textureDisposals, 0);
secondOwner.dispose();
assert.equal(second.material, original);
assert.equal(scene.materials.length, before);
assert.equal(textureDisposals, 0);
first.dispose();
second.dispose();
asset.dispose();
scene.dispose();
engine.dispose();
writeFileSync('recovery/output/scene-plant05413-material-owner-prepared.json', JSON.stringify({
  status: 'PASS_PREPARED_OWNER_MODULE_ONLY',
  independentPlacementMaterials: true, originalTemplatePreserved: true,
  oneOwnerDisposePreservesOther: true, borrowedTexturePreserved: true,
  restoreBeforeMeshDisposal: true,
  scope: 'New prepared material owner on independent source meshes; no production import, GPU raster, ordinary output or original ambient producer.',
}, null, 2) + '\n');
console.log('PASS_PREPARED_OWNER_MODULE_ONLY: independent Plant material ownership');
