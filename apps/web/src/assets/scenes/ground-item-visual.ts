import {AssetContainer, Constants, LoadAssetContainerAsync, PBRMaterial, Scene, Texture, TransformNode} from '@babylonjs/core';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';

/**
 * Explicit (modelId, texture) → original PNG basename. dropitem only pairs the B
 * variant with obj05006/obj05007/obj05008, and obj05008's A variant is the
 * differently-numbered obj05014A.png living beside the model, never a
 * same-named default. Models without an explicit entry map A to `${modelId}A`.
 */
const SOURCE_TEXTURES: Readonly<Partial<Record<string, Readonly<Partial<Record<'A' | 'B', string>>>>>> = {
  obj05006: {A: 'obj05006A', B: 'obj05006B'},
  obj05007: {A: 'obj05007A', B: 'obj05007B'},
  obj05008: {A: 'obj05014A', B: 'obj05008B'},
};

export function groundItemTexture(modelId: string, texture: 'A' | 'B'): string {
  return SOURCE_TEXTURES[modelId]?.[texture] ?? `${modelId}A`;
}

/** Original dropitem ground prop at its authoritative XYZ; geometry keeps the model's own scale. */
export class GroundItemVisual {
  readonly root: TransformNode;
  private asset?: AssetContainer;
  private texture?: Texture;
  private disposed = false;

  constructor(private readonly scene: Scene, readonly id: string, readonly modelId: string,
              readonly variant: 'A' | 'B', readonly x: number, readonly y: number, readonly z: number) {
    this.root = new TransformNode(`ground-item-${id}`, scene);
    // Native X reflection matches the scene/ground placement convention.
    this.root.position.set(-x, y, z);
    this.root.metadata = {groundItemId: id, groundItemModelId: modelId, groundItemTexture: variant,
      sourceModel: `Data/scnobj/${modelId}/${modelId}.POL`};
  }

  private async loadTexture(): Promise<Texture> {
    const basename = groundItemTexture(this.modelId, this.variant);
    const asset = `Data/scnobj/${this.modelId}/${basename}.png`;
    return new Promise<Texture>((resolve, reject) => {
      const texture = new Texture(`/${asset}`, this.scene, true, false, Constants.TEXTURE_LINEAR_LINEAR,
        () => {texture.wrapU = texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE; resolve(texture);},
        (_message, error) => {texture.dispose(); reject(error ?? new Error(`原地面物件贴图载入失败 ${asset}`));});
    });
  }

  async load(): Promise<void> {
    if (this.disposed || this.scene.isDisposed) return;
    const asset = await LoadAssetContainerAsync(`/Data/scnobj/${this.modelId}/${this.modelId}.glb`, this.scene);
    if (this.disposed || this.scene.isDisposed) {asset.dispose(); return;}
    let texture: Texture | undefined;
    try {
      texture = await this.loadTexture();
      if (this.disposed || this.scene.isDisposed) {texture.dispose(); asset.dispose(); return;}
      this.asset = asset;
      this.texture = texture;
      let applied = false;
      for (const mesh of asset.meshes) {
        if (mesh.material instanceof PBRMaterial) {
          mesh.material.albedoTexture = texture;
          applied = true;
        }
        mesh.metadata = {...mesh.metadata, groundItemId: this.id, groundItemModelId: this.modelId,
          groundItemTexture: this.variant, sourceModel: `Data/scnobj/${this.modelId}/${this.modelId}.POL`};
      }
      // The B/A变体 must reach the drawn mesh; never fall back to the GLB's
      // embedded default when the material did not accept the source texture.
      if (!applied) throw new Error(`原地面物件模型缺少可贴图材质 ${this.modelId}`);
      applyCartoonOutlines(asset.meshes);
      asset.addAllToScene();
      asset.rootNodes.forEach(node => {node.parent = this.root;});
      // The recovered obj05* geometry ships a real morph-weight animation; the
      // drop plays it once as authored rather than freezing on the last frame.
      for (const group of asset.animationGroups) {
        group.stop();
        group.reset();
        group.start(false);
      }
    } catch (error) {
      texture?.dispose();
      asset.dispose();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.asset && !this.asset.scene.isDisposed) {
      for (const mesh of this.asset.meshes) {
        if (mesh.material instanceof PBRMaterial && mesh.material.albedoTexture === this.texture) {
          mesh.material.albedoTexture = null;
        }
      }
    }
    this.texture?.dispose();
    this.texture = undefined;
    this.asset?.dispose();
    this.asset = undefined;
    this.root.dispose();
  }
}
