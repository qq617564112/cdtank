import {AssetContainer, LoadAssetContainerAsync, Matrix, Quaternion, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {AbstractMesh} from '@babylonjs/core';
import {loadStaticJson} from '../static-resources';
import {applyMv3Materials} from '../../render/materials/mv3-material';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {sampleEffectTag, type EffectTagFrame} from '../tanks/effect-tag-sampler';
import {multiplyEffectMatrices} from '../../render/effects/common/effect-render-transform';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';

interface HookLibrary {
  mapId: string; sourcePlacementId: string; model: string; className: string;
  asset: string; action: string; durationMs: number;
  track: {name: string; frames: EffectTagFrame[]}; effect: string;
}
export interface HookPlacement {
  id: string; model: string; className?: string; matrix: readonly number[];
  position: readonly number[]; enabled: number;
}

/** Original c1 MV3 and the scene effect attached to its live spout track. */
export class SceneHook {
  private container?: AssetContainer;
  private root?: TransformNode;
  private library?: HookLibrary;
  private readonly parent = [...Matrix.Identity().asArray()];
  private readonly world: number[];
  private handle = 0;
  private disposed = false;
  private elapsed = 0;

  constructor(private readonly scene: Scene, private readonly placement: HookPlacement,
    private readonly effects?: Pick<EffectRuntime, 'spawnSceneEffect' | 'releaseSceneEffect'>) {
    this.world = [...placement.matrix];
    [this.world[12], this.world[13], this.world[14]] = placement.position;
  }

  async load(path: string): Promise<void> {
    try {
      const library = await loadStaticJson<HookLibrary>(`/${path}`);
      if (this.disposed || this.scene.isDisposed) return;
      if (library.mapId !== '0012' || library.sourcePlacementId !== this.placement.id ||
        library.model !== this.placement.model || library.className !== this.placement.className) {
        throw new Error('Hook放置与资源身份不符');
      }
      this.library = library;
      const container = await LoadAssetContainerAsync(`/${library.asset}`, this.scene, {
        pluginOptions: {gltf: {useSRGBBuffers: false}},
      });
      if (this.disposed || this.scene.isDisposed) {container.dispose(); return;}
      this.container = container;
      container.materials.push(...applyMv3Materials(this.scene, container.meshes));
      applyCartoonOutlines(container.meshes);
      container.addAllToScene();
      const root = new TransformNode(`placement-${this.placement.id}`, this.scene);
      this.root = root;
      const scale = new Vector3();
      const rotation = new Quaternion();
      Matrix.FromArray(this.world).decompose(scale, rotation, new Vector3());
      root.scaling.copyFrom(scale);
      root.rotationQuaternion = new Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
      root.position.set(-this.placement.position[0], this.placement.position[1], this.placement.position[2]);
      container.rootNodes.forEach(node => {node.parent = root;});
      container.meshes.forEach(mesh => {
        mesh.metadata = {...mesh.metadata, sourcePlacementId: this.placement.id,
          sourceClass: this.placement.className, sourceHookAction: library.action};
      });
      container.animationGroups.forEach(group => {group.start(true); group.pause();});
      root.setEnabled(Boolean(this.placement.enabled));
      this.setAnimationTime(0);
      if (this.placement.enabled && this.effects) {
        const handle = await this.effects.spawnSceneEffect(library.effect, this.parent, this.placement.id);
        if (this.disposed || this.scene.isDisposed) {
          if (handle) this.effects.releaseSceneEffect(handle);
          return;
        }
        if (!handle) throw new Error('Hook挂点效果载入失败');
        this.handle = handle;
      }
    } catch (error) {this.dispose(); throw error;}
  }

  advance(deltaSeconds: number): void {this.setAnimationTime(this.elapsed + deltaSeconds);}

  setAnimationTime(seconds: number): void {
    if (this.disposed || !this.library || !this.container) return;
    this.elapsed = Math.max(0, seconds);
    const time = Math.trunc(this.elapsed * 1000) % this.library.durationMs;
    for (const group of this.container.animationGroups) {
      const fps = group.targetedAnimations[0]?.animation.framePerSecond;
      if (fps !== undefined) group.goToFrame(group.from + time / 1000 * fps);
    }
    const matrix = multiplyEffectMatrices(this.world, sampleEffectTag(this.library.track.frames, time));
    for (let index = 0; index < 16; ++index) this.parent[index] = matrix[index];
  }

  get meshes(): readonly AbstractMesh[] {return this.root?.getChildMeshes() ?? [];}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.handle) this.effects?.releaseSceneEffect(this.handle);
    this.handle = 0;
    this.container?.dispose();
    this.container = undefined;
    this.root?.dispose();
    this.root = undefined;
  }
}
