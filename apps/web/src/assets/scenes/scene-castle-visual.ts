import {AssetContainer, LoadAssetContainerAsync, Matrix, Quaternion, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {applyMv3Materials} from '../../render/materials/mv3-material';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {EffectActorActionClock} from '../tanks/effect-actor-clock';
import {sampleEffectTag, type EffectTagFrame} from '../tanks/effect-tag-sampler';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import type {EffectVec3} from '../../render/effects/common/types';
import type {CastleEffectTarget} from './scene-castle-state';
import {castleAnimationTime} from '../../../../shared/movement/scene-animation-clock';

interface CastleAction {
  name: string;
  asset: string;
  available: boolean;
  durationMs: number;
  tracks: {name: string; frames: EffectTagFrame[]}[];
}
export interface CastleModelResource {
  sourcePlacementId: string;
  model: string;
  position: EffectVec3;
  matrix: number[];
  actions: CastleAction[];
}
interface ActionView {resource: CastleAction; container: AssetContainer; root: TransformNode;}

/** Original Castle MV3 actions and five named live spout matrices. */
export class SceneCastleVisual {
  readonly position: EffectVec3;
  private readonly actions = new Map<string, ActionView>();
  private readonly world: number[];
  private readonly tags = Array.from({length: 5}, () => Matrix.Identity().asArray());
  private current?: ActionView;
  private clock?: EffectActorActionClock;
  private disposed = false;

  constructor(private readonly scene: Scene, private readonly resource: CastleModelResource) {
    this.position = resource.position;
    this.world = [...resource.matrix];
    [this.world[12], this.world[13], this.world[14]] = resource.position;
  }

  async load(): Promise<void> {
    try {
      for (const resource of this.resource.actions) {
        if (!resource.available) throw new Error(`缺少原城堡动作：${resource.name}`);
        const container = await LoadAssetContainerAsync(`/${resource.asset}`, this.scene, {
          pluginOptions: {gltf: {useSRGBBuffers: false}},
        });
        if (this.disposed || this.scene.isDisposed) {container.dispose(); return;}
        container.materials.push(...applyMv3Materials(this.scene, container.meshes));
        applyCartoonOutlines(container.meshes);
        container.addAllToScene();
        const root = new TransformNode(`castle-${this.resource.sourcePlacementId}/${resource.name}`, this.scene);
        const scale = new Vector3();
        const rotation = new Quaternion();
        Matrix.FromArray(this.world).decompose(scale, rotation, new Vector3());
        root.scaling.copyFrom(scale);
        root.rotationQuaternion = new Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
        root.position.set(-this.position[0], this.position[1], this.position[2]);
        container.rootNodes.forEach(node => {node.parent = root;});
        container.animationGroups.forEach(group => {group.stop(); group.reset();});
        container.meshes.forEach(mesh => {
          mesh.metadata = {...mesh.metadata, sourceCastlePlacementId: this.resource.sourcePlacementId,
            sourceCastleModel: this.resource.model, sourceCastleAction: resource.name};
        });
        root.setEnabled(false);
        this.actions.set(resource.name, {resource, container, root});
      }
      // Castle45dd2d initializes n2 then n1, both with mode0.
      this.action('n1', 0);
    } catch (error) {this.dispose(); throw error;}
  }

  action(name: 'c2' | 'c3' | 'n1' | 'n2', mode: 0 | 4, elapsedSeconds = 0): void {
    if (this.disposed) return;
    const view = this.actions.get(name);
    if (!view) throw new Error(`缺少原城堡动作：${name}`);
    this.current?.root.setEnabled(false);
    this.current = view;
    view.root.setEnabled(true);
    view.container.animationGroups.forEach(group => {
      group.stop(); group.reset(); group.start(true); group.pause();
    });
    this.clock = new EffectActorActionClock(view.resource.durationMs, [], mode === 4, 1, 53);
    // Named GotoAction starts at0 when its default start1 exceeds end0.
    this.clock.time = 0;
    if (elapsedSeconds > 0) this.clock.advance(elapsedSeconds);
    this.sample();
  }

  update(deltaSeconds: number): void {
    if (this.disposed || !this.clock) return;
    this.clock.advance(deltaSeconds);
    this.sample();
  }

  /** Follow the round clock without restarting the current original action. */
  setAnimationTime(elapsedSeconds: number): void {
    if (this.disposed || !this.clock) return;
    this.clock.time = Math.trunc(castleAnimationTime(elapsedSeconds, this.clock.duration, this.clock.stopAtEnd) * 1000);
    this.sample();
  }

  setAuthorityAnimation(animation: {action: string; startedAt: number; stopAtEnd: boolean} | undefined,
    now: number, battleStartsAt: number): void {
    const action = (animation?.action ?? 'n1') as 'c2' | 'c3' | 'n1' | 'n2';
    const mode = animation?.stopAtEnd ? 4 : 0;
    if (this.current?.resource.name !== action || this.clock?.stopAtEnd !== (mode === 4)) this.action(action, mode);
    this.setAnimationTime(Math.max(0, (now - (animation?.startedAt ?? battleStartsAt)) / 1000));
  }

  /** Resume an existing collapse at authority time without restarting its action or owner. */
  seekDestroyed(elapsedSeconds: number): void {
    if (this.disposed || !this.clock || this.current?.resource.name !== 'c3') return;
    this.clock.time = 0;
    this.clock.advance(elapsedSeconds);
    this.sample();
  }

  matrix(target: CastleEffectTarget): EffectNativeMatrix {
    return target === 'root' ? this.world : this.tags[target];
  }

  private sample(): void {
    if (!this.current || !this.clock) return;
    const time = this.clock.time;
    for (const group of this.current.container.animationGroups) {
      const fps = group.targetedAnimations[0]?.animation.framePerSecond;
      if (fps !== undefined) group.goToFrame(time % this.clock.duration / 1000 * fps);
    }
    for (let index = 0; index < 5; index++) {
      const track = this.current.resource.tracks.find(track => track.name === `tag_spout${index + 1}`);
      if (!track) throw new Error(`缺少原城堡挂点：tag_spout${index + 1}`);
      const local = sampleEffectTag(track.frames, time);
      const target = this.tags[index];
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
          target[row * 4 + column] = Math.fround(
            ((local[row * 4] * this.world[column] + local[row * 4 + 1] * this.world[4 + column]) +
            local[row * 4 + 2] * this.world[8 + column]) + local[row * 4 + 3] * this.world[12 + column]);
        }
      }
    }
    this.current.root.metadata = {sourceCastlePlacementId: this.resource.sourcePlacementId,
      action: this.current.resource.name, time, duration: this.clock.duration};
  }

  dispose(): void {
    this.disposed = true;
    this.actions.forEach(view => {view.container.dispose(); view.root.dispose();});
    this.actions.clear();
    this.current = undefined;
    this.clock = undefined;
  }
}
