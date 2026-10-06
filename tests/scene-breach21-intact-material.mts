import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Constants, LoadAssetContainerAsync, NullEngine, PBRMaterial, Scene, ShaderMaterial, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {SceneBreachMaterial} from '../apps/web/src/assets/scenes/scene-breach-material';

const engine = new NullEngine();
const scene = new Scene(engine);
const asset = await LoadAssetContainerAsync(new Uint8Array(readFileSync(
  'recovery/output/web-assets/Data/scnobj/obj05467/obj05467.glb')), scene, {pluginExtension: '.glb'});
const mesh = asset.meshes.find(value => value.name === 'object08/0')!;
const original = mesh.material as PBRMaterial;
const texture = original.albedoTexture!;
let disposedTextures = 0;
texture.onDisposeObservable.add(() => disposedTextures++);
const geometry = [VertexBuffer.PositionKind, VertexBuffer.ColorKind, VertexBuffer.UVKind]
  .map(kind => Array.from(mesh.getVerticesData(kind)!));
const before = scene.materials.length;
const owner = new SceneBreachMaterial();
owner.register(asset);
const material = mesh.material as ShaderMaterial;
assert.equal(material.metadata.sourceBreachShader, 'geom_c1.gbf');
assert.equal(material.needAlphaBlending(), false);
assert.equal(material.needAlphaTesting(), false);
assert.equal(material.alphaMode, Constants.ALPHA_DISABLE);
assert.equal(material.depthFunction, Constants.LESS);
assert.equal(material.forceDepthWrite, true);
assert.equal(texture.wrapU, Constants.TEXTURE_WRAP_ADDRESSMODE);
assert.equal(texture.wrapV, Constants.TEXTURE_WRAP_ADDRESSMODE);
assert.equal(texture.samplingMode, Constants.TEXTURE_LINEAR_LINEAR);
const instances = asset.instantiateModelsToScene(name => `breach-test/${name}`, false);
assert.ok(scene.meshes.some(value => value.name.startsWith('breach-test/') && value.material === material));
instances.rootNodes[0].position.set(100, 0, -200);
const second = asset.instantiateModelsToScene(name => `breach-second/${name}`, false);
second.rootNodes[0].position.set(-300, 0, 400);
const firstMesh = scene.meshes.find(value => value.name.startsWith('breach-test/') && value.material === material)!;
const secondMesh = scene.meshes.find(value => value.name.startsWith('breach-second/') && value.material === material)!;
assert.notDeepEqual(Array.from(firstMesh.computeWorldMatrix(true).asArray()),
  Array.from(secondMesh.computeWorldMatrix(true).asArray()));
assert.ok((material.shaderPath as {vertexSource: string}).vertexSource.includes('#include<instancesVertex>'));
assert.ok((material.shaderPath as {vertexSource: string}).vertexSource.includes('viewProjection * finalWorld'));
assert.deepEqual([VertexBuffer.PositionKind, VertexBuffer.ColorKind, VertexBuffer.UVKind]
  .map(kind => Array.from(mesh.getVerticesData(kind)!)), geometry);
second.dispose(); instances.dispose(); owner.dispose();
assert.equal(mesh.material, original);
assert.equal(scene.materials.length, before);
assert.equal(disposedTextures, 0);
asset.dispose(); scene.dispose(); engine.dispose();
writeFileSync('recovery/output/scene-breach21-intact-material-module.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', model: 'obj05467', sourceShader: 'geom_c1.gbf',
  originalGlbGeometryPreserved: true, instanceSharesOriginalMaterialConsumer: true,
  distinctPlacementMatrices: true, shaderConsumesInstancedWorld: true,
  opaque: true, wrapLinear: true, ownerRestoreRelease: true, borrowedTexturePreserved: true,
  scope: 'Original published GLB input and instance material ownership. No GPU raster or ordinary player output.',
}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY: Breach intact original GLB/instance material consumer and owner release');
