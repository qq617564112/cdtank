import {AbstractMesh, AnimationGroup, AssetContainer, Constants, LoadAssetContainerAsync, Matrix,
  Observer, PBRMaterial, Scene, Texture, TransformNode, Vector3} from '@babylonjs/core';
import type {IGLTFLoaderData} from '@babylonjs/loaders/glTF/glTFFileLoader';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {EffectModelAnimation, effectModelEngineDelta,
  type EffectModelAnimationNode} from '../../render/effects/models/effect-model-animation';

interface GroundItemTrack extends EffectModelAnimationNode {
  times: number[];
}

interface GroundItemAnimation {
  clock: EffectModelAnimation;
  meshes: AbstractMesh[];
  groups: AnimationGroup[];
}

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
  /** Live native-space translation at the animated model's visible center. */
  readonly effectMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  private asset?: AssetContainer;
  private texture?: Texture;
  private readonly animations: GroundItemAnimation[] = [];
  private animationObserver?: Observer<Scene>;
  private disposed = false;

  constructor(private readonly scene: Scene, readonly id: string, readonly modelId: string,
              readonly variant: 'A' | 'B', readonly x: number, readonly y: number, readonly z: number) {
    this.root = new TransformNode(`ground-item-${id}`, scene);
    // Native X reflection matches the scene/ground placement convention.
    this.root.position.set(-x, y, z);
    this.root.metadata = {groundItemId: id, groundItemModelId: modelId, groundItemTexture: variant,
      sourceModel: `Data/scnobj/${modelId}/${modelId}.CVD`};
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
    let tracks: GroundItemTrack[] = [];
    const asset = await LoadAssetContainerAsync(`/Data/scnobj/${this.modelId}/${this.modelId}.glb`, this.scene, {
      pluginOptions: {gltf: {onParsed: (data: IGLTFLoaderData) => {
        const source = data.json as {extras?: {attachmentTracks?: GroundItemTrack[]}};
        tracks = source.extras?.attachmentTracks ?? [];
      }}},
    });
    if (this.disposed || this.scene.isDisposed) {asset.dispose(); return;}
    this.asset = asset;
    let texture: Texture | undefined;
    try {
      texture = await this.loadTexture();
      if (this.disposed || this.scene.isDisposed) {texture.dispose(); asset.dispose(); return;}
      this.texture = texture;
      let applied = false;
      for (const mesh of asset.meshes) {
        if (mesh.material instanceof PBRMaterial) {
          mesh.material.albedoTexture = texture;
          applied = true;
        }
        mesh.metadata = {...mesh.metadata, groundItemId: this.id, groundItemModelId: this.modelId,
          groundItemTexture: this.variant, sourceModel: `Data/scnobj/${this.modelId}/${this.modelId}.CVD`};
      }
      // The B/A变体 must reach the drawn mesh; never fall back to the GLB's
      // embedded default when the material did not accept the source texture.
      if (!applied) throw new Error(`原地面物件模型缺少可贴图材质 ${this.modelId}`);
      applyCartoonOutlines(asset.meshes);
      asset.addAllToScene();
      asset.rootNodes.forEach(node => {node.parent = this.root;});
      this.configureAnimation(asset, tracks);
      this.advanceAnimation(0);
      this.animationObserver = this.scene.onBeforeAnimationsObservable.add(() => {
        this.advanceAnimation(effectModelEngineDelta(this.scene.getEngine().getDeltaTime() / 1000));
      });
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private configureAnimation(asset: AssetContainer, tracks: readonly GroundItemTrack[]): void {
    if (!tracks.length) throw new Error(`原地面物件模型缺少节点轨道 ${this.modelId}`);
    for (const [index, track] of tracks.entries()) {
      const meshes = asset.meshes.filter(mesh => mesh.name.startsWith(`node-${index}/`));
      const groups = asset.animationGroups.filter(group => group.name.startsWith(`node-${index}/`));
      const duration = track.times[track.times.length - 1] - track.times[0];
      if (!meshes.length) throw new Error(`原地面物件节点缺失 ${this.modelId}/${index}`);
      for (const group of groups) {
        group.stop();
        group.reset();
        group.start(true);
        group.pause();
      }
      this.animations.push({clock: new EffectModelAnimation(track, duration), meshes, groups});
    }
  }

  private advanceAnimation(deltaSeconds: number): void {
    for (const {clock, meshes, groups} of this.animations) {
      clock.update(deltaSeconds);
      // Native node transforms sit below the GLTF loader's X-reflection root.
      const matrix = Matrix.FromArray([...clock.matrix]);
      for (const mesh of meshes) mesh.setPreTransformMatrix(matrix);
      for (const group of groups) {
        const fps = group.targetedAnimations[0]?.animation.framePerSecond;
        if (fps !== undefined) group.goToFrame(clock.time * fps);
      }
    }
    const minimum = new Vector3(Infinity, Infinity, Infinity);
    const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const {meshes} of this.animations) {
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        minimum.minimizeInPlace(bounds.minimumWorld);
        maximum.maximizeInPlace(bounds.maximumWorld);
      }
    }
    // Particle matrices use native X; the loaded model already reflects it.
    this.effectMatrix[12] = -(minimum.x + maximum.x) / 2;
    this.effectMatrix[13] = (minimum.y + maximum.y) / 2;
    this.effectMatrix[14] = (minimum.z + maximum.z) / 2;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.animationObserver) this.scene.onBeforeAnimationsObservable.remove(this.animationObserver);
    this.animationObserver = undefined;
    this.animations.length = 0;
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
