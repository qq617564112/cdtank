import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {NullEngine, Scene, AssetContainer, Mesh} from '@babylonjs/core';
import {Trap3001Visual} from '../apps/web/src/assets/scenes/trap3001-visual';
import {GroundTrapsPresentation, type GroundTrapPresentationSource} from '../apps/web/src/assets/scenes/ground-traps-presentation';

async function main(): Promise<void> {
  const bytes = readFileSync('recovery/output/web-assets/Data/scnobj/03001/03001.glb');
  const glb = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(glb.meshes[0].name, 'box01/0');
  assert.equal(glb.materials[0].name, '03001A.tga');
  assert.equal(glb.images[0].mimeType, 'image/png');
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const presentation = new GroundTrapsPresentation(scene);
  const create = presentation as unknown as {createVisual(source: GroundTrapPresentationSource): Trap3001Visual};
  const source: GroundTrapPresentationSource = {id: 'TRAP:3001', ownerId: 'P1', team: 0,
    itemTableId: 3001, modelId: 3001, x: 12.5, y: 2, z: -40, expiresAt: 5000};
  const visual = create.createVisual(source);
  assert(visual instanceof Trap3001Visual);
  assert.deepEqual(visual.root.position.asArray(), [-12.5, 2, -40]);
  assert.deepEqual(visual.root.scaling.asArray(), [1, 1, 1]);
  assert.equal(visual.root.metadata.sourceModel, 'Data/scnobj/03001/03001.POL');
  const asset = new AssetContainer(scene);
  const mesh = new Mesh('original-asset-loader-fixture', scene);
  asset.meshes.push(mesh); asset.rootNodes.push(mesh); scene.removeMesh(mesh);
  let resolve!: (asset: AssetContainer) => void;
  (visual as unknown as {loadAsset(): Promise<AssetContainer>}).loadAsset = () => new Promise(r => {resolve = r;});
  const loading = visual.load();
  visual.dispose(); resolve(asset); await loading;
  assert(mesh.isDisposed()); assert(visual.root.isDisposed());

  const shown = create.createVisual({...source, id: 'TRAP:shown'});
  const shownAsset = new AssetContainer(scene);
  const shownMesh = new Mesh('original-asset-loader-fixture', scene);
  shownAsset.meshes.push(shownMesh); shownAsset.rootNodes.push(shownMesh); scene.removeMesh(shownMesh);
  (shown as unknown as {loadAsset(): Promise<AssetContainer>}).loadAsset = async () => shownAsset;
  await shown.load();
  assert.equal(shownMesh.parent, shown.root);
  assert.equal(shownMesh.metadata.sourceModel, 'Data/scnobj/03001/03001.POL');
  shown.dispose(); assert(shownMesh.isDisposed());
  assert.equal(scene.meshes.length, 0);
  presentation.clear(); scene.dispose(); engine.dispose();
  writeFileSync('recovery/output/trap3001-visual-module.json', JSON.stringify({
    status: 'PASS_3001_SOURCE_MODEL_CONSUMER_MODULE_SCOPE',
    sourceModel: 'Data/scnobj/03001/03001.POL', asset: '/Data/scnobj/03001/03001.glb',
    material: '03001A.tga', transform: 'Authority yaw0/scale1 with existing native X reflection.',
    lateAssetReleased: true, ownerDisposed: true,
    scope: 'Published source resource identity and real NullEngine consumer with asset-loader fixtures. No GPU, ordinary placement, effects or audio acceptance.',
  }, null, 2) + '\n');
  console.log('PASS_3001_SOURCE_MODEL_CONSUMER_MODULE_SCOPE');
}
void main();
