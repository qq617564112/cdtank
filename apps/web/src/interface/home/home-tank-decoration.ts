import {gameContent} from '../../../../shared/content/catalog';
import {AssetContainer, Constants, LoadAssetContainerAsync, Matrix, PBRMaterial, Scene,
  Texture, TransformNode} from '@babylonjs/core';
import type {CombatItemDefinition} from '../../../../shared/combat/catalog';
import {TANK_DECORATION_TAGS, TankView, type TankDecorationTag} from '../../assets/tanks/tank-view';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';

/** Original accessory geometry follows the idle actor's cosmetic attachment track. */
export class HomeTankDecoration {
  private texture?: Texture;
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
    private readonly tag: TankDecorationTag, private readonly assets: AssetContainer) {
    this.anchor = new TransformNode(`${view.root.name}-decoration`, scene);
    this.anchor.parent = view.root;
    assets.rootNodes.forEach(node => {node.parent = this.anchor;});
  }

  static async load(scene: Scene, view: TankView, item: CombatItemDefinition): Promise<HomeTankDecoration> {
    const tag = TANK_DECORATION_TAGS[item.effects?.[0]?.tag ?? -1];
    if (!tag || !view.decorationTag(tag)) throw new Error(`缺少饰品挂点 ${item.itemTableId}`);
    const resources = gameContent().items.get(item.itemTableId)?.resources;
    if (!resources?.model) throw new Error(`饰品模型定义缺失：${item.itemTableId}`);
    const assets = await LoadAssetContainerAsync(`/${resources.model}`, scene);
    const decoration = new HomeTankDecoration(scene, view, tag, assets);
    try {
      if (resources.texturePath) {
        decoration.texture = await new Promise<Texture>((resolve, reject) => {
          const texture = new Texture(`/${resources.texturePath}`, scene, false, false,
            Constants.TEXTURE_LINEAR_LINEAR, () => resolve(texture),
            (_message, error) => {texture.dispose(); reject(error ?? new Error('饰品贴图载入失败'));});
        });
        for (const material of assets.materials) {
          if (material instanceof PBRMaterial) material.albedoTexture = decoration.texture;
        }
      }
      assets.addAllToScene();
      applyCartoonOutlines(assets.meshes);
      decoration.update();
      scene.onBeforeRenderObservable.add(decoration.update);
      return decoration;
    } catch (error) {
      decoration.dispose();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onBeforeRenderObservable.removeCallback(this.update);
    this.assets.dispose();
    this.texture?.dispose();
    this.anchor.dispose();
  }
}
