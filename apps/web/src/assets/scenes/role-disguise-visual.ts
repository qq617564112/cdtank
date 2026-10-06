import {AssetContainer, LoadAssetContainerAsync, Scene, TransformNode} from '@babylonjs/core';
import type {RoleDisguiseSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SceneBreachMaterial} from './scene-breach-material';

const MODELS = {1: 'obj05428', 2: 'obj05422'} as const;

/** Original4173 replacement prop: intact obj05428/obj05422 at the captured activation XYZ. */
export class RoleDisguiseVisual {
  readonly root: TransformNode;
  private owner?: SceneBreachMaterial;
  private asset?: AssetContainer;
  private disposed = false;

  constructor(private readonly scene: Scene, readonly playerId: string,
              readonly style: 1 | 2, readonly snapshot: RoleDisguiseSnapshot) {
    this.root = new TransformNode(`disguise-${playerId}`, scene);
    // Native X reflection matches the scene/ground placement convention.
    this.root.position.set(-snapshot.x, snapshot.y, snapshot.z);
    this.root.metadata = {roleDisguisePlayerId: playerId, roleDisguiseStyle: style,
      roleDisguiseSkillId: snapshot.skillId, sourceModel: `Data/scnobj/${MODELS[style]}/${MODELS[style]}.POL`};
  }

  async load(): Promise<void> {
    if (this.disposed || this.scene.isDisposed) return;
    const model = MODELS[this.style];
    const asset = await LoadAssetContainerAsync(`/Data/scnobj/${model}/${model}.glb`, this.scene);
    if (this.disposed || this.scene.isDisposed) {
      asset.dispose();
      return;
    }
    const owner = new SceneBreachMaterial();
    try {
      owner.register(asset, model);
    } catch (error) {
      owner.dispose();
      asset.dispose();
      throw error;
    }
    this.owner = owner;
    this.asset = asset;
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
    this.root.dispose();
  }
}
