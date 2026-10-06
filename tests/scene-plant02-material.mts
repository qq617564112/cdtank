import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Color3, Constants, LoadAssetContainerAsync, NullEngine, PBRMaterial, Scene, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {createScenePlantMaterial} from '../apps/web/src/assets/scenes/scene-plant-material';

const source = JSON.parse(readFileSync('recovery/output/scene-plant02-material-source.json', 'utf8'));
const native = JSON.parse(readFileSync('recovery/output/scene-plant02-material-native.json', 'utf8'));
const engine = new NullEngine();
const scene = new Scene(engine);
const container = await LoadAssetContainerAsync(new Uint8Array(readFileSync(
  'recovery/output/web-assets/Data/scnobj/obj05413/obj05413.glb')), scene, {pluginExtension: '.glb'});
const mesh = container.meshes.find(value => value.name === source.parts[0].mesh)!;
assert.ok(mesh);
const texture = (mesh.material as PBRMaterial).albedoTexture!;
assert.ok(texture);
let textureDisposals = 0;
texture.onDisposeObservable.add(() => textureDisposals++);
const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!);
const materialCount = scene.materials.length;
scene.ambientColor = new Color3(.2, .2, .2);
const material = createScenePlantMaterial(scene, source.parts[0].properties, texture);
const uniform = () => (material as unknown as {_vectors4: Record<string, {asArray(): number[]}>})
  ._vectors4.sourceAmbient.asArray();
const reachedAmbient = native.observedEvents.find((value: {handle?: number}) => value.handle === 104).values;
assert.deepEqual(uniform(), reachedAmbient);
scene.ambientColor = new Color3(.4, .6, .8);
material.onBindObservable.notifyObservers(mesh);
assert.deepEqual(uniform(), [.4, .6, .8].map(Math.fround).concat(1));
assert.equal(material.needAlphaBlending(), true);
assert.equal(material.needAlphaTesting(), true);
assert.equal(material.metadata.sourceAlphaRef, 50);
assert.equal(material.alphaMode, Constants.ALPHA_COMBINE);
assert.equal(material.depthFunction, Constants.LESS);
assert.equal(material.forceDepthWrite, true);
assert.equal(texture.wrapU, Constants.TEXTURE_CLAMP_ADDRESSMODE);
assert.equal(texture.wrapV, Constants.TEXTURE_CLAMP_ADDRESSMODE);
assert.equal(texture.samplingMode, Constants.TEXTURE_LINEAR_LINEAR);
assert.deepEqual(Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!), positions);
material.dispose(false, false);
assert.equal(scene.materials.length, materialCount);
assert.equal(textureDisposals, 0);
assert.ok(container.textures.includes(texture));
container.dispose(); scene.dispose(); engine.dispose();
writeFileSync('recovery/output/scene-plant02-material-module.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', sourceModel: source.model,
  nativeStatus: native.status, ambientParameter104: reachedAmbient,
  suppliedAmbientUpdates: true, alphaRef: 50, clamp: true, geometryUnchanged: true,
  materialReleasedBorrowedTexturePreserved: true,
  scope: 'Unimported material using original POL and published GLB texture. No GPU raster, formal ambient provider, or ordinary player output acceptance.',
}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY: original Plant material inputs, supplied ambient, and borrowed texture ownership');
