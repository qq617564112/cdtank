import {
  AbstractMesh, AssetContainer, BaseTexture, InstantiatedEntries, LoadAssetContainerAsync, Material, Matrix,
  MultiMaterial, PBRMaterial, Quaternion, Scene, StandardMaterial, Texture, TransformNode, Vector3,
} from '@babylonjs/core';
import {loadStaticJson} from '../static-resources';
import type {SceneSequenceLibrary, SceneSequenceMapId} from '../../../../shared/maps/scene-sequence';

export interface SourceSequencePlacement {
  id: string;
  className?: string;
  model: string;
  position: readonly number[];
  rotation: readonly number[];
  matrix: readonly number[];
  enabled: number;
}

type FrameSlot = (texture: Texture) => void;

/** Original obj05023 static body and screen frame sequence. */
export class SceneSequence {
  private base?: AssetContainer;
  private screen?: AssetContainer;
  private readonly frames: Texture[] = [];
  private readonly instances: InstantiatedEntries[] = [];
  private readonly roots: TransformNode[] = [];
  private readonly frameSlots: FrameSlot[] = [];
  private readonly clonedMaterials = new Set<Material>();
  private readonly replacedBaseTextures = new Set<BaseTexture>();
  private disposed = false;
  private delaySeconds = 0;
  private frameIndex = 0;
  private frameStarted = 0;

  constructor(private readonly scene: Scene) {}

