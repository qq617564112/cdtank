import {AssetContainer, BaseTexture, Mesh, MorphTargetManager, type Effect, type LoadAssetContainerOptions, type MorphTarget,
  type Scene} from '@babylonjs/core';
import type {IGLTFLoaderData} from '@babylonjs/loaders/glTF';
import {battleArtworkUrl} from '../battle-artwork';
import {loadPreparedModel} from '../model-resources';
import {compactMv3Extras, type SourceMv3Extras, type SourceMv3Material, type Mv3ModelExtras} from './mv3-model-extras';
import {compactMv3MorphTargets, mv3MorphTextureLayers, prepareMv3MorphTargets} from './mv3-morph-storage';
import {compactMv3GeometrySources} from './mv3-geometry-storage';

interface Mv3Animation {
  samplers: {input: number; interpolation?: string}[];
  channels: {sampler: number; target: {node: number; path: string}}[];
}
interface Mv3Document {
  accessors: {bufferView: number; byteOffset?: number; count: number; componentType: number;
    type: string; min?: number[]; max?: number[]}[];
  bufferViews: {byteOffset?: number}[];
  animations?: Mv3Animation[];
  extras?: SourceMv3Extras;
  meshes?: {primitives: {material?: number; targets?: Record<string, number>[]}[]; weights?: number[]}[];
  nodes?: {mesh?: number; weights?: number[]}[];
  materials?: {extras?: {originalMV3?: SourceMv3Material};
    pbrMetallicRoughness?: {baseColorTexture?: unknown}}[];
}
interface Mv3Timeline {node: number; frames: Float64Array;}
interface Mv3Template {assets: AssetContainer; timelines: readonly Mv3Timeline[]; extras: Mv3ModelExtras | undefined;}
interface SharedModel {references: number; loading: Promise<Mv3Template>;}

/** Exported accessor bounds prove every position and normal delta is zero. */
function omitStaticMorphTargets(document: Mv3Document): void {
  const isZero = (index: number): boolean => {
    const accessor = document.accessors[index];
    return accessor.componentType === 5126 && accessor.type === 'VEC3'
      && accessor.min?.length === 3 && accessor.max?.length === 3
      && accessor.min.every(value => value === 0) && accessor.max.every(value => value === 0);
  };
  const staticMeshes = new Set<number>();
  for (const [index, mesh] of (document.meshes ?? []).entries()) {
    if (!mesh.primitives.every(primitive => primitive.targets?.length
      && primitive.targets.every(target => Object.keys(target).length === 2
        && target.POSITION !== undefined && target.NORMAL !== undefined
        && isZero(target.POSITION) && isZero(target.NORMAL)))) continue;
    staticMeshes.add(index);
    for (const primitive of mesh.primitives) delete primitive.targets;
    delete mesh.weights;
  }
  if (!staticMeshes.size) return;
  for (const node of document.nodes ?? []) {
    if (node.mesh !== undefined && staticMeshes.has(node.mesh)) delete node.weights;
  }
  for (const animation of document.animations ?? []) {
    animation.channels = animation.channels.filter(channel => {
      const mesh = document.nodes?.[channel.target.node]?.mesh;
      return channel.target.path !== 'weights' || mesh === undefined || !staticMeshes.has(mesh);
    });
  }
}

const sceneModels = new WeakMap<Scene, Map<string, SharedModel>>();
const assetSamplers = new WeakMap<AssetContainer, (milliseconds: number) => void>();
const assetExtras = new WeakMap<AssetContainer, Mv3ModelExtras>();

/** Drop the borrow callback after disposal, including on long-lived scenes. */
class SharedMv3Assets extends AssetContainer {
  constructor(scene: Scene, private releaseModel?: () => void) {super(scene);}

  override dispose(): void {
    const release = this.releaseModel;
    if (!release) return;
    this.releaseModel = undefined;
    super.dispose();
    this.rootNodes.length = 0;
    assetSamplers.delete(this);
    assetExtras.delete(this);
    release();
  }
}

/** Mutable weights borrow the template's immutable target texture and arrays. */
class SharedMorphTargets extends MorphTargetManager {
  private readonly textureInfluences: Float32Array;
  private readonly textureIndices: Float32Array;
  private readonly textureLayers: Uint16Array | undefined;
  private readonly textureLayerIndices: Float32Array;
  private textureTargetCount = 0;

