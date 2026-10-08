import {gameContent} from '../../../../shared/content/catalog';
import {AssetContainer, Constants, LoadAssetContainerAsync, PBRMaterial, Scene, Texture, TransformNode} from '@babylonjs/core';
import type {RoleDisguiseSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SceneBreachMaterial} from './scene-breach-material';


/** Original4173 replacement prop: intact obj05428/obj05422 at the captured activation XYZ. */
export class RoleDisguiseVisual {
  readonly root: TransformNode;
  private owner?: SceneBreachMaterial;
  private asset?: AssetContainer;
  private texture?: Texture;
  private disposed = false;

  private get resources() {
    const item = [...gameContent().items.values()].find(item => item.runtime.use === 'disguise'
      && item.runtime.skillRoles.primary === this.snapshot.skillId);
    if (!item?.resources.disguise) throw new Error('伪装模型定义缺失');
    return item.resources.disguise;
  }

  constructor(private readonly scene: Scene, readonly playerId: string,
              readonly style: 1 | 2, readonly snapshot: RoleDisguiseSnapshot) {
    this.root = new TransformNode(`disguise-${playerId}`, scene);
    // Native X reflection matches the scene/ground placement convention.
    this.root.position.set(-snapshot.x, snapshot.y, snapshot.z);
    this.root.metadata = {roleDisguisePlayerId: playerId, roleDisguiseStyle: style,
      roleDisguiseSkillId: snapshot.skillId, sourceModel: this.resources.sourceModel};
  }

  async load(): Promise<void> {
    if (this.disposed || this.scene.isDisposed) return;
    const resources = this.resources, model = resources.name;
    const asset = await LoadAssetContainerAsync(`/${resources.model}`, this.scene);
    if (this.disposed || this.scene.isDisposed) {
      asset.dispose();
      return;
    }
    const owner = new SceneBreachMaterial();
    this.owner = owner;
    this.asset = asset;
    try {
      const texturePath = resources.textures[0];
      if (texturePath) {
        this.texture = await new Promise<Texture>((resolve, reject) => {
          const value = new Texture(`/${texturePath}`, this.scene, false, false,
            Constants.TEXTURE_LINEAR_LINEAR, () => resolve(value),
            (_message, error) => {value.dispose(); reject(error ?? new Error('伪装贴图载入失败'));});
        });
      }
      if (this.disposed || this.scene.isDisposed) {this.texture?.dispose(); this.dispose(); return;}
      const mesh = asset.meshes.find(value => value.name === resources.meshName);
      if (mesh?.material instanceof PBRMaterial && this.texture) mesh.material.albedoTexture = this.texture;
      owner.register(asset, {name: model, meshName: resources.meshName, transparent: resources.transparent});
    } catch (error) {
      this.dispose();
      throw error;
    }
    asset.addAllToScene();
    asset.rootNodes.forEach(node => {node.parent = this.root;});
    asset.meshes.forEach(mesh => {
      mesh.metadata = {...mesh.metadata, roleDisguisePlayerId: this.playerId,
        roleDisguiseStyle: this.style, roleDisguiseSkillId: this.snapshot.skillId,
        sourceDisguiseModel: model};
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.owner?.dispose();
    this.owner = undefined;
    this.asset?.dispose();
    this.asset = undefined;
    this.texture?.dispose();
    this.texture = undefined;
    this.root.dispose();
  }
}
