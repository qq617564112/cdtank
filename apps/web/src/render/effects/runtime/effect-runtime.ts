import {roleAmmoActionEffectName} from '../../../assets/tanks/role-ammo-visual';
import {Camera, Frustum, Observer, Scene, Texture, Vector3} from '@babylonjs/core';
import {TankView, TankActionMessage} from '../../../assets/tanks/tank-view';
import {EffectPrimaryTag, EFFECT_PRIMARY_TAGS} from '../../../assets/tanks/effect-tag-matrices';
import {EffectRuntimeStatePool} from './effect-runtime-state-pool';
import {EffectRuntimeLibrary, EffectRuntimeNode, EffectRuntimeTree} from './effect-runtime-tree';
import {EffectRenderPass, EffectSpriteMesh} from '../common/effect-sprite-mesh';
import {EffectParticleRenderer} from '../particles/effect-particle-renderer';
import {EFFECT_IDENTITY} from '../common/effect-render-transform';
import {effectBoltDrawVertices} from '../bolts/effect-bolt-draw';
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
import {effectModelDraw} from '../models/effect-model-draw';
import {effectModelEngineDelta} from '../models/effect-model-animation';
import {EffectSkillSound, SkillSoundCatalog} from '../../../audio/effect-skill-sound';
import {LegacyScreenEffectBackend} from './legacy-screen-effect';

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
interface Draw {node: EffectRuntimeNode; controller: number; passKey?: string; sprite?: EffectSpriteMesh; particle?: EffectParticleRenderer; overlay?: EffectOverlayMesh; overlayRectangle?: EffectOverlayDrawState; model?: EffectModelRenderer;}
interface Instance {handle: number; owner?: TankView; scenePlacement?: boolean; sourceScenePlacementId?: string; crushRetained?: boolean; movementRetained?: boolean; tree: EffectRuntimeTree; draws: Draw[];}

