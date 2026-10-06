import {ArcRotateCamera, AssetContainer, LoadAssetContainerAsync, Matrix, Observable, Quaternion, Scene, TransformNode, Vector3, Viewport} from '@babylonjs/core';
import type {ObjectiveSnapshot} from '../../../../shared/protocols';
import {SceneCvdAnimation} from './scene-cvd-animation';
import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {SceneBreachState} from './scene-breach-state';
import {SceneBreachVisual} from './scene-breach-visual';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {EffectVec3} from '../../render/effects/common/types';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {SceneCastleVisual, type CastleModelResource} from './scene-castle-visual';
import {SceneCastleDamageText} from './scene-castle-damage-text';
import {SceneCastleDamageTextRenderer} from '../../render/scene-castle-damage-text-renderer';
import type {CastleDamageTextFont} from '../../render/scene-castle-damage-text-renderer';
import {SceneCastlePresentation} from './scene-castle-presentation';
import type {CastleDamageResult} from './scene-castle-state';
import {SceneCrushPresentation} from './scene-crush-presentation';
import {sceneCrushTransform} from './scene-crush-transform';
import {SceneWater} from './scene-water';
import {ScenePlantSway} from './scene-plant-sway';
import {SceneTerrainMaterial} from './scene-terrain-material';
import {SceneGeneralMaterial} from './scene-general-material';
import {SceneBreachMaterial, sceneBreachMaterialModel} from './scene-breach-material';
import {sceneBreachLibrary, type SceneBreachDestruction} from './scene-breach-resources';
import type {AbstractMesh} from '@babylonjs/core';

export interface SceneMovementSurface {
  id: string;
  meshes: readonly AbstractMesh[];
  terrain: boolean;
  enabled: boolean;
}

interface Placement {
  id: string;
  model: string;
  matrix: number[];
  position: number[];
  rotation: number[];
  enabled: number;
  asset?: string;
  className?: string;
  animation?: {library: string; reference: string};
  destruction?: SceneBreachDestruction;
}
interface SceneEntry {
  id: string;
  terrain: string;
  records: Placement[];
  castles: Placement[];
  resolved: number;
}
interface CrushSnapshot {
  sourcePlacementId: string;
  enabled: boolean;
  hidden: boolean;
}

interface PlantSnapshot {
  sourcePlacementId: string;
  enabled: boolean;
  hidden: boolean;
}

