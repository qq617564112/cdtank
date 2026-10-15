import {createMv3AnimationSampler, loadMv3Model, mv3ModelExtras} from './mv3-animation-sampler';
import {roleAmmoEffectName} from './role-ammo-visual';
import {battleArtworkUrl} from '../battle-artwork';
import {prepareGameContent, preparedGameContent} from '../../content';
import {Mv3MaterialResources, setMv3ActorOpacity} from '../../render/materials/mv3-material';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {sceneActorToonBinding} from '../../render/materials/actor-toon';
import {sceneShadowLight} from '../../render/scene-shadow-light';
import {TankDefaultTextures, loadTankTextures, loadTankTrackTextures, tankComponentTexture} from './tank-textures';
import type {TankTrackTextures} from './tank-textures';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import {ShaderMaterial} from '@babylonjs/core';
import type {Texture} from '@babylonjs/core';
import {advanceRoleTrackTextureToRef, createRoleTrackTextureState, roleTrackCommandMoves, roleTrackDirection} from './role-track-texture';
import {AssetContainer, Observable, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {AbstractMesh, Matrix} from '@babylonjs/core';

import {EffectActorActionClock} from './effect-actor-clock';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {EffectPrimaryTagMatrices, EFFECT_PRIMARY_TAGS, type EffectTagSource} from './effect-tag-matrices';
import type {EffectPrimaryTag} from './effect-tag-matrices';
import {sampleEffectTagTrack, sampleEffectTagTrackToRef} from './effect-tag-sampler';
import {effectTurretPivotCorrectionToRef} from './effect-turret-pivot';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {TANK_DECORATION_TAGS, type TankActionData, type TankComponentDefinition, type TankComponentAction, type TankTagTrack} from './tank-action-format';
import type {Mv3AttachmentTrack, SourceMv3Material} from './mv3-model-extras';
import {retainTankActionResources, type TankActionResources} from './tank-action-resources';
import {EffectTagWorldComposer} from './effect-tag-world';
import type {EffectVec3} from '../../render/effects/common/types';
import {EFFECT_IDENTITY} from '../../render/effects/common/effect-render-transform';

export {TANK_DECORATION_TAGS} from './tank-action-format';
export type TankDecorationTag = typeof TANK_DECORATION_TAGS[number];

export interface TankActionMessage {
  part: string;
  action: string;
  time: number;
  identifier: number;
}

interface ActionComponentView {
  part: string;
  action: TankActionData;
  assets: AssetContainer;
  attachmentTracks: readonly Mv3AttachmentTrack[];
  sampleAnimation: (milliseconds: number) => void;
  clock?: EffectActorActionClock;
}
interface ActionTagBinding {
  component: ActionComponentView;
  frames: TankTagTrack;
}
interface ActionView {
  root: TransformNode;
  turret?: TransformNode;
  assets: AssetContainer[];
  components: ActionComponentView[];
  primaryTags: Map<EffectPrimaryTag, ActionTagBinding>;
  decorationTags: Map<TankDecorationTag, ActionTagBinding>;
  hasSoot: boolean;
  metadata: {tankId: number; action: string; actionClocks: {part: string; time?: number; duration: number; overMessage?: number}[]};
}
export interface TankEntry {
  id: number;
  name: string;
  components: TankComponentDefinition[];
  animationSpeed: number;
  handler: string;
}

const tankModelLoaders: Readonly<Record<string, typeof loadMv3Model>> = {tank: loadMv3Model};
const tankTagUp: EffectVec3 = [0, 1, 0];
const threePartTagParts = ['M'] as const;
const fourPartDecorationParts = ['U', 'M'] as const;
const fourPartPrimaryParts = ['M', 'U'] as const;
const trackParts = ['X', 'Y'] as const;
const RETAINED_ACTIONS = new Set(['01', '02']);

// MV3 GLB conversion stores source ticks as milliseconds. Native gbActor
// advances 4800 ticks/second at its default timeScale=1.

let preparedTanks: TankEntry[] | undefined;
export function preparedTankCatalog(): TankEntry[] | undefined {
  const content = preparedGameContent();
  if (!content) return undefined;
  return preparedTanks ??= [...content.tanks.values()].map(tank => ({
    id: tank.id, name: tank.name, components: tank.resources.components as TankComponentDefinition[],
    animationSpeed: tank.resources.animationSpeed, handler: tank.runtime.handler,
  }));
}

export function tankCatalog(): Promise<TankEntry[]> {
  return prepareGameContent().then(() => preparedTankCatalog()!);
}

/** Source geometry shares one origin; U rotates about its original tag_c X/Z. */
export class TankView {
  private sceneShadowRegistration?: () => void;
  private readonly turret: TransformNode;
  private readonly primaryTags: EffectPrimaryTagMatrices;
  private readonly localTagMatrix = new Array<number>(16);
  private readonly pivotCorrection: EffectVec3 = [0, 0, 0];
  private readonly decorationComposer = new EffectTagWorldComposer();
  private readonly decorationMatrices = new Map<TankDecorationTag, number[]>();
  private readonly decorationPose = {position: [0, 0, 0] as EffectVec3,
    yaw: 0, turretYaw: 0, pivot: [0, 0] as [number, number]};
  private readonly tagSource: EffectTagSource = {read: (part, name) => {
    const binding = this.current?.primaryTags.get(name);
    const clock = binding?.component.clock;
    if (!binding || binding.component.part !== part || !clock) return undefined;
    sampleEffectTagTrackToRef(binding.frames, clock.time, this.localTagMatrix);
    return this.localTagMatrix;
  }};
  private readonly tagPose = {position: [0, 0, 0] as [number, number, number],
    yaw: 0, turretYaw: 0, pivot: [0, 0] as [number, number]};
  private readonly cachedBodyPivot: readonly [number, number];
  private readonly actions = new Map<string, Promise<ActionView>>();
  private readonly materials = new Set<ShaderMaterial>();
  private readonly componentMaterials = new Map<string, Mv3MaterialResources>();
  private opticalCamouflage = false;
  private textures = new Map<string, Texture>();
  private readonly defaultTextures: TankDefaultTextures;
  private trackTextures?: TankTrackTextures;
  private trackPhases = {X: createRoleTrackTextureState(), Y: createRoleTrackTextureState()};
  private trackCommandPending = 0;
  private current?: ActionView;
  private readonly currentMeshes: AbstractMesh[] = [];
  private desired = '01';
  private base = '01';
  private transientAction: string | undefined;
  readonly actionMessages = new Observable<TankActionMessage>();
  /** Position is borrowed for synchronous observers and reused by the next notification. */
  readonly movementDustPositions = new Observable<readonly [number, number, number]>();
  private movementDustPosition?: [number, number, number];
  private readonly animationMessages: TankActionMessage[] = [];
  private readonly actionIdentifiers: number[] = [];
  private readonly animate = (): void => {
    // Original scene45004a stores gbGfxManager::GetDeltaTime as float32
    // before forwarding actor virtual+c. Keep the browser frame as the
    // clock input; do not let a suspended tab skip the source actor clock.
    const delta = Math.fround(effectModelEngineDelta(this.scene.getEngine().getDeltaTime() / 1000));
    this.advanceAnimations(delta, this.animationMessages);
    this.animationMessages.length = 0;
  };
  private revision = 0;
  private disposed = false;
  private alive = true;
  private ammoAttackEffectId?: number;
  readonly root: TransformNode;
  activeAction = '';
  ammoAttackEffectName: string | undefined;
  hiddenFromObserver = false;

  get opacity(): number {return this.opticalCamouflage ? 0.35 : 1;}

  /** Per-actor materials retain camouflage through action changes and late loads. */
  setOpticalCamouflage(active: boolean): void {
    if (this.opticalCamouflage === active) return;
    this.opticalCamouflage = active;
    for (const material of this.materials) setMv3ActorOpacity(material, this.opacity);
    applyCartoonOutlines(this.root.getChildMeshes());
  }

  /** Original three-part actor omits the separate U component. */
  get usesThreePartActor(): boolean {
    return !this.primaryTags.fourPart;
  }

  get acceptsBattleActions(): boolean {return this.alive && !this.disposed;}

  /** Original virtual+a4/4661c9 retargets03/attack1 effect records. */
  setAmmoAttackEffect(value: number): void {
    const id = value | 0;
    if (this.ammoAttackEffectId === id) return;
    this.ammoAttackEffectId = id;
    this.ammoAttackEffectName = roleAmmoEffectName(id);
  }


  private constructor(private readonly scene: Scene, private readonly tank: TankEntry, name: string,
                      readonly tankId: number, private readonly actionResources: TankActionResources,
                      private idleActions: readonly TankComponentAction[], readonly tankTextures?: OwnedTankTextures) {
    this.defaultTextures = new TankDefaultTextures(scene, tankId);
    const frames = idleActions.find(component => component.part === 'M')?.action.turretPivotFrames;
    const pivot = frames?.length ? sampleEffectTagTrack(frames, 1) : undefined;
    this.cachedBodyPivot = pivot ? [pivot[12], pivot[14]] : [0, 0];
    this.primaryTags = new EffectPrimaryTagMatrices(tank.components.some(c => c.part === 'U' && c.actions.length > 0));
    this.root = new TransformNode(name, scene);
    this.turret = new TransformNode(`${name}-turret`, scene);
    this.turret.parent = this.root;
    scene.onBeforeRenderObservable.add(this.animate);
  }

  static async load(scene: Scene, name: string, tankId: number, textures?: OwnedTankTextures): Promise<TankView> {
    const view = await TankView.loadPreview(scene, name, tankId, textures);
    try {
      // Keep idle and movement ready; transient actions load on their first event
      // and are released after the actor returns to a retained action.
      await view.action('02');
      view.sceneShadowRegistration = sceneShadowLight(scene)?.addRoot(view.root,
        {dynamic: true, softShadows: false, receiveShadows: false, meshes: () => view.currentMeshes});
      return view;
    } catch (error) {
      view.dispose();
      throw error;
    }
  }

  /** The home viewport displays idle components without battle-only preloading. */
  static async loadPreview(scene: Scene, name: string, tankId: number, textures?: OwnedTankTextures): Promise<TankView> {
    const tank = (await tankCatalog()).find(entry => entry.id === tankId);
    if (!tank) {
      throw new Error(`缺少战车 ${tankId}`);
    }
    const resources = retainTankActionResources(tankId, tank.components);
    let view: TankView;
    try {
      const idle = await resources.load('01');
      if (scene.isDisposed) throw new Error('战车场景已释放');
      view = new TankView(scene, tank, name, tankId, resources, idle, textures ? {...textures} : undefined);
    } catch (error) {
      resources.release();
      throw error;
    }
    try {
      const parts = tank.components.filter(component => component.actions.length > 0).map(component => component.part);
      view.textures = await loadTankTextures(scene, view.tankTextures, parts, tankId);
      view.trackTextures = await loadTankTrackTextures(scene, view.tankTextures, parts, tankId);
      await view.activate('01', true);
      return view;
    } catch (error) {
      view.dispose();
      throw error;
    }
  }

  private action(name: string): Promise<ActionView> {
    const cached = this.actions.get(name);
    if (cached) {
      return cached;
    }
    const promise = this.loadAction(name);
    this.actions.set(name, promise);
    void promise.catch(() => {
      if (this.actions.get(name) === promise) this.actions.delete(name);
    });
    return promise;
  }

  private async loadAction(name: string): Promise<ActionView> {
    const root = new TransformNode(`${this.root.name}-action-${name}`, this.scene);
    root.parent = this.root;
    root.setEnabled(false);
    const view: ActionView = {root, assets: [], components: [],
      primaryTags: new Map(), decorationTags: new Map(), hasSoot: false,
      metadata: {tankId: this.tankId, action: name, actionClocks: []}};
    try {
      const components = await this.actionResources.load(name);
      if (this.disposed) throw new Error('战车已释放');
      for (const component of components) {
        const action = component.action;
        const isTrack = component.part === 'X' || component.part === 'Y';
        const loadModel = tankModelLoaders[this.tank.handler];
        if (!loadModel) throw new Error(`缺少战车模型处理器 ${this.tank.handler}`);
        const assets = await loadModel(battleArtworkUrl(`/${action.model}`, this.scene), this.scene, {
          pluginOptions: {gltf: {useSRGBBuffers: false, skipMaterials: true}},
        }, component.part === 'M' || component.part === 'U' ? TANK_DECORATION_TAGS : []);
        const attachmentTracks = mv3ModelExtras(assets)?.attachmentTracks ?? [];
        if (this.disposed) {
          assets.dispose();
          throw new Error('战车已释放');
        }
        view.assets.push(assets);
        // Keep imported clones under the disabled action while images are pending.
        assets.rootNodes.forEach(node => {node.parent = root;});
        const textureOverride = isTrack ? this.trackTextures?.frames[0] : tankComponentTexture(this.textures, component.part);
        if (!textureOverride) {
          for (const mesh of assets.meshes) {
            const source = mesh._internalMetadata?.originalMV3Material as SourceMv3Material | undefined;
            const request = source?.textures[0];
            if (request) await this.defaultTextures.load(request);
          }
          if (this.disposed) throw new Error('战车已释放');
        }
        let resources = this.componentMaterials.get(component.part);
        if (!resources) {
          resources = new Mv3MaterialResources(this.scene, sceneActorToonBinding(this.scene, this.root));
          this.componentMaterials.set(component.part, resources);
        }
        const materials = resources.apply(assets, textureOverride, this.defaultTextures.bySource);
        for (const material of materials) {
          this.materials.add(material);
          setMv3ActorOpacity(material, this.opacity);
          if (isTrack && this.trackTextures) {
            material.setVector3('sourceColorFilter', Vector3.FromArray(this.trackTextures.filter));
          }
        }
        applyCartoonOutlines(assets.meshes);
        view.components.push({part: component.part, action, assets, attachmentTracks,
          sampleAnimation: createMv3AnimationSampler(assets)});
        view.metadata.actionClocks.push({part: component.part, duration: action.duration});
        assets.addAllToScene();
        const part = new TransformNode(`${this.root.name}-part-${component.part}`, this.scene);
        part.parent = root;
        const turret = new TransformNode(`${this.root.name}-action-${name}-turret`, this.scene);
        if (component.part === 'U') {
          turret.parent = root;
          part.parent = turret;
          view.turret = turret;
        } else {
          turret.dispose();
        }
        const frames = this.idleActions.find(entry => entry.part === component.part)?.action.turretPivotFrames;
        const sampled = frames?.length ? sampleEffectTagTrack(frames, 1) : undefined;
        const pivot = sampled ? [sampled[12], sampled[13], sampled[14]] : undefined;
        if (component.part === 'U' && pivot) {
          const [x, , z] = pivot;
          turret.position.set(-x, 0, z);
          if (name === '01') {
            this.turret.position.copyFrom(turret.position);
          }
          part.position.set(x, 0, -z);
        }
        assets.rootNodes.forEach(node => {node.parent = part;});
      }
      this.bindActionTags(view);
      return view;
    } catch (error) {
      view.assets.forEach(assets => assets.dispose());
      root.dispose();
      throw error;
    }
  }

  private bindActionTags(view: ActionView): void {
    const primaryParts = this.usesThreePartActor ? threePartTagParts : fourPartPrimaryParts;
    for (const part of primaryParts) {
      const component = view.components.find(component => component.part === part);
      if (!component) continue;
      for (const name of EFFECT_PRIMARY_TAGS) {
        if (view.primaryTags.has(name)) continue;
        const track = component.action.primaryTags.find(track => track.name === name);
        if (track) view.primaryTags.set(name, {component, frames: track.frames});
      }
      view.hasSoot ||= component.action.primaryTags.some(track => track.name === 'tag_efsoot' && track.frames.length > 0);
    }
    const decorationParts = this.usesThreePartActor ? threePartTagParts : fourPartDecorationParts;
    for (const part of decorationParts) {
      const component = view.components.find(component => component.part === part);
      if (!component) continue;
      for (const name of TANK_DECORATION_TAGS) {
        if (view.decorationTags.has(name)) continue;
        const track = component.attachmentTracks.find(track => track.name === name && track.frames.length > 1);
        if (track) view.decorationTags.set(name, {component, frames: track.frames});
      }
    }
  }

  private async activate(name: string, loop: boolean, restart = false): Promise<void> {
    if (this.disposed) {
      return;
    }
    const revision = ++this.revision;
    this.desired = name;
    const view = await this.action(name);
    if (this.disposed || revision !== this.revision) {
      if (!this.disposed && this.current !== view && this.desired !== view.metadata.action
        && !RETAINED_ACTIONS.has(view.metadata.action)) this.releaseActionView(view);
      return;
    }
    // The native main update returns a finished single action to 01/02 in the
    // same tick, so a same-action event after "over" restarts from base; only a
    // still-running target action merges without replaying.
    const finished = view.components.every(component => component.clock?.overMessage === 0);
    if (this.current === view && !restart && !finished) {
      return;
    }
    const previous = this.current;
    previous?.root.setEnabled(false);
    this.current = view;
    if (previous && previous !== view && !RETAINED_ACTIONS.has(previous.metadata.action)) {
      this.releaseActionView(previous);
    }
    this.currentMeshes.length = 0;
    for (const component of view.components) this.currentMeshes.push(...component.assets.meshes);
    view.root.setEnabled(true);
    for (const component of view.components) {
      // CRT startup uses 53-bit precision; post-D3D control word is still under recovery.
      component.clock = new EffectActorActionClock(component.action.duration,
        component.action.events, !loop, this.tank.animationSpeed / (4800 / 1000), 53);
    }
    this.activeAction = name;
    this.applyTrackTexture();
    this.root.metadata = view.metadata;
    // Each action owns a separate turret node and retains the current aim.
    this.aim(-this.turret.rotation.y);
  }

  /** Transient action meshes are rebuilt on demand instead of staying resident. */
  private releaseActionView(view: ActionView): void {
    const name = view.metadata.action;
    if (RETAINED_ACTIONS.has(name)) return;
    this.actions.delete(name);
    view.assets.forEach(assets => assets.dispose());
    view.assets.length = 0;
    view.components.length = 0;
    this.actionResources.release(name);
    view.root.dispose();
  }

  motion(moving: boolean): Promise<void> | undefined {
    if (!this.alive || this.disposed) {
      return;
    }
    this.base = moving ? '02' : '01';
    const action = this.transientAction ?? this.base;
    if (action !== this.desired) {
      return this.activate(action, !this.transientAction);
    }
  }

  async fire(): Promise<void> {
    if (!this.alive || this.disposed) {
      return;
    }
    this.transientAction = '03';
    await this.activate('03', false);
  }

  /** Original virtual+88 parameters1..4 select single actions05..08. */
  async hurt(selector: number): Promise<void> {
    if (!this.alive || this.disposed || !Number.isInteger(selector) || selector < 1 || selector > 4) {
      return;
    }
    const action = String(selector + 4).padStart(2, '0');
    this.transientAction = action;
    await this.activate(action, false);
  }

  life(alive: boolean): Promise<void> | undefined {
    if (this.disposed || alive === this.alive) {
      return;
    }
    this.alive = alive;
    this.transientAction = undefined;
    this.base = '01';
    return this.activate(alive ? '01' : '09', alive, true);
  }

  /** Original single-action clocks drive paused GLB sampling and timed messages. */
  advanceAnimations(deltaSeconds: number, messages: TankActionMessage[] = []): TankActionMessage[] {
    messages.length = 0;
    const view = this.current;
    if (this.disposed || !view) return messages;
    const trackCommand = this.trackCommandPending;
    this.trackCommandPending = 0;
    let emitMovementDust = false;
    if (this.alive && trackCommand !== 0 && this.trackTextures) {
      let changed = false;
      let advanced = false;
      for (const part of trackParts) {
        const previous = this.trackPhases[part];
        const previousIndex = previous.index, previousElapsed = previous.elapsed;
        const direction = roleTrackDirection(trackCommand, part);
        advanceRoleTrackTextureToRef(previous, deltaSeconds, this.trackTextures.frames.length,
          this.trackTextures.frameDuration, direction, previous);
        changed ||= previousIndex !== previous.index;
        advanced ||= direction !== 0 && previousElapsed + deltaSeconds >= this.trackTextures.frameDuration;
      }
      if (changed) this.applyTrackTexture();
      emitMovementDust = advanced && roleTrackCommandMoves(trackCommand);
    }
    for (const component of view.components) {
      const clock = component.clock;
      if (!clock) continue;
      const identifiers = this.actionIdentifiers;
      clock.advanceToRef(deltaSeconds, identifiers);
      const sampleTime = clock.time % clock.duration;
      component.sampleAnimation(sampleTime);
      for (const identifier of identifiers) {
        messages.push({part: component.part, action: this.activeAction, time: clock.time, identifier});
      }
    }
    if (this.activeAction === this.transientAction && view.components.every(c => c.clock?.overMessage === 0)) {
      this.transientAction = undefined;
    }
    for (let index = 0; index < view.components.length; index++) {
      const record = view.metadata.actionClocks[index];
      record.time = view.components[index].clock?.time;
      record.overMessage = view.components[index].clock?.overMessage;
    }
    this.updatePrimaryTags();
    if (emitMovementDust) {
      const matrix = this.primaryTag('tag_efsoot');
      if (view.hasSoot) {
        for (let index = 0; index < matrix.length; index++) {
          if (matrix[index] === EFFECT_IDENTITY[index]) continue;
          const position = this.movementDustPosition ??= [0, 0, 0];
          position[0] = matrix[12]; position[1] = matrix[13]; position[2] = matrix[14];
          this.movementDustPositions.notifyObservers(position);
          break;
        }
      }
    }
    for (const message of messages) this.actionMessages.notifyObservers(message);
    return messages;
  }

  /** Accepted commands drive tracks; rejected or stopped motion keeps the current phase. */
  trackMovementCommand(command: number): void {
    this.trackCommandPending = !this.disposed && this.alive ? command : 0;
  }

  private applyTrackTexture(): void {
    const tracks = this.trackTextures;
    if (!tracks) return;
    for (const component of this.current?.components ?? []) {
      if (component.part !== 'X' && component.part !== 'Y') continue;
      const texture = tracks.frames[this.trackPhases[component.part].index];
      for (const mesh of component.assets.meshes) {
        const material = mesh.material;
        if (material instanceof ShaderMaterial && material.metadata?.originalMV3) {
          material.setTexture('sourceTexture', texture);
        }
      }
    }
  }

  /** Native-coordinate matrix reference; retained effects see subsequent updates. */
  primaryTag(name: EffectPrimaryTag): EffectNativeMatrix {
    return this.primaryTags.get(name);
  }

  /** Live matrix per cosmetic tag, sampled in the tank root's native local space. */
  decorationTag(name: TankDecorationTag): EffectNativeMatrix | undefined {
    if (this.disposed) return undefined;
    const binding = this.current?.decorationTags.get(name);
    const clock = binding?.component.clock;
    if (!binding || !clock) return undefined;
    sampleEffectTagTrackToRef(binding.frames, clock.time, this.localTagMatrix);
    const turretYaw = -this.turret.rotation.y * 180 / Math.PI;
    effectTurretPivotCorrectionToRef(this.cachedBodyPivot, 0, turretYaw, tankTagUp, this.pivotCorrection);
    const pose = this.decorationPose;
    pose.turretYaw = turretYaw;
    pose.pivot[0] = this.pivotCorrection[0]; pose.pivot[1] = this.pivotCorrection[2];
    let matrix = this.decorationMatrices.get(name);
    if (!matrix) {
      matrix = new Array<number>(16);
      this.decorationMatrices.set(name, matrix);
    }
    this.decorationComposer.composeToRef(this.localTagMatrix, pose, binding.component.part === 'U', matrix);
    return matrix;
  }

  private updatePrimaryTags(): void {
    const view = this.current;
    if (!view || this.disposed) return;
    // Native +2cc caches M/01 at GotoAction's initial time 1, once at load.
    const pivot = this.cachedBodyPivot;
    const yaw = -this.root.rotation.y * 180 / Math.PI;
    const turretYaw = (-this.root.rotation.y - this.turret.rotation.y) * 180 / Math.PI;
    const correction = this.pivotCorrection;
    effectTurretPivotCorrectionToRef(pivot, yaw, turretYaw, tankTagUp, correction);
    const pose = this.tagPose;
    pose.position[0] = -this.root.position.x;
    pose.position[1] = this.root.position.y;
    pose.position[2] = this.root.position.z;
    pose.yaw = yaw; pose.turretYaw = turretYaw;
    pose.pivot[0] = correction[0]; pose.pivot[1] = correction[2];
    this.primaryTags.update(this.tagSource, pose);
  }

  get turretYaw(): number {
    return -this.root.rotation.y - this.turret.rotation.y;
  }

  get turretWorldMatrix(): Matrix {
    return this.turret.computeWorldMatrix(true);
  }

  aim(angle: number): void {
    const target = -angle;
    const delta = Math.atan2(Math.sin(target - this.turret.rotation.y),
      Math.cos(target - this.turret.rotation.y));
    this.turret.rotation.y += delta;
    const turret = this.current?.turret;
    if (turret) turret.rotation.y = this.turret.rotation.y;
    this.updatePrimaryTags();
  }

  position(x: number, y: number, z: number): void {
    this.trackCommandPending = 0;
    this.root.position.set(-x, y, z);
    this.updatePrimaryTags();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.sceneShadowRegistration?.();
    this.materials.clear();
    this.trackCommandPending = 0;
    this.scene.onBeforeRenderObservable.removeCallback(this.animate);
    this.actionMessages.clear();
    this.movementDustPositions.clear();
    for (const name of EFFECT_PRIMARY_TAGS) (this.primaryTags.get(name) as number[]).fill(0);
    const cleanup = [...this.actions.values()].map(async promise => {
      try {const view = await promise; view.assets.forEach(assets => assets.dispose());} catch {}
    });
    this.actions.clear();
    this.current = undefined;
    this.currentMeshes.length = 0;
    this.idleActions = [];
    this.actionResources.release();
    void Promise.all(cleanup).then(() => {
      this.componentMaterials.forEach(resources => resources.dispose());
      this.componentMaterials.clear();
      this.textures.forEach(texture => texture.dispose());
      this.textures.clear();
      this.trackTextures?.dispose();
      this.trackTextures = undefined;
      this.defaultTextures.dispose();
    });
    this.root.dispose();
  }
}
