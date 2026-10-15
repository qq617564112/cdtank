import type {IGLTF} from '@babylonjs/loaders/glTF/2.0/glTFLoaderInterfaces';
import {loadPreparedModel} from '../assets/model-resources';
import {AssetContainer, Constants, Matrix, PBRMaterial, Scene,
  Texture, TransformNode} from '@babylonjs/core';
import type {ItemDefinition} from '../../../shared/content/types';
import {TANK_DECORATION_TAGS, TankView, type TankDecorationTag} from '../assets/tanks/tank-view';
import {applyCartoonOutlines} from './materials/cartoon-outline';
import {invalidateMaterialDrawBundles} from './webgpu-draw-cache';
import {battleArtworkUrl} from '../assets/battle-artwork';

/** Original accessory attached to a battle actor's cosmetic attachment track. */
export class BattleTankDecoration {
  private assets?: AssetContainer;
  private texture?: Texture;
  private attached = false;
  private disposed = false;
  private opacity?: number;
  private readonly attachmentMatrix = Matrix.Identity();
  private readonly materialStates = new Map<PBRMaterial, {
    alpha: number; transparencyMode: number | null; alphaMode: number;
  }>();
  private readonly anchor: TransformNode;
  private readonly update = (): void => {
    if (this.opacity !== this.view.opacity) {
      this.opacity = this.view.opacity;
      for (const [material, state] of this.materialStates) {
        invalidateMaterialDrawBundles(material);
        material.alpha = state.alpha * this.opacity;
        material.transparencyMode = this.opacity < 1 ? PBRMaterial.MATERIAL_ALPHABLEND : state.transparencyMode;
        material.alphaMode = this.opacity < 1 ? Constants.ALPHA_COMBINE : state.alphaMode;
      }
      if (this.assets) applyCartoonOutlines(this.assets.meshes);
    }
    const native = this.view.decorationTag(this.tag);
    this.anchor.setEnabled(!!native);
    if (!native) return;
    // Reflect the native matrix about X, as the converted actor coordinates do.
    const matrix = this.attachmentMatrix;
    Matrix.FromArrayToRef(native, 0, matrix);
    matrix.multiplyAtIndex(1, -1); matrix.multiplyAtIndex(2, -1); matrix.multiplyAtIndex(3, -1);
    matrix.multiplyAtIndex(4, -1); matrix.multiplyAtIndex(8, -1); matrix.multiplyAtIndex(12, -1);
    // Keep the attachment local; rendering updates it with the actor's current world matrix.
    this.anchor.setPreTransformMatrix(matrix);
    this.anchor.markAsDirty();
  };

  private constructor(private readonly scene: Scene, private readonly view: TankView,
    private readonly tag: TankDecorationTag, private readonly model: string,
    private readonly texturePath: string | undefined) {
    this.anchor = new TransformNode(`${view.root.name}-decoration`, scene);
    this.anchor.parent = view.root;
  }

  /** Shared item definition drives the native attachment point, model and texture. */
  static create(scene: Scene, view: TankView, item: ItemDefinition): BattleTankDecoration {
    const tag = TANK_DECORATION_TAGS[item.effects?.[0]?.tag ?? -1];
    if (!tag || !view.decorationTag(tag)) throw new Error(`缺少饰品挂点 ${item.id}`);
    const model = item.resources.model;
    if (!model) throw new Error(`饰品模型定义缺失：${item.id}`);
    return new BattleTankDecoration(scene, view, tag, `/${model}`,
      item.resources.texturePath ? `/${item.resources.texturePath}` : undefined);
  }

  get ready(): boolean {return this.attached && !this.disposed;}

  /** Registers each resource before the next await so a mid-load dispose leaves nothing behind. */
  async load(): Promise<boolean> {
    try {
      const texturePath = this.texturePath;
      const assets = await loadPreparedModel(battleArtworkUrl(this.model, this.scene), this.scene, {
        pluginOptions: {gltf: {onParsed: data => {
          if (!texturePath) return;
          for (const material of (data.json as IGLTF).materials ?? []) {
            if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture;
          }
        }}},
      });
      if (this.disposed) {assets.dispose(); return false;}
      this.assets = assets;
      for (const material of assets.materials) {
        if (material instanceof PBRMaterial) this.materialStates.set(material, {
          alpha: material.alpha, transparencyMode: material.transparencyMode, alphaMode: material.alphaMode,
        });
      }
      if (texturePath) {
        const texture = await new Promise<Texture>((resolve, reject) => {
          const created = new Texture(battleArtworkUrl(texturePath, this.scene), this.scene, false, false,
            Constants.TEXTURE_LINEAR_LINEAR, () => resolve(created),
            (_message, error) => {created.dispose(); reject(error ?? new Error('饰品贴图载入失败'));});
          // Hand the in-flight texture to the owner before the load settles so a dispose can release it.
          this.texture = created;
        });
        if (this.disposed) {texture.dispose(); return false;}
        for (const material of assets.materials) {
          if (material instanceof PBRMaterial) {
            material.albedoTexture = texture;
            // The accessory MASK materials originally enable this while loading their base image.
            material.useAlphaFromAlbedoTexture = true;
          }
        }
      }
      assets.addAllToScene();
      assets.rootNodes.forEach(node => {node.parent = this.anchor;});
      applyCartoonOutlines(assets.meshes);
      this.update();
      this.scene.onBeforeRenderObservable.add(this.update);
      this.attached = true;
      return true;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onBeforeRenderObservable.removeCallback(this.update);
    this.assets?.dispose();
    this.materialStates.clear();
    this.texture?.dispose();
    this.anchor.dispose();
  }
}