export class ScenePreview {
  readonly onCastleDamageText = new Observable<{castleId: string; delta: number}>();
  readonly onCastleDestroyed = new Observable<{castleId: string}>();
  private readonly castles = new Map<string, {visual: SceneCastleVisual;
    presentation: SceneCastlePresentation; runtime: EffectRuntime}>();
  private readonly castleDamageTexts = new Map<string, SceneCastleDamageText>();
  private readonly objectDamageTexts = new Map<string, SceneCastleDamageText>();
  private castleDamageTextRenderer?: SceneCastleDamageTextRenderer;
  private readonly assets: AssetContainer[] = [];
  private readonly minimapGeometry: AbstractMesh[] = [];
  get minimapMeshes(): readonly AbstractMesh[] {return this.minimapGeometry;}
  private readonly movementGeometry = new Map<string, SceneMovementSurface>();
  get movementSurfaces(): readonly SceneMovementSurface[] {return [...this.movementGeometry.values()];}
  private water?: SceneWater;
  private plants?: ScenePlantSway;
  private terrainMaterial?: SceneTerrainMaterial;
  private generalMaterial?: SceneGeneralMaterial;
  private breachMaterial?: SceneBreachMaterial;
  private readonly crushes = new Map<string, {root: TransformNode;
    matrix: EffectNativeMatrix; presentation: SceneCrushPresentation;
    sourceEnabled: boolean; enabled: boolean; hidden: boolean; consumedShot: boolean}>();
  private crushRound?: number;
  private readonly crushSnapshots = new Map<string, CrushSnapshot>();
  private readonly plantRoots = new Map<string, {root: TransformNode; sourceEnabled: boolean}>();
  private readonly plantSnapshots = new Map<string, PlantSnapshot>();
  private plantRound?: number;
  private readonly disposals: (() => void)[] = [];
  private revision = 0;
  private readonly animations: SceneCvdAnimation[] = [];
  private round?: number;
  private readonly breakables = new Map<string, {root: TransformNode; state: SceneBreachState;
    broken?: SceneBreachVisual; position: EffectVec3; soundPlayed: boolean}>();

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera) {
    scene.onDisposeObservable.addOnce(() => {this.clear();});
  }

  clear(): void {
    this.revision++;
    this.minimapGeometry.length = 0;
    this.movementGeometry.clear();
    this.water?.dispose();
    this.water = undefined;
    this.plants?.dispose();
    this.plants = undefined;
    this.plantRoots.clear();
    this.plantSnapshots.clear();
    this.plantRound = undefined;
    this.terrainMaterial?.dispose();
    this.terrainMaterial = undefined;
    this.generalMaterial?.dispose();
    this.generalMaterial = undefined;
    this.breachMaterial?.dispose();
    this.breachMaterial = undefined;
    this.castles.forEach(value => {value.presentation.dispose(); value.visual.dispose();});
    this.castles.clear();
    this.castleDamageTexts.forEach(queue => queue.clear());
    this.castleDamageTexts.clear();
    this.objectDamageTexts.forEach(queue => queue.clear());
    this.objectDamageTexts.clear();
    this.castleDamageTextRenderer?.dispose();
    this.castleDamageTextRenderer = undefined;
    this.crushes.forEach(value => {value.presentation.dispose();});
    this.crushes.clear();
    this.crushSnapshots.clear();
    this.crushRound = undefined;
    this.animations.splice(0).forEach(animation => {animation.dispose();});
    this.breakables.forEach(value => {value.broken?.dispose();});
    this.breakables.clear();
    this.round = undefined;
    this.disposals.splice(0).forEach(dispose => dispose());
    this.assets.splice(0).forEach(asset => asset.dispose());
  }

  async load(id: string, runtime?: EffectRuntime): Promise<string> {
    const pendingPlants = this.plantRoots.size === 0 ? [...this.plantSnapshots.values()] : [];
    const pendingPlantRound = this.plantRoots.size === 0 ? this.plantRound : undefined;
    this.clear();
    if (['0002', '0004', '0005', '0006', '0017', '0021'].includes(id) && pendingPlantRound !== undefined) {
      this.reconcilePlants(pendingPlants, pendingPlantRound);
    }
    const revision = this.revision;
    if (this.scene.isDisposed) return '';
    const response = await fetch('/scene-placements.json');
    const entries: SceneEntry[] = await response.json();
    if (revision !== this.revision) {
      return '';
    }
    const entry = entries.find(value => value.id === id);
    if (!entry) {
      throw new Error('找不到地图放置数据');
    }
    const terrain = await LoadAssetContainerAsync(`/${entry.terrain}`, this.scene);
    if (revision !== this.revision) {
      terrain.dispose();
      return '';
    }
    terrain.addAllToScene();
    // Terrain primitives share a continuous surface. Extruding each primitive
    // would draw black borders along tile seams rather than object silhouettes.
    terrain.rootNodes.forEach(node => {node.setEnabled(false);});
    this.assets.push(terrain);
    this.minimapGeometry.push(...terrain.meshes);
    this.movementGeometry.set('terrain', {id: 'terrain', meshes: terrain.meshes, terrain: true, enabled: true});
    if (['0002', '0004', '0005', '0006', '0007', '0010', '0011', '0014', '0017', '0018', '0020', '0021', '0022'].includes(id)) {
      const owner = new SceneTerrainMaterial();
      this.terrainMaterial = owner;
      try {await owner.load(id, terrain);} catch (error) {
        if (revision === this.revision) this.clear();
        throw error;
      }
      if (revision !== this.revision) {owner.dispose(); return '';}
    }
    if (['0002', '0004', '0005', '0006', '0017', '0021'].includes(id)) {
      this.plants = new ScenePlantSway();
      await this.plants.load(id);
      if (revision !== this.revision) return '';
    }
    const cache = new Map<string, AssetContainer>();
    let castleResources: CastleModelResource[] = [];
    if (['0002', '0005', '0006', '0010', '0011'].includes(id) && runtime) {
      const response = await fetch(`/scene-castle-${id}.json`);
      if (!response.ok) throw new Error('原城堡资源载入失败');
      castleResources = (await response.json() as {castles: CastleModelResource[]}).castles;
      if (revision !== this.revision) return '';
    }
    const placements = [...entry.records, ...entry.castles];
    const paths = [...new Set(placements.flatMap(placement => castleResources.some(c => c.sourcePlacementId === placement.id) ? [] : placement.asset ? [placement.asset] : []))];
    let next = 0;
    try {
      // Decode independent assets concurrently. Instances still use their exact
      // source placement order, and every pending container belongs to this load.
      await Promise.all(Array.from({length: Math.min(4, paths.length)}, async () => {
        while (next < paths.length && revision === this.revision) {
          const path = paths[next++];
          const asset = await LoadAssetContainerAsync(`/${path}`, this.scene);
          if (revision !== this.revision) {asset.dispose(); return;}
          asset.animationGroups.forEach(group => {group.stop(); group.reset();});
          cache.set(path, asset);
          this.assets.push(asset);
        }
      }));
    } catch (error) {
      if (revision === this.revision) this.clear();
      throw error;
    }
    if (revision !== this.revision) return '';
    let damageRenderer: SceneCastleDamageTextRenderer | undefined;
    if (castleResources.length > 0 || placements.some(value => value.className === 'SYcScnObjBreach')) {
      const fontResponse = await fetch('/ui-fonts.json');
      if (!fontResponse.ok) throw new Error('原字体目录载入失败');
      const fonts = await fontResponse.json() as {fonts: {name: string; attributes: Record<string, string>;
        glyphs?: {codepoint: number; asset: string; width: number; height: number}[]}[]};
      if (revision !== this.revision) return '';
      const damageFont = fonts.fonts.find(font => font.name === 'Damage' && font.attributes.Type === 'Static');
      if (!damageFont?.glyphs?.length) throw new Error('原Damage字体定义缺失');
      damageRenderer = new SceneCastleDamageTextRenderer(this.scene, damageFont as CastleDamageTextFont);
      this.castleDamageTextRenderer = damageRenderer;
      try {await damageRenderer.load();} catch (error) {
        if (revision === this.revision) this.clear();
        throw error;
      }
      if (revision !== this.revision) return '';
    }
    if (id === '0011' || id === '0006') {
      const model = id === '0011' ? 'obj05431' : 'obj05424';
      const owner = new SceneGeneralMaterial();
      this.generalMaterial = owner;
      try {
        const paths = new Set(placements.filter(value => value.className === 'SYcScnObjGeneral' &&
          value.model === model).map(value => value.asset));
        for (const path of paths) {
          const asset = path ? cache.get(path) : undefined;
          if (!asset) throw new Error(`原 General ${model} 资产缺失`);
          owner.register(asset, model);
        }
      } catch (error) {
        this.clear();
        throw error;
      }
    }
    const breachModels = new Set(placements.flatMap(placement => {
      const model = placement.className === 'SYcScnObjBreach'
        ? sceneBreachMaterialModel(placement.model) : undefined;
      return model ? [model] : [];
    }));
    if (breachModels.size > 0) {
      const owner = new SceneBreachMaterial();
      this.breachMaterial = owner;
      try {
        for (const model of breachModels) {
          const paths = new Set(placements.filter(value => value.className === 'SYcScnObjBreach' &&
            value.model === model).map(value => value.asset));
          for (const path of paths) {
            const asset = path ? cache.get(path) : undefined;
            if (!asset) throw new Error(`原 Breach ${model} 资产缺失`);
            owner.register(asset, model);
          }
        }
      } catch (error) {
        this.clear();
        throw error;
      }
    }
    for (const placement of placements) {
      const castle = castleResources.find(value => value.sourcePlacementId === placement.id);
      if (castle && runtime) {
        const visual = new SceneCastleVisual(this.scene, castle);
        this.disposals.push(() => visual.dispose());
        try {await visual.load();} catch (error) {
          if (revision === this.revision) this.clear();
          throw error;
        }
        if (revision !== this.revision) {visual.dispose(); return '';}
        this.minimapGeometry.push(...this.scene.meshes.filter(mesh =>
          mesh.metadata?.sourceCastlePlacementId === castle.sourcePlacementId && mesh.metadata?.sourceCastleAction === 'n1'));
        const presentation = this.castlePresentation(castle.sourcePlacementId, visual, runtime);
        this.castles.set(castle.sourcePlacementId, {visual, presentation, runtime});
        this.movementGeometry.set(castle.sourcePlacementId, {id: castle.sourcePlacementId,
          meshes: this.scene.meshes.filter(mesh => mesh.metadata?.sourceCastlePlacementId === castle.sourcePlacementId
            && mesh.metadata?.sourceCastleAction === 'n1'), terrain: false, enabled: true});
        if (damageRenderer) {
          this.castleDamageTexts.set(castle.sourcePlacementId,
            new SceneCastleDamageText(damageRenderer));
        }
        continue;
      }
      if (placement.animation) {
        const matrix = [...placement.matrix];
        matrix[12] = placement.position[0];
        matrix[13] = placement.position[1];
        matrix[14] = placement.position[2];
        const animation = new SceneCvdAnimation(this.scene, placement.id, matrix as EffectNativeMatrix);
        this.animations.push(animation);
        try {
          await animation.load(placement.animation.library, placement.animation.reference);
        } catch (error) {
          if (revision === this.revision) this.clear();
          throw error;
        }
        if (revision !== this.revision) return '';
        this.minimapGeometry.push(...this.scene.meshes.filter(mesh => mesh.metadata?.sourcePlacementId === placement.id));
        if (placement.className === 'SYcScnObjGeneral') {
          this.movementGeometry.set(placement.id, {id: placement.id,
            meshes: this.scene.meshes.filter(mesh => mesh.metadata?.sourcePlacementId === placement.id),
            terrain: false, enabled: true});
        }
      }
      if (!placement.asset) {
        continue;
      }
      const asset = cache.get(placement.asset)!;
      applyCartoonOutlines(asset.meshes);
      const instance = asset.instantiateModelsToScene(name => `${placement.id}/${name}`, false,
        {doNotInstantiate: placement.className === 'SYcScnObjBreach'});
      const root = new TransformNode(`placement-${placement.id}`, this.scene);
      this.disposals.push(() => {instance.dispose(); root.dispose();});
      instance.rootNodes.forEach(node => {node.parent = root;});
      this.minimapGeometry.push(...root.getChildMeshes());
      const scale = new Vector3();
      const rotation = new Quaternion();
      const position = new Vector3();
      Matrix.FromArray(placement.matrix).decompose(scale, rotation, position);
      // Babylon AUTO glTF conversion reflects X (Y half-turn plus Z reflection).
      // The serialized matrix translation locates the bounds center; position is
      // the geometry origin, so keep only the matrix's rotation and scale.
      root.scaling.copyFrom(scale);
      root.position.set(-placement.position[0], placement.position[1], placement.position[2]);
      root.rotationQuaternion = new Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
      if (['SYcScnObjBreach', 'SYcScnObjGeneral', 'SYcScnObjCrush', 'SYcCastle'].includes(placement.className ?? '')) {
        this.movementGeometry.set(placement.id, {id: placement.id,
          meshes: [...(this.movementGeometry.get(placement.id)?.meshes ?? []), ...root.getChildMeshes()],
          terrain: false, enabled: placement.className !== 'SYcScnObjCrush' || placement.enabled === 1});
      }
      if (placement.className === 'SYcScnObjPlant') {
        this.plants?.register(placement.id, root);
        if (['0002', '0004', '0005', '0006', '0017', '0021'].includes(id)) this.registerPlant(placement.id, root, Boolean(placement.enabled));
      }
      if (id === '0007' && placement.className === 'SYcScnObjCrush' &&
        placement.model === 'obj05420' && runtime) {
        // Original +78 holds a matrix built from position/angles, separate from
        // the serialized bounds matrix used by the static placement consumer.
        const matrix = sceneCrushTransform(placement.position as EffectVec3,
          placement.rotation as EffectVec3);
        root.setEnabled(Boolean(placement.enabled));
        let handle: number;
        try {handle = await runtime.retainCrushEffect(matrix, placement.id);} catch (error) {
          if (revision === this.revision) this.clear();
          throw error;
        }
        if (revision !== this.revision) {runtime.releaseSceneEffect(handle); return '';}
        const presentation = new SceneCrushPresentation({hide: () => root.setEnabled(false)}, runtime, handle);
        this.registerCrush(placement.id, root, matrix, presentation, Boolean(placement.enabled));
        continue;
      }
      if (placement.className === 'SYcScnObjBreach') {
        const value = {root, state: new SceneBreachState(), position: [...placement.position] as EffectVec3,
          soundPlayed: false, broken: undefined as SceneBreachVisual | undefined};
        this.breakables.set(placement.id, value);
        const libraryAsset = sceneBreachLibrary(id, placement.model, placement.destruction);
        if (libraryAsset) {
          const matrix = [...placement.matrix];
          matrix[12] = placement.position[0];
          matrix[13] = placement.position[1];
          matrix[14] = placement.position[2];
          value.broken = new SceneBreachVisual(this.scene, placement.id,
            matrix as EffectNativeMatrix, placement.model, libraryAsset);
          try {await value.broken.load();} catch (error) {
            if (revision === this.revision) this.clear();
            throw error;
          }
          if (revision !== this.revision) return '';
          value.state = new SceneBreachState(value.broken.durationSeconds);
        }
      }
    }
    terrain.rootNodes.forEach(node => {node.setEnabled(true);});
    if (id === '0002') {
      this.water = new SceneWater(this.scene);
      await this.water.load(id);
      if (revision !== this.revision) return '';
      this.minimapGeometry.push(...this.scene.meshes.filter(mesh => mesh.metadata?.sourceSceneWater));
    }
    const bounds = terrain.rootNodes[0].getHierarchyBoundingVectors();
    const center = bounds.min.add(bounds.max).scale(0.5);
    // Sky walls are part of the POL bounds; frame the playfield at ground level.
    this.camera.setTarget(new Vector3(center.x, 0, center.z), false, true, true);
    this.camera.beta = Math.PI / 6;
    this.camera.radius = Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.8;
    this.camera.lowerRadiusLimit = 20;
    this.camera.upperRadiusLimit = this.camera.radius * 4;
    return `地图 ${id} · ${entry.resolved} 个物件 · ${placements.length - entry.resolved} 个记录待接入`;
  }

  /** Frame-driven CVD playback; independent of network snapshot frequency. */
  advance(deltaSeconds: number): void {
    this.water?.advance(deltaSeconds);
    this.plants?.advance(deltaSeconds);
    this.animations.forEach(animation => {animation.advance(deltaSeconds);});
    this.castles.forEach(value => value.visual.update(deltaSeconds));
    const engine = this.scene.getEngine();
    const viewport = {width: engine.getRenderWidth(), height: engine.getRenderHeight()};
    this.castles.forEach((value, castleId) => {
      const queue = this.castleDamageTexts.get(castleId);
      if (!queue) return;
      const native = value.visual.position;
      const viewPoint = Vector3.TransformCoordinates(new Vector3(-native[0], native[1], native[2]),
        this.camera.getViewMatrix());
      const viewZ = viewPoint.z;
      queue.advance(deltaSeconds, viewZ);
      queue.draw(viewport);
    });
    this.objectDamageTexts.forEach((queue, placementId) => {
      const value = this.breakables.get(placementId);
      if (!value) return;
      const native = value.position;
      const viewPoint = Vector3.TransformCoordinates(new Vector3(-native[0], native[1], native[2]),
        this.camera.getViewMatrix());
      queue.advance(deltaSeconds, viewPoint.z);
      queue.draw(viewport);
    });
  }

  /** Source Plant visibility follows snapshots, including state received before load. */
  reconcilePlants(states: readonly PlantSnapshot[], round: number): void {
    this.plantRound = round;
    this.plantSnapshots.clear();
    for (const state of states) this.plantSnapshots.set(state.sourcePlacementId, {...state});
    for (const [id, value] of this.plantRoots) {
      const state = this.plantSnapshots.get(id);
      value.root.setEnabled(value.sourceEnabled && (state?.enabled ?? true) && !state?.hidden);
    }
  }

  private registerPlant(id: string, root: TransformNode, sourceEnabled: boolean): void {
    this.plantRoots.set(id, {root, sourceEnabled});
    const state = this.plantSnapshots.get(id);
    root.setEnabled(sourceEnabled && (state?.enabled ?? true) && !state?.hidden);
  }

  /** Single accepted Castle transaction; snapshot reconciliation never replays impact cues. */
  damageCastle(result: CastleDamageResult & {castleId: string}): void {
    this.castles.get(result.castleId)?.presentation.damage(result);
  }

  /** Accepted ordinary object damage uses the loaded Damage glyphs. */
  damageObject(placementId: string, delta: number, position: EffectVec3): void {
    if (!this.breakables.has(placementId) || !this.castleDamageTextRenderer || delta <= 0) return;
    let queue = this.objectDamageTexts.get(placementId);
    if (!queue) {
      queue = new SceneCastleDamageText(this.castleDamageTextRenderer);
      this.objectDamageTexts.set(placementId, queue);
    }
    const engine = this.scene.getEngine();
    const point = Vector3.Project(new Vector3(-position[0], position[1], position[2]),
      Matrix.Identity(), this.camera.getTransformationMatrix(),
      new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    queue.show(Math.trunc(point.x), Math.trunc(point.y), Math.trunc(delta));
  }

  /** Loading and room recovery restore current state without replaying past impacts. */
  restoreObjects(objects: readonly Pick<ObjectiveSnapshot,
    'sourcePlacementId' | 'hp' | 'maxHp' | 'destroyedAt'>[],
    round: number, serverTime: number): void {
    this.updateObjects(objects, round, serverTime, 0);
    for (const object of objects) {
      if (object.sourcePlacementId === undefined) continue;
      const elapsed = object.destroyedAt === undefined ? 0 :
        Math.max(0, (serverTime - object.destroyedAt) / 1000);
      const breach = this.breakables.get(object.sourcePlacementId);
      if (breach) {
        breach.state.reset();
        breach.broken?.reset();
        breach.soundPlayed = object.hp <= 0;
        if (object.hp <= 0) {
          breach.state.destroy();
          breach.state.update(elapsed);
          breach.broken?.seek(elapsed);
        }
      }
      this.castles.get(object.sourcePlacementId)?.presentation.restore(
        {currentHP: object.hp, maxHP: object.maxHp}, elapsed);
    }
    this.advanceBreachVisuals(0);
  }

  /** Accepted Crush transaction only; loading an owner never starts051. */
  crush(placementId: string): void {
    const value = this.crushes.get(placementId);
    if (!value || !value.enabled || value.consumedShot) return;
    // The server sends the hidden snapshot before its accepted ShotItem event.
    value.consumedShot = true;
    value.hidden = true;
    value.presentation.crush();
  }

  /** Snapshots reconcile visibility without replaying a past ShotItem result. */
  reconcileCrushes(states: readonly CrushSnapshot[], round: number): void {
    if (round !== this.crushRound) {
      for (const value of this.crushes.values()) {
        value.presentation.reset();
        value.enabled = value.sourceEnabled;
        value.hidden = false;
        value.consumedShot = false;
        value.root.setEnabled(value.sourceEnabled);
      }
      this.crushRound = round;
    }
    this.crushSnapshots.clear();
    for (const state of states) {
      this.crushSnapshots.set(state.sourcePlacementId, state);
      const value = this.crushes.get(state.sourcePlacementId);
      if (!value) continue;
      value.enabled = state.enabled;
      value.hidden = state.hidden;
      value.root.setEnabled(state.enabled && !state.hidden);
    }
  }

  private registerCrush(id: string, root: TransformNode, matrix: EffectNativeMatrix,
    presentation: SceneCrushPresentation, sourceEnabled: boolean): void {
    const state = this.crushSnapshots.get(id);
    const enabled = state?.enabled ?? sourceEnabled;
    const hidden = state?.hidden ?? false;
    root.setEnabled(enabled && !hidden);
    this.crushes.set(id, {root, matrix, presentation, sourceEnabled, enabled, hidden, consumedShot: false});
  }

  private castlePresentation(castleId: string, visual: SceneCastleVisual,
    runtime: EffectRuntime): SceneCastlePresentation {
    return new SceneCastlePresentation({position: visual.position,
      matrix: target => visual.matrix(target),
      action: (name, mode, elapsedSeconds) => visual.action(name, mode, elapsedSeconds),
      seekDestroyed: elapsedSeconds => visual.seekDestroyed(elapsedSeconds),
      damageText: delta => this.showCastleDamage(castleId, visual, delta),
      destroyCallback: () => this.onCastleDestroyed.notifyObservers({castleId}),
    }, runtime);
  }

  private showCastleDamage(castleId: string, visual: SceneCastleVisual, delta: number): void {
    this.onCastleDamageText.notifyObservers({castleId, delta});
    const queue = this.castleDamageTexts.get(castleId);
    if (!queue || !this.castleDamageTextRenderer) return;
    const engine = this.scene.getEngine();
    const viewport = {width: engine.getRenderWidth(), height: engine.getRenderHeight()};
    const native = visual.position;
    const point = Vector3.Project(new Vector3(-native[0], native[1], native[2]),
      Matrix.Identity(), this.camera.getTransformationMatrix(),
      new Viewport(0, 0, viewport.width, viewport.height));
    queue.show(Math.trunc(point.x), Math.trunc(point.y), delta);
  }

  /** Original44e081 selects the model's cue once at object+58 after destruction. */
  destroyObject(sourcePlacementId: string, sound: Pick<EffectRuntime, 'playSceneSound'>): void {
    const value = this.breakables.get(sourcePlacementId);
    if (!value?.broken || value.soundPlayed) return;
    value.soundPlayed = true;
    const reference = ['obj05425', 'obj05426', 'obj05427'].includes(value.broken.model) ? 'GA32' :
      value.broken.model === 'obj05428' ? 'GA30' :
      value.broken.model === 'obj05469' ? 'GA33' :
      ['obj05460', 'obj05434', 'obj05435', 'obj05436'].includes(value.broken.model) ? 'GA12' :
      ['obj05461', 'obj05462', 'obj05442'].includes(value.broken.model) ? 'GA41' : 'GA13';
    sound.playSceneSound(reference, value.position);
  }

  /** Authoritative source IDs control presentation; never infer damage locally. */
  updateObjects(objectives: readonly Pick<ObjectiveSnapshot, 'sourcePlacementId' | 'hp' | 'destroyedAt'>[], round: number, serverTime: number,
                deltaSeconds: number): void {
    if (round !== this.round) {
      if (this.round !== undefined) {
        this.castleDamageTexts.forEach(queue => queue.clear());
        this.objectDamageTexts.forEach(queue => queue.clear());
        for (const [castleId, value] of this.castles) {
          value.presentation.dispose();
          value.visual.action('n1', 0);
          value.presentation = this.castlePresentation(castleId, value.visual, value.runtime);
        }
      }
      this.round = round;
      for (const value of this.breakables.values()) {
        value.state.reset();
        value.broken?.reset();
        value.soundPlayed = false;
      }
    }
    for (const objective of objectives) {
      if (objective.sourcePlacementId === undefined) continue;
      const value = this.breakables.get(objective.sourcePlacementId);
      if (!value) continue;
      if (objective.hp > 0) {
        // A positive HP snapshot after an existing break is the same-round
        // respawn signal; reset only that source instance, never every frame.
        if (!value.state.snapshot().fading) continue;
        value.state.reset();
        value.broken?.reset();
        value.soundPlayed = false;
        continue;
      }
      if (value.state.destroy() && objective.destroyedAt !== undefined) {
        // Late joins must not replay a destruction that completed long ago.
        const elapsed = Math.max(0, (serverTime - objective.destroyedAt) / 1000);
        value.state.update(elapsed);
        value.broken?.seek(elapsed);
      }
    }
    this.advanceBreachVisuals(deltaSeconds);
  }

  private advanceBreachVisuals(deltaSeconds: number): void {
    const elapsed = Math.fround(effectModelEngineDelta(deltaSeconds));
    for (const {root, state, broken} of this.breakables.values()) {
      state.update(elapsed);
      const visual = state.snapshot();
      root.setEnabled(broken ? !visual.fading : !visual.hidden);
      broken?.advance(elapsed, visual.alpha, visual.fading && !visual.hidden);
      root.metadata = {...root.metadata, sourceBreach: visual};
      for (const mesh of root.getChildMeshes()) mesh.visibility = Math.max(0, visual.alpha);
    }
  }
}