  constructor(private readonly source: MorphTargetManager, scene: Scene) {
    super(scene);
    this.textureInfluences = new Float32Array(Math.min(2, source.numTargets));
    this.textureIndices = new Float32Array(this.textureInfluences.length);
    this.textureLayers = mv3MorphTextureLayers(source);
    this.textureLayerIndices = this.textureLayers ? new Float32Array(this.textureIndices.length) : this.textureIndices;
    this.areUpdatesFrozen = true;
    this.enablePositionMorphing = source.enablePositionMorphing;
    this.enableNormalMorphing = source.enableNormalMorphing;
    this.enableTangentMorphing = source.enableTangentMorphing;
    this.enableUVMorphing = source.enableUVMorphing;
    this.enableUV2Morphing = source.enableUV2Morphing;
    this.enableColorMorphing = source.enableColorMorphing;
    this.useTextureToStoreTargets = source.useTextureToStoreTargets;
    if (!source.isUsingTextureForTargets) {
      for (let index = 0; index < source.numTargets; index++) this.addTarget(source.getTarget(index).clone());
    }
    this.areUpdatesFrozen = false;
  }

  override synchronize(): void {
    if (!this.source?.isUsingTextureForTargets) {super.synchronize(); return;}
    for (const field of ['_supportsPositions', '_supportsNormals', '_supportsTangents', '_supportsUVs',
      '_supportsUV2s', '_supportsColors', '_vertexCount', '_textureVertexStride', '_textureWidth', '_textureHeight']) {
      Reflect.set(this, field, Reflect.get(this.source, field));
    }
    this._targetStoreTexture = this.source._targetStoreTexture;
  }

  override dispose(): void {
    if (this.source.isUsingTextureForTargets) this._targetStoreTexture = null;
    super.dispose();
  }

  override get influences(): Float32Array {
    return this.source?.isUsingTextureForTargets ? this.textureInfluences : super.influences;
  }

  override get numInfluencers(): number {
    return this.source?.isUsingTextureForTargets ? this.textureTargetCount : super.numInfluencers;
  }

  override get numTargets(): number {
    return this.source?.isUsingTextureForTargets ? this.source.numTargets : super.numTargets;
  }

  override getTarget(index: number): MorphTarget {
    return this.source.isUsingTextureForTargets ? this.source.getTarget(index) : super.getTarget(index);
  }

  override getActiveTarget(index: number): MorphTarget {
    return this.source.isUsingTextureForTargets
      ? this.getTarget(this.textureIndices[index]) : super.getActiveTarget(index);
  }

  /** Converted MV3 weights are nonzero only at the two adjacent source poses. */
  setTextureWeights(frame: number, gradient: number): void {
    this.textureInfluences.fill(0);
    this.textureIndices.fill(0);
    let count = 0;
    if (frame > 0 && 1 - gradient !== 0) {
      this.textureIndices[count] = frame - 1;
      this.textureInfluences[count++] = 1 - gradient;
    }
    if (frame < this.numTargets && gradient !== 0) {
      this.textureIndices[count] = frame;
      this.textureInfluences[count++] = gradient;
    }
    this.textureTargetCount = count;
  }

  override _bind(effect: Effect): void {
    if (!this.source.isUsingTextureForTargets) {super._bind(effect); return;}
    effect.setFloat3('morphTargetTextureInfo', this.source._textureVertexStride,
      this.source._textureWidth, this.source._textureHeight);
    if (this.textureLayers) {
      this.textureLayerIndices.fill(0);
      for (let index = 0; index < this.textureTargetCount; index++) {
        this.textureLayerIndices[index] = this.textureLayers[this.textureIndices[index]];
      }
    }
    effect.setFloatArray('morphTargetTextureIndices', this.textureLayerIndices);
    effect.setTexture('morphTargets', this.source._targetStoreTexture);
    effect.setFloat('morphTargetCount', this.textureTargetCount);
  }
}

/** convert_mv3.py emits one-hot weights and one float32 time per source pose. */
async function readTimelines(data: IGLTFLoaderData, animations: readonly Mv3Animation[],
  fps: number): Promise<readonly Mv3Timeline[]> {
  const document = data.json as Mv3Document;
  const sharedFrames: Float64Array[] = [];
  return Promise.all(animations.flatMap(animation => animation.channels.map(async channel => {
    const sampler = animation.samplers[channel.sampler];
    if (channel.target.path !== 'weights' || (sampler.interpolation ?? 'LINEAR') !== 'LINEAR') {
      throw new Error('MV3 动画必须使用线性形变权重');
    }
    if (!data.bin) throw new Error('MV3 动画二进制数据缺失');
    const accessor = document.accessors[sampler.input];
    const view = document.bufferViews[accessor.bufferView];
    const bytes = await data.bin.readAsync((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), accessor.count * 4);
    const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Babylon's weight keys multiply float32 source seconds by targetFps.
    const frames = new Float64Array(accessor.count);
    for (let index = 0; index < frames.length; index++) frames[index] = source.getFloat32(index * 4, true) * fps;
    const shared = sharedFrames.find(values => values.length === frames.length
      && values.every((value, index) => value === frames[index]));
    if (!shared) sharedFrames.push(frames);
    return {node: channel.target.node, frames: shared ?? frames};
  })));
}

