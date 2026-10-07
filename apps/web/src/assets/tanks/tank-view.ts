import {roleAmmoEffectName} from './role-ammo-visual';
import {applyMv3Materials} from '../../render/materials/mv3-material';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {loadEmbeddedTrackTextures, loadTankTextures, tankComponentTexture} from './tank-textures';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import {ShaderMaterial} from '@babylonjs/core';
import type {Texture} from '@babylonjs/core';
import {advanceRoleTrackTexture, createRoleTrackTextureState, roleTrackCommandMoves} from './role-track-texture';
import {AssetContainer, LoadAssetContainerAsync, Observable, Scene, TransformNode, Vector3} from '@babylonjs/core';

import {EffectActorActionClock} from './effect-actor-clock';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {EffectPrimaryTagMatrices, EFFECT_PRIMARY_TAGS} from './effect-tag-matrices';
import type {EffectPrimaryTag} from './effect-tag-matrices';
import {sampleEffectTag} from './effect-tag-sampler';
import {effectTurretPivotCorrection} from './effect-turret-pivot';
import type {EffectTagFrame} from './effect-tag-sampler';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import type {EffectActionEvent} from './effect-action-events';

export interface TankActionMessage {
  part: string;
  action: string;
  time: number;
  identifier: number;
}

interface TankAction {
  fields: {name: string; file: string};
  asset: string;
  duration: number;
  events: EffectActionEvent[];
  primaryTags: Array<{name: string; frames: EffectTagFrame[]}>;
  turretPivot: number[] | null;
  turretPivotFrames: EffectTagFrame[] | null;
}
interface TankComponent {
  part: string;
  actions: TankAction[];
}
interface ActionView {
  root: TransformNode;
  assets: AssetContainer[];
  components: Array<{part: string; action: TankAction; assets: AssetContainer; clock?: EffectActorActionClock}>;
}
export interface TankEntry {
  id: number;
  name: string;
  components: TankComponent[];
}

// MV3 GLB conversion stores source ticks as milliseconds. Native gbActor
// advances 4800 ticks/second at its default timeScale=1.
const MV3_PLAYBACK_RATIO = 4800 / 1000;

let catalog: Promise<TankEntry[]> | undefined;
export function tankCatalog(): Promise<TankEntry[]> {
  return catalog ??= fetch('/tanks.json').then(async response => {
    if (!response.ok) {
      throw new Error('战车资源目录载入失败');
    }
    return response.json() as Promise<TankEntry[]>;
  });
}

/** Source geometry shares one origin; U rotates about its original tag_c X/Z. */
export class TankView {
  private readonly turret: TransformNode;
  private readonly primaryTags: EffectPrimaryTagMatrices;
  private readonly cachedBodyPivot: readonly [number, number];
  private readonly actions = new Map<string, Promise<ActionView>>();
  private textures = new Map<string, Texture>();
  private trackPhase = createRoleTrackTextureState();
  private trackMovementPending = false;
  private current?: ActionView;
  private desired = '01';
  private base = '01';
  private transientAction: string | undefined;
  readonly actionMessages = new Observable<TankActionMessage>();
  readonly movementDustPositions = new Observable<readonly [number, number, number]>();
  private readonly animate = (): void => {
    // Original scene45004a stores gbGfxManager::GetDeltaTime as float32
    // before forwarding actor virtual+c. Keep the browser frame as the
    // clock input; do not let a suspended tab skip the source actor clock.
    const delta = Math.fround(effectModelEngineDelta(this.scene.getEngine().getDeltaTime() / 1000));
    this.advanceAnimations(delta);
  };
  private revision = 0;
  private disposed = false;
  private alive = true;
  readonly root: TransformNode;
  activeAction = '';
  ammoAttackEffectName: string | undefined;

  /** Original three-part actor omits the separate U component. */
  get usesThreePartActor(): boolean {
    return !this.tank.components.some(component => component.part === 'U' && component.actions.length > 0);
  }

  get acceptsBattleActions(): boolean {return this.alive && !this.disposed;}

  /** Original virtual+a4/4661c9 retargets03/attack1 effect records. */
  setAmmoAttackEffect(value: number): void {
    this.ammoAttackEffectName = roleAmmoEffectName(value);
  }


