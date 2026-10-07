import {AssetContainer, Constants, LoadAssetContainerAsync, Matrix, PBRMaterial, Scene,
  Texture, TransformNode} from '@babylonjs/core';
import type {ItemDefinition} from '../../../shared/content/types';
import {TANK_DECORATION_TAGS, TankView, type TankDecorationTag} from '../assets/tanks/tank-view';
import {applyCartoonOutlines} from './materials/cartoon-outline';

/** Original accessory attached to a battle actor's cosmetic attachment track. */
export class BattleTankDecoration {
  private assets?: AssetContainer;
  private texture?: Texture;
  private attached = false;
  private disposed = false;
  private readonly anchor: TransformNode;
  private readonly update = (): void => {
    const native = this.view.decorationTag(this.tag);
    this.anchor.setEnabled(!!native);
    if (!native) return;
    // Reflect the native matrix about X, as the converted actor coordinates do.
    const matrix = [...native];
    for (const index of [1, 2, 3, 4, 8, 12]) matrix[index] *= -1;
    this.anchor.freezeWorldMatrix(Matrix.FromArray(matrix).multiply(this.view.root.getWorldMatrix()));
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
      const assets = await LoadAssetContainerAsync(this.model, this.scene);
      if (this.disposed) {assets.dispose(); return false;}
      this.assets = assets;
      assets.rootNodes.forEach(node => {node.parent = this.anchor;});
      const texturePath = this.texturePath;
      if (texturePath) {
        const texture = await new Promise<Texture>((resolve, reject) => {
          const created = new Texture(texturePath, this.scene, false, false,
            Constants.TEXTURE_LINEAR_LINEAR, () => resolve(created),
            (_message, error) => {created.dispose(); reject(error ?? new Error('饰品贴图载入失败'));});
          // Hand the in-flight texture to the owner before the load settles so a dispose can release it.
          this.texture = created;
        });
        if (this.disposed) {texture.dispose(); return false;}
        for (const material of assets.materials) {
          if (material instanceof PBRMaterial) material.albedoTexture = texture;
        }
      }
      assets.addAllToScene();
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
    this.texture?.dispose();
    this.anchor.dispose();
  }
}