/** Load source poses without expanding their one-hot weights into Animation objects. */
async function loadTemplate(url: string, scene: Scene,
  options: LoadAssetContainerOptions, attachmentNames: readonly string[],
  materialTextureSources: readonly string[] | true): Promise<Mv3Template> {
  const gltf = options.pluginOptions?.gltf;
  const fps = gltf?.targetFps ?? 60;
  let data: readonly Mv3Timeline[] = [];
  let extras: Mv3ModelExtras | undefined;
  const materialSources = new Map<string, SourceMv3Material>();
  let failure: unknown;
  let preparation = Promise.resolve();
  const assets = await loadPreparedModel(url, scene, {
    ...options,
    pluginOptions: {...options.pluginOptions, gltf: {...gltf, onMeshLoaded: mesh => {
      gltf?.onMeshLoaded?.(mesh);
      if (mesh instanceof Mesh && mesh.morphTargetManager) prepareMv3MorphTargets(mesh.morphTargetManager, scene);
    }, onParsed: loaderData => {
      gltf?.onParsed?.(loaderData);
      const document = loaderData.json as Mv3Document;
      if (gltf?.skipMaterials) {
        for (const [meshIndex, mesh] of (document.meshes ?? []).entries()) {
          for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
            const source = primitive.material === undefined ? undefined
              : document.materials?.[primitive.material]?.extras?.originalMV3;
            if (source?.properties.length !== 17) throw new Error('MV3 图元缺少原材质参数');
            materialSources.set(`/meshes/${meshIndex}/primitives/${primitiveIndex}`, source);
          }
        }
      }
      for (const material of document.materials ?? []) {
        const source = material.extras?.originalMV3;
        if (source?.properties?.length !== 17 || !material.pbrMetallicRoughness) continue;
        if (materialTextureSources === true || materialTextureSources.includes(source.textures?.[0] ?? '')) {
          // The actor supplies this image; keep source parameters without loading a template copy.
          delete material.pbrMetallicRoughness.baseColorTexture;
        }
      }
      extras = compactMv3Extras(document.extras, attachmentNames);
      delete document.extras;
      omitStaticMorphTargets(document);
      const animations = document.animations ?? [];
      delete document.animations;
      const loading = Promise.all([readTimelines(loaderData, animations, fps),
        compactMv3GeometrySources(loaderData)]);
      preparation = loading.then(([value]) => {data = value;}, error => {
        failure = error;
      });
    }}},
  });
  try {
    await preparation;
    if (failure !== undefined) throw failure;
    for (const mesh of assets.meshes) {
      if (!(mesh instanceof Mesh)) continue;
      for (const pointer of mesh._internalMetadata?.gltf?.pointers ?? []) {
        const source = materialSources.get(pointer);
        if (source) {mesh._internalMetadata.originalMV3Material = source; break;}
      }
      mesh.onClonedObservable.add(clone => {clone._internalMetadata = mesh._internalMetadata;});
      const manager = mesh.morphTargetManager;
      if (manager) {
        compactMv3MorphTargets(manager, scene);
        manager.clone = () => new SharedMorphTargets(manager, scene);
      }
    }
    return {assets, timelines: data, extras};
  } catch (error) {
    assets.dispose();
    throw error;
  }
}

