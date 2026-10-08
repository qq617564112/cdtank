import {AssetContainer, Constants, LoadAssetContainerAsync, Matrix, PBRMaterial, Quaternion,
  Scene, Texture, TransformNode, Vector3} from '@babylonjs/core';
import type {ItemDefinition} from '../../../../shared/content/types';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';

/** Ground actors use the model and selected texture paths from their item definition. */
export class ContentItemVisual {
  readonly root: TransformNode;
  private asset?: AssetContainer;
  private texture?: Texture;
  private disposed = false;

  constructor(private readonly scene: Scene, readonly id: string,
    private readonly definition: ItemDefinition, matrix: EffectNativeMatrix) {
    this.root = new TransformNode(`ground-item-model-${id}`, scene);
    const scale = new Vector3(), rotation = new Quaternion(), position = new Vector3();
    Matrix.FromArray([...matrix]).decompose(scale, rotation, position);
    this.root.scaling.copyFrom(scale);
    this.root.rotationQuaternion = new Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
    this.root.position.set(-position.x, position.y, position.z);
    this.root.metadata = {groundTrapId: id, sourceModel: definition.resources.sourceModel};
  }

  async load(): Promise<void> {
    if (this.disposed || this.scene.isDisposed) return;
    const resources = this.definition.resources;
    if (!resources.model) throw new Error(`物品模型资源缺失：${this.definition.name}`);
    const asset = await LoadAssetContainerAsync(`/${resources.model}`, this.scene);
    if (this.disposed || this.scene.isDisposed) {asset.dispose(); return;}
    this.asset = asset;
    try {
      if (resources.texturePath) {
        this.texture = await new Promise<Texture>((resolve, reject) => {
          const texture = new Texture(`/${resources.texturePath}`, this.scene, true, false,
            Constants.TEXTURE_LINEAR_LINEAR, () => resolve(texture),
            (_message, error) => {texture.dispose(); reject(error ?? new Error('物品贴图载入失败'));});
        });
        if (this.disposed || this.scene.isDisposed) {this.texture.dispose(); asset.dispose(); return;}
        for (const material of asset.materials) {
          if (material instanceof PBRMaterial) material.albedoTexture = this.texture;
        }
      }
      applyCartoonOutlines(asset.meshes);
      asset.addAllToScene();
      asset.rootNodes.forEach(node => {node.parent = this.root;});
      asset.meshes.forEach(mesh => {
        mesh.metadata = {...mesh.metadata, groundTrapId: this.id, sourceModel: resources.sourceModel};
      });
    } catch (error) {this.dispose(); throw error;}
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.asset?.dispose();
    this.texture?.dispose();
    this.root.dispose();
  }
}