/** Original ELK messages, shared CRT random stream, source trees and GBF draws. */
export class EffectRuntime {
  private library?: Library;
  private modelLibrary?: EffectModelLibrary;
  private readonly modelBackends = new WeakMap<EffectModelNodeState, EffectModelRenderer>();
  private deltaSeconds = 0;
  private links?: Links;
  private readonly textures = new Map<string, Texture>();
  private readonly sound = new EffectSound();
  private readonly statePool = new EffectRuntimeStatePool();
  private readonly instances: Instance[] = [];
  private readonly subscriptions = new Map<TankView, Observer<TankActionMessage>>();
  private readonly movementSubscriptions = new Map<TankView, Observer<readonly [number, number, number]>>();
  private readonly deviceStates = new Map<string, string>([['CullMode', 'CCW']]);
  private nextInstance = 0;
  private randomSeed = 1;
  private running = false;
  private sceneRevision = 0;
  private renderObserver?: Observer<Scene>;
  private readonly cameraShake: EffectCameraShakeView;
  private readonly skillSound: EffectSkillSound;
  private readonly screenBackend: LegacyScreenEffectBackend;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.screenBackend = new LegacyScreenEffectBackend(scene);
    this.cameraShake = new EffectCameraShakeView(camera, () => this.random());
    this.skillSound = new EffectSkillSound(camera);
    scene.onDisposeObservable.addOnce(() => {
      this.stop();
      for (const [view, observer] of this.subscriptions) view.actionMessages.remove(observer);
      this.subscriptions.clear();
      for (const [view, observer] of this.movementSubscriptions) view.movementDustPositions.remove(observer);
      this.movementSubscriptions.clear();
      if (this.renderObserver) scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = undefined;
      this.sound.dispose();
      this.skillSound.dispose();
      this.textures.clear();
      this.screenBackend.dispose();
    });
  }

  private random(): number {
    this.randomSeed = (Math.imul(this.randomSeed, 214013) + 2531011) >>> 0;
    return (this.randomSeed >>> 16) & 32767;
  }

  async load(): Promise<void> {
    if (this.library || this.scene.isDisposed) return;
    const [library, links, audio, models] = await Promise.all([
      this.json<Library>('/effect-library.json'), this.json<Links>('/effect-links.json'),
      this.json<SkillSoundCatalog>('/audio.json'),
      this.json<EffectModelLibrary>('/effect-models.json'),
    ]);
    if (this.scene.isDisposed) return;
    this.skillSound.configure(audio);
    await this.sound.configure(audio, this.skillSound.audioContext()!);
    if (this.scene.isDisposed) return;
    const indices = new Set<number>();
    const collect = (node: EffectRuntimeLibrary['nodes'][number]): void => {
      if (indices.has(node.index)) return;
      indices.add(node.index);
      node.children.forEach(id => {const child = library.nodes.find(row => row.id === id); if (child) collect(child);});
    };
    for (const file of links.files) for (const group of file.groups) for (const action of group.actions) {
      for (const record of action.records) {
        const node = library.nodes.find(row => row.name === record.field04String);
        if (node) collect(node);
      }
    }
    library.nodes.filter(node => /^_root\\online\\\d+$/.test(node.name)).forEach(collect);
    await Promise.all([...library.textureGrids, ...library.boltTextures].filter(grid => indices.has(grid.node) && grid.asset).map(async grid => {
      await this.loadTexture(grid.asset);
    }));
    if (this.scene.isDisposed) return;
    await Promise.all(models.resources.flatMap(resource => resource.nodes.flatMap(node => node.parts
      .filter(part => part.asset).map(part => this.loadTexture(part.asset!, true)))));
    if (this.scene.isDisposed) return;
    await this.prepareShotRenderer(library);
    if (this.scene.isDisposed) return;
    this.library = library;
    this.links = links;
    this.modelLibrary = models;
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

  private async loadTexture(asset: string, model = false): Promise<void> {
    if (this.scene.isDisposed || this.textures.has(asset)) return;
    await new Promise<void>((resolve, reject) => {
      const texture = new Texture(`/${asset}`, this.scene, true, false,
        model ? Texture.BILINEAR_SAMPLINGMODE : Texture.NEAREST_SAMPLINGMODE, () => resolve(), message => reject(new Error(message)));
      if (model) {texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE; texture.anisotropicFilteringLevel = 1;}
      this.textures.set(asset, texture);
    });
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
    if (this.clipped(new Vector3(-origin[0], origin[1], origin[2]))) return 0;
    const definition = this.library.nodes.find(node => node.name === name);
    return definition ? this.addInstance(undefined, this.createTree(definition.id, origin)) : 0;
  }

  /** Castle45d16f starts named effects on live root or tag matrices without one-shot clipping. */
  spawnCastleEffect(name: '039' | '040' | '041', matrix: EffectNativeMatrix): number {
    if (!this.running || !this.library) return 0;
    const definition = this.library.nodes.find(node => node.name === `_root\\online\\${name}`);
    return definition ? this.addInstance(undefined, this.createTree(definition.id, [0, 0, 0], matrix)) : 0;
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
    return definition ? this.addInstance(view, this.createTree(definition.id, [0, 0, 0], parent)) : 0;
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

  /** Original485b1b scene object cue uses the supplied native world position. */
  playSceneSound(reference: string, position: EffectVec3, selector: 1 | -1 = 1): number {
    return this.skillSound.play(reference, selector, position);
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
    this.camera.getViewMatrix();
    this.camera.getProjectionMatrix();
    return Frustum.GetPlanes(this.camera.getTransformationMatrix())
      .some(plane => plane.dotCoordinate(position) <= 0);
  }

  private createTree(identifier: number, origin: EffectVec3, parent?: EffectNativeMatrix, retain = false): EffectRuntimeTree {
    const models = new Map<number, EffectModelRenderer>();
    const tree = new EffectRuntimeTree(this.library!, identifier, origin, parent,
      () => this.random(), this.sound, this.sound.shared, undefined, this.statePool,
      {shake: (parameter, duration, strength) => this.cameraShake.activate(parameter, duration, strength),
        selectEffect: (index, parameter, owner) => this.screenBackend.selectEffect(index, parameter, owner),
        clearEffect: owner => this.screenBackend.clearEffect(owner)},
      definition => {
        const reference = this.library!.modelControls.find(row => row.node === definition.index)!.reference;
        const backend = new EffectModelRenderer(this.scene, this.modelLibrary!.resources.find(row => row.reference === reference)!,
          this.modelLibrary!, this.textures, () => effectModelEngineDelta(this.deltaSeconds), definition.index, definition.name);
        models.set(definition.index, backend);
        return backend;
      }, undefined, undefined, retain);
    tree.nodes.forEach(node => {if (node.model) this.modelBackends.set(node.model, models.get(node.definition.index)!);});
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
    sourceScenePlacementId?: string, startImmediately = true): number {
    this.deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
    if (startImmediately) tree.start();
    const handle = ++this.nextInstance;
    this.instances.push({handle, owner: view, scenePlacement, sourceScenePlacementId,
      crushRetained: scenePlacement && !startImmediately, tree, draws: tree.nodes.filter(node => node.sprite || node.particle || node.strip || node.bolt || node.overlay || node.model)
      .map(node => ({node, controller: -1, model: node.model ? this.modelBackends.get(node.model) : undefined}))});
    return handle;
  }

  private async json<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`原特效资源载入失败：${path}`);
    return response.json() as Promise<T>;
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
    this.sound.update();
  }

  private draw(instance: Instance, draw: Draw): void {
    if (instance.owner?.hiddenFromObserver) {
      draw.model?.draw(undefined);
      draw.sprite?.updateQuads([]);
      draw.particle?.sprite.updateQuads([]);
      draw.overlay?.update();
      return;
    }
    const node = draw.node;
    if (node.model) {
      draw.model!.draw(node.lifecycle.phase === 2 && node.lifecycle.controller >= 0 ?
        effectModelDraw(node.model, instance.tree.parentMatrix) : undefined);
      return;
    }
    if (node.lifecycle.phase !== 2 || (!node.bolt && node.lifecycle.controller < 0)) {
      draw.sprite?.updateQuads([]); draw.particle?.sprite.updateQuads([]); draw.overlay?.update(); return;
    }
    const controller = node.lifecycle.controller;
    const grid = (node.bolt ? this.library!.boltTextures : this.library!.textureGrids).find(row => row.node === node.definition.index)!;
    const boltControl = node.bolt ? this.library!.boltControls.find(row => row.node === node.definition.index)! : undefined;
    const selections = node.particle ? this.library!.rendering.particleSelections : this.library!.rendering.spriteSelections;
    const stripFlags = node.strip ? this.library!.stripControls.find(row =>
      row.node === node.definition.index && row.modifier === controller)!.renderFlags : 0;
    const selector = node.overlay ? undefined : boltControl ? (boltControl.flag ? 7 : 6) : node.strip ? selectSpriteRenderScript(stripFlags, false) : selections.find(row => row.node === node.definition.index && row.modifier === controller)!.selector;
    const overlayControl = node.overlay ? this.library!.overlayControls.find(row => row.node === node.definition.index)! : undefined;
    const sourcePass = overlayControl ? this.library!.rendering.overlayScripts.find(row => row.textured === overlayControl.textured)!.techniques[0].passes[0] :
      this.library!.rendering.scripts.find(row => row.index === selector)!.techniques[0].passes[0];
    sourcePass.states.forEach(state => this.deviceStates.set(state.name, state.value));
    const pass = {states: [...this.deviceStates].map(([name, value]) => ({name, value}))};
    const passKey = pass.states.map(state => `${state.name}=${state.value}`).join(';');
    if (draw.controller !== controller || draw.passKey !== passKey) {
      draw.sprite?.dispose(); draw.particle?.dispose(); draw.overlay?.dispose();
      const texture = this.textures.get(grid.asset)!;
      if (node.particle) draw.particle = new EffectParticleRenderer(this.scene, pass, texture, grid.uvFrames);
      else if (node.overlay) {
        draw.overlay = new EffectOverlayMesh(this.scene, pass, texture);
        draw.overlayRectangle ??= new EffectOverlayDrawState(this.scene.getEngine().getRenderWidth(), this.scene.getEngine().getRenderHeight());
      }
      else draw.sprite = new EffectSpriteMesh(this.scene, pass, texture);
      draw.controller = controller;
      draw.passKey = passKey;
      const mesh = draw.sprite?.mesh ?? draw.particle?.sprite.mesh ?? draw.overlay!.mesh;
      mesh.metadata = {originalEffect: node.definition.name, sourceNode: node.definition.index,
        sourceScenePlacementId: instance.sourceScenePlacementId};
      mesh.alphaIndex = this.scene.meshes.indexOf(mesh);
    }
    if (node.particle) draw.particle!.update(this.camera, node.particle.pool.particles);
    if (node.overlay) {
      const engine = this.scene.getEngine();
      draw.overlayRectangle!.resize(engine.getRenderWidth(), engine.getRenderHeight());
      draw.overlay!.update(draw.overlayRectangle!.draw(node.overlay.color,
        overlayControl!.textured, grid.uvFrames[node.overlay.frame]));
    }
    if (node.bolt) {
      const eye = this.camera.globalPosition;
      draw.sprite!.updateTriangleStrip(effectBoltDrawVertices(node.bolt.worldSegments,
        EFFECT_IDENTITY, [-eye.x, eye.y, eye.z], boltControl!.width, boltControl!.color));
    }
    if (node.sprite) {
      const sprite = node.sprite;
      const control = this.library!.spriteControls.find(row => row.node === node.definition.index && row.modifier === controller)!;
      const billboard = (parseInt(control.remainingFieldAc.slice(0, 2), 16) & 1) !== 0;
      draw.sprite!.updateQuads(effectSpriteDraw(sprite, billboard, grid.uvFrames, this.camera, instance.tree.parentMatrix));
    }
    if (node.strip) {
      draw.sprite!.updateQuads(effectStripDraw(node.strip, instance.tree.parentMatrix));
    }
  }

  private remove(index: number): void {
    if (this.instances[index].movementRetained) this.instances[index].tree.stop();
    this.instances[index].tree.dispose();
    this.instances[index].draws.forEach(draw => {draw.sprite?.dispose(); draw.particle?.dispose(); draw.overlay?.dispose(); draw.model?.dispose();});
    this.instances.splice(index, 1);
  }

  start(): void {this.running = true;}
  stop(): void {this.running = false; this.clear();}
  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.skillSound.setVolume(clamped);
    this.sound.setVolume(clamped);
  }

  clear(): void {
    ++this.sceneRevision;
    this.cameraShake.clear();
    this.skillSound.clear();
    while (this.instances.length) this.remove(this.instances.length - 1);
    this.screenBackend.clear();
    this.sound.clear();
  }

  /** Battle rounds release role effects while the loaded map keeps its owners. */
  clearRoundEffects(): void {
    this.cameraShake.clear();
    this.skillSound.clear();
    for (let index = this.instances.length - 1; index >= 0; --index) {
      if (!this.instances[index].scenePlacement) this.remove(index);
    }
    this.sound.clear();
  }
}