/** Instances borrow source descriptors or materials until their MV3 shaders are applied. */
export async function loadMv3Model(url: string, scene: Scene,
  options: LoadAssetContainerOptions = {}, attachmentNames: readonly string[] = [],
  replacementTextures?: BaseTexture | ReadonlyMap<string, BaseTexture>): Promise<AssetContainer> {
  const fps = options.pluginOptions?.gltf?.targetFps ?? 60;
  // Snapshot names so the template never retains a particular actor's texture owner.
  const textureSources = options.pluginOptions?.gltf?.skipMaterials || replacementTextures instanceof BaseTexture
    ? true : [...replacementTextures?.keys() ?? []];
  const key = `${new URL(battleArtworkUrl(url, scene), location.href).href}:${fps}:${attachmentNames.join(',')}`
    + `:${textureSources === true ? '*' : textureSources.join(',')}:${Boolean(options.pluginOptions?.gltf?.skipMaterials)}`;
  let cache = sceneModels.get(scene);
  if (!cache) {
    cache = new Map();
    sceneModels.set(scene, cache);
    scene.onDisposeObservable.addOnce(() => {cache!.clear(); sceneModels.delete(scene);});
  }
  let shared = cache.get(key);
  if (!shared) {
    shared = {references: 0, loading: loadTemplate(url, scene, options, attachmentNames, textureSources)};
    cache.set(key, shared);
  }
  const borrowed = shared;
  borrowed.references++;
  const release = (): void => {
    if (--borrowed.references === 0) {
      if (cache!.get(key) === borrowed) cache!.delete(key);
      void borrowed.loading.then(template => {
        template.assets.dispose();
        template.assets.rootNodes.length = 0;
        template.timelines = [];
        template.extras = undefined;
      }, () => {});
    }
  };
  let assets: AssetContainer | undefined;
  let ownsReference = true;
  try {
    const template = await borrowed.loading;
    if (scene.isDisposed) throw new Error('模型所属场景已关闭');
    const entries = template.assets.instantiateModelsToScene(name => name, false, {doNotInstantiate: true});
    // Babylon registers shared source materials during cloning; the template retains ownership.
    for (const material of template.assets.materials) scene.removeMaterial(material);
    assets = new SharedMv3Assets(scene, release);
    ownsReference = false;
    assets.rootNodes.push(...entries.rootNodes);
    for (const root of entries.rootNodes) {
      for (const node of [root, ...root.getDescendants()]) {
        if (node instanceof Mesh) {
          assets.meshes.push(node);
          if (node.morphTargetManager && !assets.morphTargetManagers.includes(node.morphTargetManager)) {
            assets.morphTargetManagers.push(node.morphTargetManager);
          }
          if (node.morphTargetManager && !node.morphTargetManager.isUsingTextureForTargets) {
            node.makeGeometryUnique();
            if (node.geometry) assets.geometries.push(node.geometry);
          }
        } else assets.transformNodes.push(node as AssetContainer['transformNodes'][number]);
      }
    }
    assets.removeAllFromScene();
    const samplers = template.timelines.map(timeline => {
      const pointer = `/nodes/${timeline.node}`;
      const mesh = assets!.meshes.find(mesh => mesh._internalMetadata?.gltf?.pointers?.includes(pointer));
      if (!(mesh instanceof Mesh) || !mesh.morphTargetManager) throw new Error(`MV3 节点 ${timeline.node} 的形变网格缺失`);
      return new Mv3AnimationSampler(mesh.morphTargetManager, timeline.frames, fps);
    });
    assetSamplers.set(assets, milliseconds => {
      for (const sampler of samplers) sampler.sample(milliseconds);
    });
    if (template.extras) assetExtras.set(assets, template.extras);
    return assets;
  } catch (error) {
    assets?.dispose();
    if (ownsReference) release();
    throw error;
  }
}

export function mv3ModelExtras(assets: AssetContainer): Mv3ModelExtras | undefined {
  return assetExtras.get(assets);
}

/** Only the adjacent source poses can influence a converted MV3 mesh. */
class Mv3AnimationSampler {
  private previous = -1;
  private readonly fixedInfluencers: boolean;

  constructor(private readonly manager: MorphTargetManager, private readonly frames: Float64Array,
    private readonly fps: number) {
    if (frames.length !== manager.numTargets + 1) throw new Error('MV3 帧数与形变目标数不符');
    this.fixedInfluencers = manager.isUsingTextureForTargets;
    if (this.fixedInfluencers) {
      manager.optimizeInfluencers = true;
      manager.numMaxInfluencers = Math.min(2, manager.numTargets);
    }
  }

  sample(milliseconds: number): void {
    const frame = Math.max(this.frames[0], Math.min(this.frames[this.frames.length - 1],
      milliseconds / 1000 * this.fps));
    let low = 0, high = this.frames.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.frames[middle] <= frame) low = middle;
      else high = middle - 1;
    }
    const gradient = low + 1 < this.frames.length
      ? (frame - this.frames[low]) / (this.frames[low + 1] - this.frames[low]) : 0;
    if (this.fixedInfluencers && this.manager instanceof SharedMorphTargets) {
      this.manager.setTextureWeights(low, gradient);
      this.previous = low;
      return;
    }
    for (let index = this.previous - 1; index <= this.previous; index++) {
      if (index >= 0 && index < this.manager.numTargets && index !== low - 1 && index !== low) {
        this.manager.getTarget(index).influence = 0;
      }
    }
    if (low > 0) this.manager.getTarget(low - 1).influence = 1 - gradient;
    if (low < this.manager.numTargets) this.manager.getTarget(low).influence = gradient;
    this.previous = low;
    // Texture shaders retain the same attributes when weights cross zero.
    if (this.fixedInfluencers) Reflect.set(this.manager, '_needUpdateInfluences', false);
  }
}

/** The loaded container owns mutable weights; its scene shares immutable timelines. */
export function createMv3AnimationSampler(assets: AssetContainer): (milliseconds: number) => void {
  const sampler = assetSamplers.get(assets);
  if (!sampler) throw new Error('MV3 模型未准备紧凑动画时间轴');
  return sampler;
}
