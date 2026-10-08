import {itemForHandler} from '../../../../shared/content/catalog';
import {AssetContainer, LoadAssetContainerAsync, Matrix, Quaternion, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';

/** Original03002 POL geometry; the ground identity and transform come from authority. */
export class Trap3002Visual {
  readonly root: TransformNode;
  private asset?: AssetContainer;
  private disposed = false;

  constructor(private readonly scene: Scene, readonly id: string,
    readonly matrix: EffectNativeMatrix) {
    this.root = new TransformNode(`trap3002-${id}`, scene);
    const scale = new Vector3();
    const rotation = new Quaternion();
    const position = new Vector3();
    Matrix.FromArray([...matrix]).decompose(scale, rotation, position);
    this.root.scaling.copyFrom(scale);
    this.root.rotationQuaternion = new Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
    this.root.position.set(-position.x, position.y, position.z);
    this.root.metadata = {groundTrapId: id, sourceModel: itemForHandler('trap', 'contactMine').resources.sourceModel};
  }

  private loadAsset(): Promise<AssetContainer> {
    return LoadAssetContainerAsync(`/${itemForHandler('trap', 'contactMine').resources.model}`, this.scene);
  }

  async load(): Promise<void> {
    if (this.disposed || this.scene.isDisposed) return;
    const asset = await this.loadAsset();
    if (this.disposed || this.scene.isDisposed) {
      asset.dispose();
      return;
    }
    this.asset = asset;
    applyCartoonOutlines(asset.meshes);
    asset.addAllToScene();
    asset.rootNodes.forEach(node => {node.parent = this.root;});
    asset.meshes.forEach(mesh => {
      mesh.metadata = {...mesh.metadata, groundTrapId: this.id,
        sourceModel: itemForHandler('trap', 'contactMine').resources.sourceModel};
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.asset?.dispose();
    this.asset = undefined;
    this.root.dispose();
  }
}
