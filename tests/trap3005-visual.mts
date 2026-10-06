import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {AssetContainer, LoadAssetContainerAsync, NullEngine, Scene} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {Trap3005Visual} from '../apps/web/src/assets/scenes/trap3005-visual';

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(readFileSync('recovery/output/web-assets/Data/scnobj/03005/03005.glb'));
const matrix = [1,0,0,0,0,1,0,0,0,0,1,0,12.5,2,-40,1];
const visual = new Trap3005Visual(scene, 'GROUND:3005:1', matrix);
const asset = await LoadAssetContainerAsync(bytes, scene, {pluginExtension: '.glb'});
const originalTextures = [...asset.textures];
let releasedTextures = 0;
for (const texture of originalTextures) texture.onDisposeObservable.add(()=>releasedTextures++);
const geometry = asset.meshes.find(value => value.name === 'cylinder02/0')!;
assert.ok(geometry);
const vertices = geometry.getTotalVertices();
assert.equal(vertices, 44*3);
assert.equal(geometry.isUnIndexed, true);
(visual as unknown as {loadAsset(): Promise<AssetContainer>}).loadAsset = async () => asset;
await visual.load();
assert.deepEqual(visual.root.position.asArray(), [-12.5,2,-40]);
assert.equal(geometry.metadata.sourceModel, 'Data/scnobj/03005/03005.POL');
assert.equal(geometry.getTotalVertices(), vertices);
assert.ok(geometry.isDescendantOf(visual.root));
visual.dispose();
assert.ok(geometry.isDisposed());
assert.equal(releasedTextures,originalTextures.length);
const late = new Trap3005Visual(scene, 'GROUND:3005:2', matrix);
let resolve!: (value: AssetContainer) => void;
(late as unknown as {loadAsset(): Promise<AssetContainer>}).loadAsset = () => new Promise(r=>{resolve=r;});
const loading = late.load();
late.dispose();
const lateAsset = await LoadAssetContainerAsync(bytes, scene, {pluginExtension: '.glb'});
const lateTextures=[...lateAsset.textures];
let releasedLateTextures=0;
for(const texture of lateTextures)texture.onDisposeObservable.add(()=>releasedLateTextures++);
const lateMesh = lateAsset.meshes.find(value=>value.name==='cylinder02/0')!;
resolve(lateAsset);
await loading;
assert.ok(lateMesh.isDisposed());
assert.equal(scene.meshes.length,0);
assert.equal(releasedLateTextures,lateTextures.length);
writeFileSync('recovery/output/trap3005-visual-module.json',JSON.stringify({
  status:'PASS_GROUND_MODEL_MODULE_ONLY',modelId:3005,triangles:44,
  nativePosition:[12.5,2,-40],renderPosition:[-12.5,2,-40],originalGeometryPreserved:true,
  ownerMeshAndTextureReleased:true,lateOriginalAssetReleased:true,
  scope:'Real published original03005 GLB and ground transform/disposal with supplied loader boundary. No formal ground snapshot, original factory, permission, placement or player output.',
},null,2)+'\n');
scene.dispose();engine.dispose();
console.log('PASS_GROUND_MODEL_MODULE_ONLY: original03005 geometry/texture, transform and late release');
