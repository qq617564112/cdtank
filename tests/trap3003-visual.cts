import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {NullEngine, Scene, AssetContainer, Mesh} from '@babylonjs/core';
import {Trap3003Visual} from '../apps/web/src/assets/scenes/trap3003-visual';

async function main(): Promise<void> {
const engine = new NullEngine();
const scene = new Scene(engine);
const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12.5, 2, -40, 1];
const visual = new Trap3003Visual(scene, 'TRAP:1', matrix);
assert.deepEqual(visual.root.position.asArray(), [-12.5, 2, -40]);
assert.deepEqual(visual.root.scaling.asArray(), [1, 1, 1]);
const asset = new AssetContainer(scene);
const mesh = new Mesh('source-loader-boundary', scene);
asset.meshes.push(mesh);
asset.rootNodes.push(mesh);
scene.removeMesh(mesh);
let resolve!: (asset: AssetContainer) => void;
(visual as unknown as {loadAsset(): Promise<AssetContainer>}).loadAsset = () => new Promise(r => {resolve = r;});
const loading = visual.load();
visual.dispose();
resolve(asset);
await loading;
assert.ok(mesh.isDisposed(), 'Removed ground object must release a late original asset');
assert.ok(visual.root.isDisposed());
visual.dispose();

const shown = new Trap3003Visual(scene, 'TRAP:2', matrix);
const shownAsset = new AssetContainer(scene);
const shownMesh = new Mesh('source-loader-boundary', scene);
shownAsset.meshes.push(shownMesh); shownAsset.rootNodes.push(shownMesh);
scene.removeMesh(shownMesh);
(shown as unknown as {loadAsset(): Promise<AssetContainer>}).loadAsset = async () => shownAsset;
await shown.load();
assert.equal(shownMesh.parent, shown.root);
assert.equal(shownMesh.metadata.sourceModel, 'Data/scnobj/03003/03003.POL');
shown.dispose();
assert.ok(shownMesh.isDisposed());
assert.equal(scene.meshes.length, 0);
scene.dispose(); engine.dispose();
writeFileSync('recovery/output/trap3003-visual-module.json', JSON.stringify({
  status: 'PASS_GROUND_MODEL_MODULE_ONLY', nativePosition: [12.5, 2, -40], renderPosition: [-12.5, 2, -40],
  lateAssetReleased: true, clearMeshCount: 0,
  scope: 'Real ground-model module/NullEngine transform and disposal with supplied asset-loader boundary. Original geometry source separately preserved; no formal snapshot, ordinary placement, source trap factory or player pixels claimed.',
}, null, 2) + '\n');
console.log('PASS:3003 world transform, removed-before-load release and ground-owner disposal');
}
void main();