  async load(mapId: SceneSequenceMapId, placements: readonly SourceSequencePlacement[]): Promise<void> {
    const library = await loadStaticJson<SceneSequenceLibrary>('/scene-sequence05023.json');
    if (this.disposed || this.scene.isDisposed) return;
    if (library.schemaVersion !== 1 || library.className !== 'SYcScnObjSequence' ||
      library.model !== 'obj05023' || library.frames.length !== 4) {
      throw new Error('原Sequence资源身份不符');
    }
    const keys = library.placements.filter(value => value.mapId === mapId);
    if (keys.length !== 2) throw new Error(`原Sequence放置数量不符：${mapId}`);
    const selected = keys.map(key => {
      const placement = placements.find(value => value.id === key.sourcePlacementId &&
        value.className === library.className && value.model === library.model);
      if (!placement) throw new Error(`原Sequence放置缺失：${key.sourcePlacementId}`);
      return placement;
    });
    this.delaySeconds = library.delay.seconds;
    try {
      for (const frame of library.frames) {
        const texture = await this.loadFrame(frame.asset);
        if (this.disposed || this.scene.isDisposed) {texture.dispose(); return;}
        this.frames.push(texture);
      }
      const base = await LoadAssetContainerAsync(`/${library.base.asset}`, this.scene);
      if (this.disposed || this.scene.isDisposed) {base.dispose(); return;}
      this.base = base;
      const screen = await LoadAssetContainerAsync(`/${library.screen.asset}`, this.scene);
      if (this.disposed || this.scene.isDisposed) {screen.dispose(); return;}
      this.screen = screen;
      for (const placement of selected) this.instantiatePlacement(placement, library);
      if (!this.frameSlots.length) throw new Error('原Sequence screen模型缺少基础色纹理槽');
      this.applyFrame(0);
      this.frameStarted = performance.now()/1000;
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  advance(_deltaSeconds: number): void {
    if (this.disposed || !this.frames.length) return;
    const now = performance.now()/1000;
    if (now-this.frameStarted > this.delaySeconds) {
      this.frameIndex = (this.frameIndex+1)%this.frames.length;
      this.applyFrame(this.frameIndex);
      this.frameStarted = now;
    }
  }

  clear(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.instances.splice(0).forEach(instance => {instance.dispose();});
    this.roots.splice(0).forEach(root => {root.dispose();});
    this.frameSlots.length = 0;
    for (const material of this.clonedMaterials) {
      if (material instanceof MultiMaterial) material.dispose(true, true, true);
      else material.dispose(true, true);
    }
    this.clonedMaterials.clear();
    this.replacedBaseTextures.forEach(texture => {texture.dispose();});
    this.replacedBaseTextures.clear();
    this.base?.dispose();
    this.base = undefined;
    this.screen?.dispose();
    this.screen = undefined;
    this.frames.splice(0).forEach(texture => {texture.dispose();});
    this.delaySeconds = 0;
    this.frameIndex = 0;
    this.frameStarted = 0;
  }

  private async loadFrame(asset: string): Promise<Texture> {
    return new Promise<Texture>((resolve, reject) => {
      const texture = new Texture(`/${asset}`, this.scene, true, false,
        Texture.BILINEAR_SAMPLINGMODE,
        () => {
          texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
          resolve(texture);
        },
        (_message, error) => {
          texture.dispose();
          reject(error ?? new Error(`原Sequence帧纹理载入失败：${asset}`));
        });
    });
  }

  private instantiatePlacement(placement: SourceSequencePlacement, library: SceneSequenceLibrary): void {
    if (!this.base || !this.screen) throw new Error('原Sequence模型容器缺失');
    const root = new TransformNode(`placement-${placement.id}`, this.scene);
    let base: InstantiatedEntries | undefined;
    let screen: InstantiatedEntries | undefined;
    try {
      base = this.base.instantiateModelsToScene(name => `${placement.id}/base/${name}`, false);
      screen = this.screen.instantiateModelsToScene(name => `${placement.id}/screen/${name}`, true);
      base.rootNodes.forEach(node => {node.parent = root;});
      screen.rootNodes.forEach(node => {node.parent = root;});
      this.collectMaterials(screen);
      const screenMeshes = this.instanceMeshes(screen);
      for (const mesh of screenMeshes) {
        for (const slot of this.frameSlotsFor(mesh)) this.frameSlots.push(slot);
      }
      const scale = new Vector3();
      const rotation = new Quaternion();
      const position = new Vector3();
      Matrix.FromArray(placement.matrix).decompose(scale, rotation, position);
      root.scaling.copyFrom(scale);
      root.position.set(-placement.position[0], placement.position[1], placement.position[2]);
      root.rotationQuaternion = new Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
      root.setEnabled(Boolean(placement.enabled));
      root.metadata = {sourcePlacementId: placement.id, sourceClass: placement.className,
        sourceModel: placement.model, sourceSequence: library.model};
      for (const mesh of this.instanceMeshes(base)) this.stampMesh(mesh, placement, library);
      for (const mesh of screenMeshes) this.stampMesh(mesh, placement, library);
      this.instances.push(base);
      this.instances.push(screen);
      this.roots.push(root);
    } catch (error) {
      screen?.dispose();
      base?.dispose();
      root.dispose();
      throw error;
    }
  }

  private instanceMeshes(instance: InstantiatedEntries): AbstractMesh[] {
    const meshes: AbstractMesh[] = [];
    for (const node of instance.rootNodes) {
      if (node instanceof AbstractMesh) meshes.push(node);
      meshes.push(...node.getChildMeshes());
    }
    return meshes;
  }

  private collectMaterials(instance: InstantiatedEntries): void {
    for (const mesh of this.instanceMeshes(instance)) {
      if (mesh.material) this.clonedMaterials.add(mesh.material);
    }
  }

  private frameSlotsFor(mesh: AbstractMesh): FrameSlot[] {
    const materials = mesh.material instanceof MultiMaterial ? mesh.material.subMaterials : [mesh.material];
    const slots: FrameSlot[] = [];
    for (const material of materials) {
      if (material instanceof PBRMaterial && material.albedoTexture) {
        this.replacedBaseTextures.add(material.albedoTexture);
        slots.push(texture => {material.albedoTexture = texture;});
      } else if (material instanceof StandardMaterial && material.diffuseTexture) {
        this.replacedBaseTextures.add(material.diffuseTexture);
        slots.push(texture => {material.diffuseTexture = texture;});
      }
    }
    return slots;
  }

  private stampMesh(mesh: AbstractMesh, placement: SourceSequencePlacement,
    library: SceneSequenceLibrary): void {
    mesh.metadata = {...mesh.metadata, sourcePlacementId: placement.id,
      sourceClass: placement.className, sourceModel: placement.model,
      sourceSequence: library.model, sourceSequenceBaseTexture: library.base.texture};
  }

  private applyFrame(index: number): void {
    const texture = this.frames[index];
    for (const slot of this.frameSlots) slot(texture);
  }
}
