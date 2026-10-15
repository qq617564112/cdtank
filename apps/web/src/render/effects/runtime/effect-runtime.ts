import {battleArtworkUrl} from '../../../assets/battle-artwork';
import {gameContent} from '../../../../../shared/content/catalog';
import {roleAmmoActionEffectName, roleAmmoEffectName} from '../../../assets/tanks/role-ammo-visual';
import {isSkillStatusAsset} from '../../../assets/skill-status-artwork';
import {Camera, Frustum, Observer, Plane, Scene, Texture, Vector3} from '@babylonjs/core';
import {TankView, TankActionMessage} from '../../../assets/tanks/tank-view';
import {EffectPrimaryTag, EFFECT_PRIMARY_TAGS} from '../../../assets/tanks/effect-tag-matrices';
import {EffectRuntimeStatePool} from './effect-runtime-state-pool';
import {EffectRuntimeLibrary, EffectRuntimeNode, EffectRuntimeTree} from './effect-runtime-tree';
import {unpackEffectLibrary, type PackedEffectLibrary} from './effect-library-vectors';
import {EffectRenderPass, EffectSpriteMesh} from '../common/effect-sprite-mesh';
import {EffectQuadBuffer} from '../common/effect-quad-buffer';
import {EffectParticleRenderer} from '../particles/effect-particle-renderer';
import {ShotImpactRenderer, SHOT_IMPACT_SMOKE, SHOT_IMPACT_FLASH} from '../particles/shot-impact-renderer';
import {EFFECT_IDENTITY} from '../common/effect-render-transform';
import {EffectBoltDrawState} from '../bolts/effect-bolt-draw';
import {EffectOverlayMesh} from '../overlays/effect-overlay-mesh';
import {EffectOverlayDrawState} from '../overlays/effect-overlay-draw';
import {EffectCameraShakeView} from '../camera/effect-camera-shake-view';
import {EffectNativeMatrix} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';
import {selectSpriteRenderScript} from '../common/effect-render-selection';
import {EffectSound} from '../../../audio/effect-sound';
import {effectSpriteDraw} from '../sprites/sprite-draw';
import {EffectSpriteNodeState} from '../sprites/effect-sprite-node';
import {effectStripDraw} from '../strips/strip-draw';
import {EffectModelLibrary, EffectModelRenderer} from '../models/effect-model-renderer';
import {EffectModelNodeState} from '../models/effect-model-node';
import {EffectModelDrawState} from '../models/effect-model-draw';
import {effectModelEngineDelta} from '../models/effect-model-animation';
import {EffectSkillSound, SkillSoundCatalog} from '../../../audio/effect-skill-sound';
import {LegacyScreenEffectBackend} from './legacy-screen-effect';
import {EffectScreenBackend} from './effect-screen-node';
import {loadStaticJson} from '../../../assets/static-resources';
import {loadEffectModelLibrary, releaseModelLibraries} from '../models/effect-model-resources';
import {releaseAudioBuffer} from '../../../audio/audio-resources';
import type {MsgRoomSnapshot} from '../../../../../shared/protocols/MsgRoomSnapshot';
import {isMobileDevice} from '../../../platform/device';

interface LinkRecord {field04String: string; field148String: EffectPrimaryTag; bindingMode: number;}
interface Links {
  actionKeys: {name: string; id: number}[];
  files: {tankCode: string; groups: {key: number; actions: {name: string; records: LinkRecord[]}[]}[]}[];
}
interface Library extends EffectRuntimeLibrary {
  modelControls: (EffectRuntimeLibrary['modelControls'][number] & {reference: string})[];
  spriteControls: (EffectRuntimeLibrary['spriteControls'][number] & {modifier: number; remainingFieldAc: string})[];
  stripControls: (EffectRuntimeLibrary['stripControls'][number] & {modifier: number; renderFlags: number})[];
  rendering: {
    scripts: {index: number; techniques: {passes: EffectRenderPass[]}[]}[];
    spriteSelections: {node: number; modifier: number; selector: number; flags: number}[];
    particleSelections: {node: number; modifier: number; selector: number; flags: number}[];
    overlayScripts: {textured: boolean; techniques: {passes: EffectRenderPass[]}[]}[];
  };
}
interface DrawRendering {
  controller: number;
  grid: Library['textureGrids'][number];
  sourcePass: EffectRenderPass;
  boltControl?: Library['boltControls'][number];
  overlayControl?: Library['overlayControls'][number];
  billboard: boolean | 'y';
}
interface WorldDrawRenderers {sprite?: EffectSpriteMesh; particle?: EffectParticleRenderer;}
interface MobileDrawState {
  cull: string | undefined;
  blend: string | undefined;
  depth: string | undefined;
  filter: string | undefined;
  key: string;
}
interface Draw extends WorldDrawRenderers {node: EffectRuntimeNode; controller: number; rendering?: DrawRendering; passKey?: string; mobileState?: MobileDrawState; overlay?: EffectOverlayMesh; overlayRectangle?: EffectOverlayDrawState; model?: EffectModelRenderer; modelState?: EffectModelDrawState; quads?: EffectQuadBuffer; boltVertices?: EffectBoltDrawState;}
interface Instance {handle: number; owner?: TankView; hideStatusArtwork?: boolean; scenePlacement?: boolean; sourceScenePlacementId?: string; crushRetained?: boolean; movementRetained?: boolean; tree: EffectRuntimeTree; draws: Draw[]; activeHandles?: Set<number>;}

const MOBILE_IDLE_DRAW_LIMIT = 64;
// Breakable objects, castles and ground-item pickup cues have no skill definition.
const SCENE_SOUND_REFERENCES = ['ga12', 'ga13', 'ga30', 'ga32', 'ga33', 'ga41', 'ga48', 'se03', 'se07',
  'ga21', 'ga22', 'ga23', 'ga24', 'ga25', 'ga26', 'ga28'];