  private constructor(private readonly scene: Scene, private readonly tank: TankEntry, name: string,
                      readonly tankId: number, readonly tankTextures?: OwnedTankTextures) {
    const frames = tank.components.find(c => c.part === 'M')?.actions
      .find(a => a.fields.name === '01')?.turretPivotFrames;
    const pivot = frames?.length ? sampleEffectTag(frames, 1) : undefined;
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
      // Battle single actions must be ready before the player enters the world.
      // Loading their geometry during a hit can outlast the whole action.
      await Promise.all(['02', '03', '05', '06', '07', '08', '09'].map(name => view.action(name)));
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
    const view = new TankView(scene, tank, name, tankId, textures ? {...textures} : undefined);
    try {
      view.textures = await loadTankTextures(scene, view.tankTextures, tank.components.filter(component => component.actions.length > 0).map(component => component.part), tankId);
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
    return promise;
  }

  private async loadAction(name: string): Promise<ActionView> {
    const root = new TransformNode(`${this.root.name}-action-${name}`, this.scene);
    root.parent = this.root;
    root.setEnabled(false);
    const view: ActionView = {root, assets: [], components: []};
    try {
      for (const component of this.tank.components) {
        if (!component.actions.length) {
          continue;
        }
        const action = component.actions.find(entry => entry.fields.name === name);
        if (!action) {
          throw new Error(`战车 ${this.tankId} 缺少 ${component.part}/${name}`);
        }
        const assets = await LoadAssetContainerAsync(`/${action.asset}`, this.scene);
        if (this.disposed) {
          assets.dispose();
          throw new Error('战车已释放');
        }
        view.assets.push(assets);
        if (name === '01' && component.part === 'X' && !this.textures.has('XY')) {
          const source = assets.meshes.map(mesh => mesh.material?.metadata?.gltf?.extras?.originalMV3)
            .find(source => source?.textures?.[0]);
          if (source) {
            const frames = await loadEmbeddedTrackTextures(this.scene, this.tankId, source.textures[0]);
            if (this.disposed) {
              frames.forEach(texture => texture.dispose());
              throw new Error('战车已释放');
            }
            frames.forEach((texture, name) => this.textures.set(name, texture));
          }
        }
        assets.materials.push(...applyMv3Materials(this.scene, assets.meshes, tankComponentTexture(this.textures, component.part)));
        applyCartoonOutlines(assets.meshes);
        view.components.push({part: component.part, action, assets});
        assets.addAllToScene();
        const part = new TransformNode(`${this.root.name}-part-${component.part}`, this.scene);
        part.parent = root;
        const turret = new TransformNode(`${this.root.name}-action-${name}-turret`, this.scene);
        if (component.part === 'U') {
          turret.parent = root;
          part.parent = turret;
        } else {
          turret.dispose();
        }
        const frames = component.actions.find(entry => entry.fields.name === '01')?.turretPivotFrames;
        const sampled = frames?.length ? sampleEffectTag(frames, 1) : undefined;
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
        assets.animationGroups.forEach(group => {group.stop(); group.reset();});
      }
      return view;
    } catch (error) {
      view.assets.forEach(assets => assets.dispose());
      root.dispose();
      throw error;
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
      return;
    }
    if (this.current === view && !restart) {
      return;
    }
    this.current?.root.setEnabled(false);
    this.current?.assets.forEach(assets => assets.animationGroups.forEach(group => {group.stop();}));
    this.current = view;
    view.root.setEnabled(true);
    view.assets.forEach(assets => assets.animationGroups.forEach(group => {
      group.stop();
      group.reset();
      group.start(true, MV3_PLAYBACK_RATIO);
      group.pause();
    }));
    for (const component of view.components) {
      // CRT startup uses 53-bit precision; post-D3D control word is still under recovery.
      component.clock = new EffectActorActionClock(component.action.duration,
        component.action.events, !loop, 1, 53);
    }
    this.activeAction = name;
    this.applyTrackTexture();
    this.root.metadata = {tankId: this.tankId, action: name};
    this.updatePrimaryTags();
  }

  async motion(moving: boolean): Promise<void> {
    if (!this.alive || this.disposed) {
      return;
    }
    this.base = moving ? '02' : '01';
    const action = this.transientAction ?? this.base;
    if (action !== this.desired) {
      await this.activate(action, !this.transientAction);
    }
  }

  async fire(): Promise<void> {
    if (!this.alive || this.disposed) {
      return;
    }
    this.transientAction = '03';
    await this.activate('03', false, true);
  }

  /** Original virtual+88 parameters1..4 select single actions05..08. */
  async hurt(selector: number): Promise<void> {
    if (!this.alive || this.disposed || !Number.isInteger(selector) || selector < 1 || selector > 4) {
      return;
    }
    const action = String(selector + 4).padStart(2, '0');
    this.transientAction = action;
    await this.activate(action, false, true);
  }

  async life(alive: boolean): Promise<void> {
    if (this.disposed || alive === this.alive) {
      return;
    }
    this.alive = alive;
    this.transientAction = undefined;
    this.base = '01';
    await this.activate(alive ? '01' : '09', alive, true);
  }

  /** Original single-action clocks drive paused GLB sampling and timed messages. */
  advanceAnimations(deltaSeconds: number): TankActionMessage[] {
    const view = this.current;
    if (this.disposed || !view) return [];
    const trackMovementPending = this.trackMovementPending;
    this.trackMovementPending = false;
    let emitMovementDust = false;
    if (this.alive && trackMovementPending) {
      const previous = this.trackPhase.index;
      this.trackPhase = advanceRoleTrackTexture(this.trackPhase, deltaSeconds);
      if (previous !== this.trackPhase.index) {
        this.applyTrackTexture();
        emitMovementDust = true;
      }
    }
    const messages: TankActionMessage[] = [];
    for (const component of view.components) {
      const clock = component.clock;
      if (!clock) continue;
      const identifiers = clock.advance(deltaSeconds);
      const sampleTime = clock.time % clock.duration;
      for (const group of component.assets.animationGroups) {
        const fps = group.targetedAnimations[0]?.animation.framePerSecond;
        if (fps !== undefined) group.goToFrame(sampleTime / 1000 * fps);
      }
      for (const identifier of identifiers) {
        messages.push({part: component.part, action: this.activeAction, time: clock.time, identifier});
      }
    }
    if (this.activeAction === this.transientAction && view.components.every(c => c.clock?.overMessage === 0)) {
      this.transientAction = undefined;
    }
    this.root.metadata = {tankId: this.tankId, action: this.activeAction,
      actionClocks: view.components.map(c => ({part: c.part, time: c.clock?.time,
        duration: c.action.duration, overMessage: c.clock?.overMessage}))};
    this.updatePrimaryTags();
    if (emitMovementDust) {
      const hasSoot = view.components.some(component =>
        (component.part === 'M' || (!this.usesThreePartActor && component.part === 'U')) &&
        component.action.primaryTags.some(tag => tag.name === 'tag_efsoot' && tag.frames.length > 0));
      const matrix = this.primaryTag('tag_efsoot');
      const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      if (hasSoot && !matrix.every((value, index) => value === identity[index])) {
        this.movementDustPositions.notifyObservers([matrix[12], matrix[13], matrix[14]]);
      }
    }
    for (const message of messages) this.actionMessages.notifyObservers(message);
    return messages;
  }

  /** The accepted movement command is the only source of track A/B advancement.
   * Straight 1/2 and arced 5-8 translate; stop 0 and in-place turns 3/4 freeze.
   */
  trackMovementCommand(command: number): void {
    this.trackMovementPending = !this.disposed && this.alive && roleTrackCommandMoves(command);
  }

  private applyTrackTexture(): void {
    const texture = this.textures.get(this.trackPhase.index === 0 ? 'XY' : 'XY-B');
    if (!texture) return;
    for (const component of this.current?.components ?? []) {
      if (component.part !== 'X' && component.part !== 'Y') continue;
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

  private updatePrimaryTags(): void {
    const view = this.current;
    if (!view || this.disposed) return;
    // Native +2cc caches M/01 at GotoAction's initial time 1, once at load.
    const pivot = this.cachedBodyPivot;
    const yaw = -this.root.rotation.y * 180 / Math.PI;
    const turretYaw = (-this.root.rotation.y - this.turret.rotation.y) * 180 / Math.PI;
    const correction = effectTurretPivotCorrection(pivot,
      yaw, turretYaw, [0, 1, 0]);
    this.primaryTags.update({read: (part, name) => {
      const component = view.components.find(c => c.part === part);
      const track = component?.action.primaryTags.find(t => t.name === name);
      return track && component?.clock ? sampleEffectTag(track.frames, component.clock.time) : undefined;
    }}, {position: [-this.root.position.x, this.root.position.y, this.root.position.z],
      yaw, turretYaw, pivot: [correction[0], correction[2]]});
  }

  get turretYaw(): number {
    return -this.root.rotation.y - this.turret.rotation.y;
  }

  aim(angle: number): void {
    const target = -angle;
    const delta = Math.atan2(Math.sin(target - this.turret.rotation.y),
      Math.cos(target - this.turret.rotation.y));
    this.turret.rotation.y += delta;
    this.current?.root.getChildTransformNodes(true).forEach(node => {
      if (node.name.endsWith('-turret')) {
        node.rotation.y = this.turret.rotation.y;
      }
    });
    this.updatePrimaryTags();
  }

  position(x: number, y: number, z: number): void {
    this.trackMovementPending = false;
    this.root.position.copyFrom(new Vector3(-x, y, z));
    this.updatePrimaryTags();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.trackMovementPending = false;
    this.scene.onBeforeRenderObservable.removeCallback(this.animate);
    this.actionMessages.clear();
    this.movementDustPositions.clear();
    for (const name of EFFECT_PRIMARY_TAGS) (this.primaryTags.get(name) as number[]).fill(0);
    const cleanup = [...this.actions.values()].map(async promise => {
      try {const view = await promise; view.assets.forEach(assets => assets.dispose());} catch {}
    });
    void Promise.all(cleanup).then(() => {
      this.textures.forEach(texture => texture.dispose());
      this.textures.clear();
    });
    this.root.dispose();
  }
}