interface BattleEffectScope {snapshot: MsgRoomSnapshot; mapId: number;}

function mobileDrawKey(node: number, states: ReadonlyMap<string, string>): string {
  return `${node}:${states.get('CullMode')}:${states.get('DestBlend')}:${states.get('ZEnable')}:${states.get('MinFilter[0]')}`;
}

function disposeWorldDraw(renderers: WorldDrawRenderers): void {
  renderers.sprite?.dispose();
  renderers.particle?.dispose();
}

/** Original ELK messages, shared CRT random stream, source trees and GBF draws. */
export class EffectRuntime {
  private readonly mobile = isMobileDevice();
  private library?: Library;
  private modelLibrary?: EffectModelLibrary;
  private readonly modelBackends = new WeakMap<EffectModelNodeState, EffectModelRenderer>();
  private deltaSeconds = 0;
  private links?: Links;
  private audio?: SkillSoundCatalog;
  private readonly textures = new Map<string, Texture>();
  private readonly textureLoading = new Map<string, Promise<void>>();
  private loading?: Promise<void>;
  private resourcesLoaded = false;
  private readonly preparedSounds = new Set<string>();
  private readonly sound = new EffectSound();
  private readonly statePool = new EffectRuntimeStatePool();
  private readonly instances: Instance[] = [];
  private readonly subscriptions = new Map<TankView, Observer<TankActionMessage>>();
  private readonly movementSubscriptions = new Map<TankView, Observer<readonly [number, number, number]>>();
  private readonly deviceStates = new Map<string, string>([['CullMode', 'CCW']]);
  private appliedSourcePass?: EffectRenderPass;
  private devicePassKey = 'CullMode=CCW';
  private readonly devicePassParts: string[] = [];
  private readonly drawRenderings = new Map<number, Map<number, DrawRendering>>();
  private readonly idleDraws = new Map<string, WorldDrawRenderers[]>();
  private idleDrawCount = 0;
  private nextInstance = 0;
  private randomSeed = 1;
  private readonly treeRandom = (): number => this.random();
  private running = false;
  private sceneRevision = 0;
  private renderObserver?: Observer<Scene>;
  private readonly cameraShake: EffectCameraShakeView;
  private readonly skillSound: EffectSkillSound;
  private readonly screenBackend: LegacyScreenEffectBackend;
  private readonly treeScreenBackend: EffectScreenBackend;
  private shotImpact?: ShotImpactRenderer;
  private readonly clippingPosition = new Vector3();
  private readonly clippingPlanes = Array.from({length: 6}, () => new Plane(0, 0, 0, 0));
  private clippingViewUpdate = -1;
  private clippingProjectionUpdate = -1;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.screenBackend = new LegacyScreenEffectBackend(scene);
    this.cameraShake = new EffectCameraShakeView(camera, this.treeRandom);
    this.treeScreenBackend = {
      shake: (parameter, duration, strength) => this.cameraShake.activate(parameter, duration, strength),
      selectEffect: (index, parameter, owner) => this.screenBackend.selectEffect(index, parameter, owner),
      clearEffect: owner => this.screenBackend.clearEffect(owner),
    };
    this.skillSound = new EffectSkillSound(camera);
    scene.onDisposeObservable.addOnce(() => {
      this.stop();
      for (const renderers of this.idleDraws.values()) renderers.forEach(disposeWorldDraw);
      this.idleDraws.clear();
      this.idleDrawCount = 0;
      for (const [view, observer] of this.subscriptions) view.actionMessages.remove(observer);
      this.subscriptions.clear();
      for (const [view, observer] of this.movementSubscriptions) view.movementDustPositions.remove(observer);
      this.movementSubscriptions.clear();
      if (this.renderObserver) scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = undefined;
      this.sound.dispose();
      this.skillSound.dispose();
      this.textures.clear();
      this.textureLoading.clear();
      this.screenBackend.dispose();
      this.shotImpact?.dispose();
    });
  }

  private random(): number {
    this.randomSeed = (Math.imul(this.randomSeed, 214013) + 2531011) >>> 0;
    return (this.randomSeed >>> 16) & 32767;
  }

  load(scope?: BattleEffectScope): Promise<void> {
    if (this.scene.isDisposed) return Promise.resolve();
    if (this.resourcesLoaded && !scope) return Promise.resolve();
    if (this.loading) return this.loading;
    const loading = (this.resourcesLoaded ? this.prepareBattleEffects(scope) : this.loadResources(scope))
      .finally(() => {if (this.loading === loading) this.loading = undefined;});
    this.loading = loading;
    return loading;
  }

  private async loadResources(scope?: BattleEffectScope): Promise<void> {
    const revision = this.sceneRevision;
    const [library, links, audio, models] = await Promise.all([
      loadStaticJson<PackedEffectLibrary>('/data/effects/library.runtime.json', false)
        .then(packed => unpackEffectLibrary(packed) as Library),
      loadStaticJson<Links>('/data/effects/links.runtime.json', false),
      loadStaticJson<SkillSoundCatalog>('/manifests/audio.json'),
      loadEffectModelLibrary('/data/effects/models.json', this.scene, new Set()),
    ]);
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    this.library = library;
    this.links = links;
    this.audio = audio;
    this.modelLibrary = models;
    await this.prepareBattleEffects(scope);
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    await this.prepareShotRenderer(library);
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    // Separate samplers keep the existing source effects' POINT filtering intact.
    await Promise.all([SHOT_IMPACT_SMOKE, SHOT_IMPACT_FLASH].map(asset => this.loadTexture(asset, true)));
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    this.shotImpact = new ShotImpactRenderer(this.scene, this.camera,
      this.textures.get(SHOT_IMPACT_SMOKE)!, this.textures.get(SHOT_IMPACT_FLASH)!);
    await this.shotImpact.prepare();
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    if (this.mobile) await this.prepareMobileRenderers(library, revision);
    if (revision === this.sceneRevision) this.resourcesLoaded = !this.scene.isDisposed;
  }

  private async prepareBattleEffects(scope?: BattleEffectScope): Promise<void> {
    const revision = this.sceneRevision;
    const library = this.library!;
    const links = this.links!;
    const audio = this.audio!;
    const content = gameContent();
    const names = new Set(['001', '004', '006'].map(id => `_root\\online\\${id}`));
    const skillIds = new Set<number>([30001]);
    const tankCodes = scope ? new Set(scope.snapshot.players.map(player => String(player.tankId).padStart(3, '0'))) : undefined;
    for (const file of links.files) {
      if (tankCodes && !tankCodes.has(file.tankCode)) continue;
      for (const group of file.groups) for (const action of group.actions) {
        for (const record of action.records) names.add(record.field04String);
      }
    }
    // All ground consumables and ammo remain reachable after future drops.
    for (const item of content.items.values()) {
      for (const id of Object.values(item.runtime.skillRoles)) skillIds.add(id);
      for (const effect of item.effects ?? []) if (effect.effectId) names.add(roleAmmoEffectName(effect.effectId));
    }
    if (scope) {
      for (const player of scope.snapshot.players) {
        for (const ids of [player.roleSkillSources?.currentSkillIds, player.roleSkillSources?.selectedSkillIds,
          player.queuedPartSkillIds]) for (const id of ids ?? []) skillIds.add(id);
        const petType = player.petId ? content.pets.get(player.petId)?.petType : undefined;
        if (petType === 1 || petType === 2) names.add(roleAmmoEffectName(petType === 1 ? 119 : 120));
        if (!player.roleSkillSources && player.petId) {
          for (const skill of content.pets.get(player.petId)?.skills ?? []) for (const id of skill.levels) skillIds.add(id);
        }
      }
      const map = String(scope.mapId).padStart(4, '0');
      const [effects, placements] = await Promise.all([
        loadStaticJson<{effects: {name: string; enabled: boolean}[]}>(`/data/maps/${map}/effects.json`),
        loadStaticJson<{records: {className?: string; model: string}[]; castles: unknown[]}>(`/data/maps/${map}/placements.json`),
      ]);
      if (this.scene.isDisposed || revision !== this.sceneRevision) return;
      for (const effect of effects.effects) if (effect.enabled) names.add(effect.name);
      if (placements.castles.length) for (const id of ['039', '040', '041']) names.add(roleAmmoEffectName(Number(id)));
      if (placements.records.some(row => row.className === 'SYcScnObjCrush' && ['obj05420', 'obj05459'].includes(row.model))) {
        names.add(roleAmmoEffectName(51));
      }
    } else {
      for (const id of content.skills.keys()) skillIds.add(id);
      for (const node of library.nodes) if (/^_root\\online\\\d+$/.test(node.name)) names.add(node.name);
    }
    const skillSoundReferences = new Set(SCENE_SOUND_REFERENCES);
    for (const id of skillIds) {
      const skill = content.skills.get(id);
      if (!skill) continue;
      for (const effect of skill.effects) {
        if (effect.effectId) names.add(roleAmmoEffectName(effect.effectId));
        if (effect.sound && effect.sound !== '0') skillSoundReferences.add(effect.sound.toLowerCase());
      }
    }
    const indices = new Set<number>();
    const collect = (node: EffectRuntimeLibrary['nodes'][number]): void => {
      if (indices.has(node.index)) return;
      indices.add(node.index);
      node.children.forEach(id => {const child = library.nodes.find(row => row.id === id); if (child) collect(child);});
    };
    for (const name of names) {const node = library.nodes.find(row => row.name === name); if (node) collect(node);}
    const soundReferences = new Set(library.soundControls.filter(control => indices.has(control.node))
      .map(control => control.reference.toLowerCase()));
    for (const item of content.items.values()) {
      const reference = content.skills.get(item.runtime.skillRoles.secondary)?.effects[0]?.sound;
      if (reference) soundReferences.add(reference.toLowerCase());
    }
    for (const sound of audio.sounds) {
      if (skillSoundReferences.has(sound.name.toLowerCase()) || soundReferences.has(sound.name.toLowerCase())) {
        this.preparedSounds.add(sound.asset);
      }
    }
    await Promise.all([
      this.skillSound.configure({...audio, sounds: audio.sounds.filter(sound => skillSoundReferences.has(sound.name.toLowerCase()))}),
      this.sound.configure({...audio, sounds: audio.sounds.filter(sound => soundReferences.has(sound.name.toLowerCase()))}, this.skillSound.audioContext()!),
    ]);
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    await Promise.all([...library.textureGrids, ...library.boltTextures].filter(grid => indices.has(grid.node) && grid.asset).map(async grid => {
      await this.loadTexture(grid.asset);
    }));
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    const references = new Set(library.modelControls.filter(control => indices.has(control.node)).map(control => control.reference));
    const models = await loadEffectModelLibrary('/data/effects/models.json', this.scene, references);
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    await Promise.all(models.resources.flatMap(resource => resource.nodes.flatMap(node => node.parts
      .filter(part => part.asset).map(part => this.loadTexture(part.asset!, true)))));
    if (this.scene.isDisposed || revision !== this.sceneRevision) return;
    const previous = this.modelLibrary!;
    this.modelLibrary = {...models, resources: [...previous.resources,
      ...models.resources.filter(resource => !previous.resources.some(row => row.reference === resource.reference))]};
  }

  /** Compile the shared smoke/flash shader before the short source004 trail starts. */
  private async prepareShotRenderer(library: Library): Promise<void> {
    const definition = library.nodes.find(node => node.name === '_root\\online\\004\\7034b')!;
    const control = library.spriteControls.find(row => row.node === definition.index && row.modifier === 0)!;
    const selection = library.rendering.spriteSelections.find(row => row.node === definition.index && row.modifier === 0)!;
    const pass = library.rendering.scripts.find(row => row.index === selection.selector)!.techniques[0].passes[0];
    const grid = library.textureGrids.find(row => row.node === definition.index)!;
    const renderer = new EffectSpriteMesh(this.scene, pass, this.textures.get(grid.asset)!);
    try {
      // This one-frame source sprite initializes without consuming CRT random values.
      const sprite = new EffectSpriteNodeState([control], () => 0, EFFECT_IDENTITY);
      sprite.start([0, 0, 0]);
      const billboard = (parseInt(control.remainingFieldAc.slice(0, 2), 16) & 1) !== 0;
      renderer.updateQuads(effectSpriteDraw(sprite, billboard, grid.uvFrames, this.camera));
      renderer.mesh.setEnabled(false);
      await renderer.material.forceCompilationAsync(renderer.mesh);
    } finally {
      renderer.dispose();
    }
  }

  private createWorldDraw(type: number, pass: EffectRenderPass, grid: Library['textureGrids'][number]): WorldDrawRenderers {
    const texture = this.textures.get(grid.asset)!;
    return type === 6 ? {particle: new EffectParticleRenderer(this.scene, pass, texture, grid.uvFrames)} :
      {sprite: new EffectSpriteMesh(this.scene, pass, texture)};
  }

  /** Common contact effects and camera-facing spirits are ready before play. */
  private async prepareMobileRenderers(library: Library, revision: number): Promise<void> {
    for (const definition of library.nodes) {
      if (![1, 6, 7].includes(definition.type)) continue;
      const grid = library.textureGrids.find(row => row.node === definition.index);
      if (!grid?.asset || !this.textures.has(grid.asset)) continue;
      const common = ['001', '004', '006', '051'].some(id =>
        definition.name.startsWith(`_root\\online\\${id}\\`));
      if (!common && !(definition.name.startsWith('_root\\online\\') && grid.asset.endsWith('/go.webp'))) continue;
      const selectors = definition.type === 6 ? library.rendering.particleSelections : library.rendering.spriteSelections;
      const selector = definition.type === 7 ? selectSpriteRenderScript(
        library.stripControls.find(row => row.node === definition.index && row.modifier === 0)!.renderFlags, false) :
        selectors.find(row => row.node === definition.index && row.modifier === 0)!.selector;
      const sourcePass = library.rendering.scripts.find(row => row.index === selector)!.techniques[0].passes[0];
      const quadCount = definition.type === 6 ? library.particleControls.find(row => row.node === definition.index)!.capacity :
        definition.type === 7 ? library.stripControls.find(row => row.node === definition.index)!.geometry.segments :
        Math.max(1, ...library.spriteControls.filter(row => row.node === definition.index)
          .map(row => row.trailEnabled ? row.trailLimit : 1));
      for (const cull of sourcePass.states.some(row => row.name === 'CullMode') ? ['CCW'] : ['CCW', 'NONE']) {
        if (this.scene.isDisposed || revision !== this.sceneRevision) return;
        const states = new Map<string, string>([['CullMode', cull]]);
        sourcePass.states.forEach(row => states.set(row.name, row.value));
        const renderers = this.createWorldDraw(definition.type, this.renderPass(states), grid);
        try {
          await (renderers.sprite ?? renderers.particle!.sprite).prepare(quadCount);
          if (this.scene.isDisposed || revision !== this.sceneRevision) {disposeWorldDraw(renderers); return;}
          this.cacheWorldDraw(mobileDrawKey(definition.index, states), renderers);
        } catch (error) {
          disposeWorldDraw(renderers);
          throw error;
        }
      }
    }
  }

  private cacheWorldDraw(key: string, renderers: WorldDrawRenderers): void {
    const mesh = renderers.sprite?.mesh ?? renderers.particle!.sprite.mesh;
    mesh.setEnabled(false);
    mesh.metadata = undefined;
    const cached = this.idleDraws.get(key) ?? [];
    if (this.scene.isDisposed || cached.length >= 2) {disposeWorldDraw(renderers); return;}
    if (this.idleDrawCount === MOBILE_IDLE_DRAW_LIMIT) {
      const [oldKey, oldest] = this.idleDraws.entries().next().value!;
      disposeWorldDraw(oldest.shift()!);
      if (!oldest.length) this.idleDraws.delete(oldKey);
      this.idleDrawCount--;
    }
    cached.push(renderers);
    this.idleDraws.set(key, cached);
    this.idleDrawCount++;
  }

  private releaseDraw(draw: Draw): void {
    if (draw.sprite || draw.particle) {
      const renderers = {sprite: draw.sprite, particle: draw.particle};
      if (this.mobile && draw.passKey) this.cacheWorldDraw(draw.passKey, renderers);
      else disposeWorldDraw(renderers);
    }
    draw.sprite = undefined;
    draw.particle = undefined;
    draw.overlay?.dispose();
    draw.overlay = undefined;
  }

  private loadTexture(asset: string, model = false): Promise<void> {
    if (this.scene.isDisposed) return Promise.resolve();
    const cached = this.textureLoading.get(asset);
    if (cached) return cached;
    const loading = new Promise<void>((resolve, reject) => {
      const texture = new Texture(battleArtworkUrl(`/${asset}`, this.scene), this.scene, true, false,
        model ? Texture.BILINEAR_SAMPLINGMODE : Texture.NEAREST_SAMPLINGMODE, () => resolve(),
        message => {texture.dispose(); reject(new Error(message));});
      if (model) {texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE; texture.anisotropicFilteringLevel = 1;}
      this.textures.set(asset, texture);
    }).catch(error => {
      if (this.textureLoading.get(asset) === loading) {this.textureLoading.delete(asset); this.textures.delete(asset);}
      throw error;
    });
    this.textureLoading.set(asset, loading);
    return loading;
  }

  /** Original source-name lookup followed by world-position start. */
  async playWorldEffect(view: TankView, name: string, origin: EffectVec3): Promise<void> {
    await this.load();
    if (this.scene.isDisposed) return;
    const definition = this.library!.nodes.find(node => node.name === name);
    if (!definition) throw new Error(`Missing original effect ${name}`);
    const tree = this.createTree(definition.id, origin);
    try {
      const nodes = new Set(tree.nodes.map(node => node.definition.index));
      await Promise.all([...this.library!.textureGrids, ...this.library!.boltTextures]
        .filter(grid => nodes.has(grid.node)).map(grid => this.loadTexture(grid.asset)));
      if (!this.running) {tree.dispose(); return;}
      this.addInstance(view, tree);
    } catch (error) {
      tree.dispose();
      throw error;
    }
  }

  /** Original 45afc2 world lookup and start; load() prepares source textures. */
  spawnWorldEffect(name: string, origin: EffectVec3): number {
    if (!this.running || !this.library) return 0;
    this.clippingPosition.set(-origin[0], origin[1], origin[2]);
    if (this.clipped(this.clippingPosition)) return 0;
    const definition = this.library.nodes.find(node => node.name === name);
    return definition ? this.addInstance(undefined, this.createTree(definition.id, origin)) : 0;
  }

  spawnShotImpact(origin: EffectVec3, damaging: boolean): void {
    if (!this.running || !this.library) return;
    this.clippingPosition.set(-origin[0], origin[1], origin[2]);
    if (this.clipped(this.clippingPosition)) return;
    this.shotImpact?.spawn(origin, damaging);
  }

  /** Castle45d16f starts unclipped effects on live matrices; activeHandles drops each released tree. */
  spawnCastleEffect(name: '039' | '040' | '041', matrix: EffectNativeMatrix, activeHandles?: Set<number>): number {
    if (!this.running || !this.library) return 0;
    const definition = this.library.nodes.find(node => node.name === `_root\\online\\${name}`);
    return definition ? this.addInstance(undefined, this.createTree(definition.id, [0, 0, 0], matrix),
      false, undefined, true, false, activeHandles) : 0;
  }

  /** Original map startup 46228f creates a retained tree and binds its matrix. */
  async spawnSceneEffect(name: string, matrix: EffectNativeMatrix, placementId?: string): Promise<number> {
    return this.prepareSceneEffect(name, matrix, placementId, true);
  }

  /** Original Crush loader retains051 without starting it until45efb3 calls slot34. */
  async retainCrushEffect(parent: EffectNativeMatrix, placementId: string): Promise<number> {
    return this.prepareSceneEffect('_root\\online\\051', parent, placementId, false);
  }

  /** The source parent is the dereferenced live transform, not the inline reference pair. */
  startCrushEffect(handle: number): void {
    const instance = this.instances.find(row => row.handle === handle && row.crushRetained);
    if (this.running && instance) instance.tree.start();
  }

  /** Stop the old051 on round reset while its map owner keeps the retained tree. */
  stopCrushEffect(handle: number): void {
    this.instances.find(row => row.handle === handle && row.crushRetained)?.tree.stop();
  }

  private async prepareSceneEffect(name: string, matrix: EffectNativeMatrix,
    placementId: string | undefined, startImmediately: boolean): Promise<number> {
    const revision = this.sceneRevision;
    await this.load();
    if (this.scene.isDisposed || revision !== this.sceneRevision) return 0;
    const definition = this.library!.nodes.find(node => node.name === name);
    if (!definition) throw new Error(`Missing original scene effect ${name}`);
    const tree = this.createTree(definition.id, [0, 0, 0], matrix, true);
    try {
      const nodes = new Set(tree.nodes.map(node => node.definition.index));
      await Promise.all([...this.library!.textureGrids, ...this.library!.boltTextures]
        .filter(grid => nodes.has(grid.node)).map(grid => this.loadTexture(grid.asset)));
      if (this.scene.isDisposed || revision !== this.sceneRevision) {tree.dispose(); return 0;}
      return this.addInstance(undefined, tree, true, placementId, startImmediately);
    } catch (error) {
      tree.dispose();
      throw error;
    }
  }

  /** Original scene owner 461e8f explicitly stops and releases its retained node. */
  releaseSceneEffect(handle: number): void {
    const index = this.instances.findIndex(instance => instance.handle === handle && instance.scenePlacement);
    if (index < 0) return;
    this.instances[index].tree.stop();
    this.remove(index);
  }

  /** Original actor 467a08, binding mode3 and indexed primary tag reference. */
  spawnAttachedEffect(view: TankView, effectId: number, effectTag: number, oneShot: boolean,
    localView?: TankView): number {
    if (!this.running || !this.library) return 0;
    if (oneShot && view !== localView && this.clipped(view.root.position)) return 0;
    const tag = EFFECT_PRIMARY_TAGS[effectTag];
    if (!tag) return 0;
    const parent = view.primaryTag(tag);
    if (!parent) return 0;
    const definition = this.library.nodes.find(node => node.name === `_root\\online\\${String(effectId).padStart(3, '0')}`);
    // The oneShot argument controls clipping; native manager creation retains no nodes.
    return definition ? this.addInstance(view, this.createTree(definition.id, [0, 0, 0], parent),
      false, undefined, true, view === localView) : 0;
  }

  /** Original 4791de searches active handles and recursively ends the matched tree. */
  stopEffect(handle: number): void {
    const index = this.instances.findIndex(instance => instance.handle === handle);
    if (index < 0) return;
    this.instances[index].tree.stop();
    if (this.instances[index].tree.quiescent) this.remove(index);
  }

  /** Original 464950(1) restores the actor visibility flag. */
  resetRoleEffects(view: TankView): void {view.root.setEnabled(true);}

  playSkillSound(view: TankView, reference: string, selector: 1 | -1): number {
    const position = view.root.position;
    return this.skillSound.play(reference, selector, [-position.x, position.y, position.z]);
  }

  /** Original4858f2 shot cue has no world position and uses the shared2D sound backend. */
  playShotSound(reference: string): number {return this.sound.play(reference, 1);}

  /** Original485b1b scene cue at the supplied position; activeHandles drops stopped or ended voices. */
  playSceneSound(reference: string, position: EffectVec3, selector: 1 | -1 = 1,
    activeHandles?: Set<number>): number {
    return this.skillSound.play(reference, selector, position, activeHandles);
  }

  stopSkillSound(handle: number): void {this.skillSound.stop(handle);}
  audioContext(): AudioContext | undefined {return this.skillSound.audioContext();}

  /** Original46897a activates eye shake after ordinary local three-part hurt. */
  ordinaryHurtCamera(): void {
    if (this.running) this.cameraShake.activate(1, .5, 10);
  }

  /** Original468a53 replaces the local three-part eye shake after ordinary fire. */
  ordinaryFireCamera(): void {
    if (this.running) this.cameraShake.activate(1, .2, 10);
  }

  private clipped(position: Vector3): boolean {
    const view = this.camera.getViewMatrix();
    const projection = this.camera.getProjectionMatrix();
    if (this.clippingViewUpdate !== view.updateFlag || this.clippingProjectionUpdate !== projection.updateFlag) {
      Frustum.GetPlanesToRef(this.camera.getTransformationMatrix(), this.clippingPlanes);
      this.clippingViewUpdate = view.updateFlag;
      this.clippingProjectionUpdate = projection.updateFlag;
    }
    for (const plane of this.clippingPlanes) if (plane.dotCoordinate(position) <= 0) return true;
    return false;
  }

  private createTree(identifier: number, origin: EffectVec3, parent?: EffectNativeMatrix, retain = false): EffectRuntimeTree {
    let models: Map<number, EffectModelRenderer> | undefined;
    const tree = new EffectRuntimeTree(this.library!, identifier, origin, parent,
      this.treeRandom, this.sound, this.sound.shared, undefined, this.statePool, this.treeScreenBackend,
      definition => {
        const reference = this.library!.modelControls.find(row => row.node === definition.index)!.reference;
        const backend = new EffectModelRenderer(this.scene, this.modelLibrary!.resources.find(row => row.reference === reference)!,
          this.modelLibrary!, this.textures, () => effectModelEngineDelta(this.deltaSeconds), definition.index, definition.name);
        (models ??= new Map()).set(definition.index, backend);
        return backend;
      }, undefined, undefined, retain);
    for (const node of tree.nodes) {
      if (node.model) this.modelBackends.set(node.model, models!.get(node.definition.index)!);
    }
    return tree;
  }

  /** Original model load retains001 before its movement-period world starts. */
  retainMovementEffect(view: TankView): number {
    const retained = this.instances.find(instance => instance.owner === view && instance.movementRetained);
    if (retained) return retained.handle;
    if (!this.library || this.scene.isDisposed) return 0;
    const definition = this.library.nodes.find(node => node.name === '_root\\online\\001');
    if (!definition) throw new Error('Missing original movement effect001');
    const handle = this.addInstance(view, this.createTree(definition.id, [0, 0, 0], undefined, true), false, undefined, false);
    this.instances.find(instance => instance.handle === handle)!.movementRetained = true;
    return handle;
  }

  /** Original virtual38 restarts the same retained tree at the soot world point. */
  startMovementEffect(handle: number, position: readonly [number, number, number]): void {
    const instance = this.instances.find(row => row.handle === handle && row.movementRetained);
    if (!this.running || !instance) return;
    for (let axis = 0; axis < 3; ++axis) instance.tree.origin[axis] = Math.fround(position[axis]);
    instance.tree.start();
  }

  /** Original actor cleanup explicitly ends and releases the retained001. */
  releaseMovementEffect(handle: number): void {
    const index = this.instances.findIndex(row => row.handle === handle && row.movementRetained);
    if (index < 0) return;
    this.remove(index);
  }

  private addInstance(view: TankView | undefined, tree: EffectRuntimeTree, scenePlacement = false,
    sourceScenePlacementId?: string, startImmediately = true, hideStatusArtwork = false,
    activeHandles?: Set<number>): number {
    this.deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
    if (startImmediately) tree.start();
    const handle = ++this.nextInstance;
    this.instances.push({handle, owner: view, hideStatusArtwork, scenePlacement, sourceScenePlacementId,
      crushRetained: scenePlacement && !startImmediately, tree, activeHandles, draws: tree.nodes.filter(node => node.sprite || node.particle || node.strip || node.bolt || node.overlay || node.model)
      .map(node => ({node, controller: -1, model: node.model ? this.modelBackends.get(node.model) : undefined}))});
    activeHandles?.add(handle);
    return handle;
  }

  attach(view: TankView): void {
    if (this.subscriptions.has(view)) return;
    this.subscriptions.set(view, view.actionMessages.add(message => this.message(view, message)));
    this.retainMovementEffect(view);
    this.movementSubscriptions.set(view, view.movementDustPositions.add(position => {
      this.startMovementEffect(this.retainMovementEffect(view), position);
    }));
    // TankView updates its retained tag matrices before effects tick and draw.
    if (this.renderObserver) this.scene.onBeforeRenderObservable.remove(this.renderObserver);
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => this.update(this.scene.getEngine().getDeltaTime() / 1000));
  }

  detach(view: TankView): void {
    const observer = this.subscriptions.get(view);
    if (observer) view.actionMessages.remove(observer);
    this.subscriptions.delete(view);
    const movementObserver = this.movementSubscriptions.get(view);
    if (movementObserver) view.movementDustPositions.remove(movementObserver);
    this.movementSubscriptions.delete(view);
    for (let index = this.instances.length - 1; index >= 0; --index) {
      if (this.instances[index].owner === view) this.remove(index);
    }
  }

  private message(view: TankView, message: TankActionMessage): void {
    if (!this.running || !this.links || !this.library) return;
    const actionId = this.links.actionKeys.find(key => key.name === message.action)?.id;
    const event = this.links.actionKeys.find(key => key.id === message.identifier)?.name;
    const records = this.links.files.find(file => file.tankCode === String(view.tankId).padStart(3, '0'))
      ?.groups.find(group => group.key === actionId)?.actions.find(action => action.name === event)?.records ?? [];
    for (const record of records) {
      const name = roleAmmoActionEffectName(message.action, event ?? '', record.field04String, view.ammoAttackEffectName);
      const definition = this.library.nodes.find(node => node.name === name);
      if (!definition) continue;
      const parent = record.bindingMode === 3 ? view.primaryTag(record.field148String) : undefined;
      this.addInstance(view, this.createTree(definition.id, [0, 0, 0], parent));
    }
  }

  update(deltaSeconds: number): void {
    if (!this.running || !this.library) return;
    this.deltaSeconds = deltaSeconds;
    this.skillSound.update();
    this.cameraShake.update(deltaSeconds);
    this.screenBackend.update();
    // Original manager 0x4790dc updates its active vector from last to first.
    for (let index = this.instances.length - 1; index >= 0; --index) {
      const instance = this.instances[index];
      instance.tree.update(deltaSeconds);
      if (instance.tree.quiescent && !instance.crushRetained && !instance.movementRetained) this.remove(index);
    }
    let drawOrder = 0;
    for (const instance of this.instances) {
      for (const draw of instance.draws) {
        this.draw(instance, draw);
        const mesh = draw.sprite?.mesh ?? draw.particle?.sprite.mesh ?? draw.overlay?.mesh;
        if (mesh) mesh.alphaIndex = drawOrder++;
      }
    }
    this.shotImpact?.update(deltaSeconds, drawOrder);
    this.sound.update();
  }

  /** Immutable source bindings are shared by every instance of a node/controller. */
  private rendering(node: EffectRuntimeNode, controller: number): DrawRendering {
    let controllers = this.drawRenderings.get(node.definition.index);
    const cached = controllers?.get(controller);
    if (cached) return cached;
    if (!controllers) {
      controllers = new Map();
      this.drawRenderings.set(node.definition.index, controllers);
    }
    const library = this.library!;
    const index = node.definition.index;
    const grid = (node.bolt ? library.boltTextures : library.textureGrids).find(row => row.node === index)!;
    const boltControl = node.bolt ? library.boltControls.find(row => row.node === index)! : undefined;
    const overlayControl = node.overlay ? library.overlayControls.find(row => row.node === index)! : undefined;
    const selections = node.particle ? library.rendering.particleSelections : library.rendering.spriteSelections;
    const stripFlags = node.strip ? library.stripControls.find(row => row.node === index && row.modifier === controller)!.renderFlags : 0;
    const selector = node.overlay ? undefined : boltControl ? (boltControl.flag ? 7 : 6) : node.strip ?
      selectSpriteRenderScript(stripFlags, false) : selections.find(row => row.node === index && row.modifier === controller)!.selector;
    const sourcePass = overlayControl ? library.rendering.overlayScripts.find(row => row.textured === overlayControl.textured)!.techniques[0].passes[0] :
      library.rendering.scripts.find(row => row.index === selector)!.techniques[0].passes[0];
    const spriteControl = node.sprite ? library.spriteControls.find(row => row.node === index && row.modifier === controller)! : undefined;
    const billboard = spriteControl ? (parseInt(spriteControl.remainingFieldAc.slice(0, 2), 16) & 1) !== 0 : false;
    // Keep orbiting crow artwork upright and facing the camera.
    const rendering: DrawRendering = {controller, grid, sourcePass, boltControl, overlayControl,
      billboard: !billboard && grid.asset === 'assets/textures/hd/effects/xf/WUYA.webp' ? 'y' : billboard};
    controllers.set(controller, rendering);
    return rendering;
  }

  private renderPass(deviceStates: ReadonlyMap<string, string>): EffectRenderPass {
    const states: Array<EffectRenderPass['states'][number]> = [];
    for (const name of deviceStates.keys()) states.push({name, value: deviceStates.get(name)!});
    return {states};
  }

  private mobilePassKey(draw: Draw): string {
    const cull = this.deviceStates.get('CullMode');
    const blend = this.deviceStates.get('DestBlend');
    const depth = this.deviceStates.get('ZEnable');
    const filter = this.deviceStates.get('MinFilter[0]');
    const previous = draw.mobileState;
    if (previous && previous.cull === cull && previous.blend === blend
        && previous.depth === depth && previous.filter === filter) return previous.key;
    const key = mobileDrawKey(draw.node.definition.index, this.deviceStates);
    if (previous) {
      previous.cull = cull; previous.blend = blend;
      previous.depth = depth; previous.filter = filter; previous.key = key;
    } else draw.mobileState = {cull, blend, depth, filter, key};
    return key;
  }

  private draw(instance: Instance, draw: Draw): void {
    if (instance.owner?.hiddenFromObserver) {
      draw.model?.draw(undefined);
      draw.sprite?.clear();
      draw.particle?.sprite.clear();
      draw.overlay?.update();
      return;
    }
    const node = draw.node;
    if (node.model) {
      draw.model!.draw(node.lifecycle.phase === 2 && node.lifecycle.controller >= 0 ?
        (draw.modelState ??= new EffectModelDrawState()).update(node.model, instance.tree.parentMatrix) : undefined);
      return;
    }
    if (node.lifecycle.phase !== 2 || (!node.bolt && node.lifecycle.controller < 0)) {
      draw.sprite?.clear(); draw.particle?.sprite.clear(); draw.overlay?.update(); return;
    }
    const controller = node.lifecycle.controller;
    if (draw.rendering?.controller !== controller) draw.rendering = this.rendering(node, controller);
    const {grid, boltControl, overlayControl, sourcePass, billboard} = draw.rendering;
    // Passes inherit states from earlier draws, including earlier frames.
    let statesChanged = false;
    if (this.appliedSourcePass !== sourcePass) {
      for (const state of sourcePass.states) {
        if (this.deviceStates.get(state.name) === state.value) continue;
        this.deviceStates.set(state.name, state.value);
        statesChanged = true;
      }
      this.appliedSourcePass = sourcePass;
    }
    if (statesChanged && !this.mobile) {
      const parts = this.devicePassParts;
      for (const name of this.deviceStates.keys()) parts.push(`${name}=${this.deviceStates.get(name)!}`);
      this.devicePassKey = parts.join(';');
      parts.length = 0;
    }
    const passKey = this.mobile ? this.mobilePassKey(draw) : this.devicePassKey;
    if ((!this.mobile && draw.controller !== controller) || draw.passKey !== passKey) {
      this.releaseDraw(draw);
      const texture = this.textures.get(grid.asset)!;
      if (node.overlay) {
        draw.overlay = new EffectOverlayMesh(this.scene, this.renderPass(this.deviceStates), texture);
        draw.overlayRectangle ??= new EffectOverlayDrawState(this.scene.getEngine().getRenderWidth(), this.scene.getEngine().getRenderHeight());
      }
      else {
        const cached = this.mobile ? this.idleDraws.get(passKey)?.pop() : undefined;
        if (cached) {
          this.idleDrawCount--;
          if (!this.idleDraws.get(passKey)!.length) this.idleDraws.delete(passKey);
          const sampling = this.deviceStates.get('MinFilter[0]') === 'POINT' ? Texture.NEAREST_SAMPLINGMODE : Texture.BILINEAR_SAMPLINGMODE;
          if (texture.samplingMode !== sampling) texture.updateSamplingMode(sampling);
          texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
        }
        const renderers = cached ?? this.createWorldDraw(node.definition.type, this.renderPass(this.deviceStates), grid);
        draw.sprite = renderers.sprite;
        draw.particle = renderers.particle;
      }
      draw.passKey = passKey;
      const mesh = draw.sprite?.mesh ?? draw.particle?.sprite.mesh ?? draw.overlay!.mesh;
      mesh.metadata = {originalEffect: node.definition.name, sourceNode: node.definition.index,
        sourceScenePlacementId: instance.sourceScenePlacementId};
      mesh.alphaIndex = this.scene.meshes.indexOf(mesh);
    }
    draw.controller = controller;
    if (node.particle) draw.particle!.update(this.camera, node.particle.pool.particles);
    if (node.overlay) {
      const engine = this.scene.getEngine();
      draw.overlayRectangle!.resize(engine.getRenderWidth(), engine.getRenderHeight());
      draw.overlay!.update(draw.overlayRectangle!.draw(node.overlay.color,
        overlayControl!.textured, grid.uvFrames[node.overlay.frame]));
    }
    if (node.bolt) {
      const eye = this.camera.globalPosition;
      draw.sprite!.updateTriangleStrip((draw.boltVertices ??= new EffectBoltDrawState()).update(node.bolt.worldSegments,
        EFFECT_IDENTITY, -eye.x, eye.y, eye.z, boltControl!.width, boltControl!.color));
    }
    if (node.sprite) {
      const sprite = node.sprite;
      const statusArtwork = !!instance.owner && isSkillStatusAsset(grid.asset);
      if (statusArtwork && instance.hideStatusArtwork) draw.sprite!.clear();
      else draw.sprite!.updateQuads(effectSpriteDraw(sprite, billboard, grid.uvFrames, this.camera,
        instance.tree.parentMatrix, statusArtwork ? .8 : 1, draw.quads ??= new EffectQuadBuffer()));
    }
    if (node.strip) {
      draw.sprite!.updateQuads(effectStripDraw(node.strip, instance.tree.parentMatrix, draw.quads ??= new EffectQuadBuffer()));
    }
  }

  private remove(index: number): void {
    if (this.instances[index].movementRetained) this.instances[index].tree.stop();
    this.instances[index].tree.dispose();
    this.instances[index].draws.forEach(draw => {this.releaseDraw(draw); draw.model?.dispose();});
    this.instances[index].activeHandles?.delete(this.instances[index].handle);
    this.instances.splice(index, 1);
  }

  start(): void {this.running = true;}
  stop(): void {
    this.running = false;
    this.clear();
    for (const renderers of this.idleDraws.values()) renderers.forEach(disposeWorldDraw);
    this.idleDraws.clear();
    this.idleDrawCount = 0;
    this.shotImpact?.dispose();
    this.shotImpact = undefined;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
    this.textureLoading.clear();
    this.sound.releaseResources();
    this.skillSound.releaseResources();
    for (const asset of this.preparedSounds) releaseAudioBuffer(`/${asset}`);
    this.preparedSounds.clear();
    releaseModelLibraries(this.scene, '/data/effects/');
    this.modelLibrary = undefined;
    this.library = undefined;
    this.links = undefined;
    this.audio = undefined;
    this.resourcesLoaded = false;
    this.loading = undefined;
    this.drawRenderings.clear();
  }
  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.skillSound.setVolume(clamped);
    this.sound.setVolume(clamped);
  }

  clear(): void {
    ++this.sceneRevision;
    this.appliedSourcePass = undefined;
    this.cameraShake.clear();
    this.skillSound.clear();
    while (this.instances.length) this.remove(this.instances.length - 1);
    this.screenBackend.clear();
    this.sound.clear();
    this.shotImpact?.clear();
  }

  /** Battle rounds release role effects while the loaded map keeps its owners. */
  clearRoundEffects(): void {
    this.cameraShake.clear();
    this.skillSound.clear();
    for (let index = this.instances.length - 1; index >= 0; --index) {
      if (!this.instances[index].scenePlacement) this.remove(index);
    }
    this.sound.clear();
    this.shotImpact?.clear();
  }
}
