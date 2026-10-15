import type {Scene} from '@babylonjs/core';
import {loadStaticBinary, loadStaticJson} from '../../../assets/static-resources';
import type {EffectModelLibrary, EffectModelResource} from './effect-model-renderer';
import type {EffectModelAnimationNode} from './effect-model-animation';
import type {PackedAnimationTrack} from '../../../../../shared/movement/animation-sampling';

interface LibraryIndex extends Omit<EffectModelLibrary, 'resources'> {
  resources: {reference: string; asset: string}[];
}
interface TrackDocument {
  mode: number;
  offset: number;
  keyCount: number;
  stride: number;
}
interface AnimationDocument {
  value: number;
  position: TrackDocument;
  rotation: TrackDocument;
  scale: TrackDocument;
}
interface ResourceDocument extends Omit<EffectModelResource, 'nodes'> {
  binary: string;
  geometryLayout: 1;
  nodes: (Omit<EffectModelResource['nodes'][number], 'vertexData' | 'animation'> & {
    animation?: AnimationDocument;
    vertexData?: {
      vertexCount: number; frameCount: number; positionOffset: number; uvOffset: number;
      minimum: number[]; maximum: number[]; colorOffset?: number;
      frames?: {width: number; height: number; pixelOffset: number; vOffset: number;
        idOffset: number; indexOffset: number};
    };
  })[];
}
interface ModelLibraryResources {
  index: Promise<LibraryIndex>;
  models: Map<string, Promise<EffectModelResource>>;
}
const resourcesByScene = new WeakMap<Scene, Map<string, ModelLibraryResources>>();

function loadTrack(document: TrackDocument, buffer: ArrayBuffer): PackedAnimationTrack {
  return {mode: document.mode, stride: document.stride,
    values: new Float32Array(buffer, document.offset, document.keyCount * document.stride)};
}

function loadAnimation(document: AnimationDocument, buffer: ArrayBuffer): EffectModelAnimationNode {
  return {value: document.value, position: loadTrack(document.position, buffer),
    rotation: loadTrack(document.rotation, buffer), scale: loadTrack(document.scale, buffer)};
}

/** Only selected models read contiguous vertices and mode-3 transform tracks. */
export async function loadEffectModelLibrary(path: string, scene: Scene,
  references?: ReadonlySet<string>): Promise<EffectModelLibrary> {
  let libraries = resourcesByScene.get(scene);
  if (!libraries) {
    libraries = new Map();
    resourcesByScene.set(scene, libraries);
    scene.onDisposeObservable.addOnce(() => resourcesByScene.delete(scene));
  }
  const indexPath = path.replace(/\.json$/, '.models.json');
  let cache = libraries.get(indexPath);
  if (!cache) {
    const index = loadStaticJson<LibraryIndex>(indexPath, false).catch(error => {
      if (libraries!.get(indexPath) === cache) libraries!.delete(indexPath);
      throw error;
    });
    cache = {index, models: new Map()};
    libraries.set(indexPath, cache);
  }
  const index = await cache.index;
  const models = cache.models;
  const resources = await Promise.all(index.resources.filter(row => !references || references.has(row.reference))
    .map(row => {
      let loading = models.get(row.asset);
      if (!loading) {
        loading = loadStaticJson<ResourceDocument>(row.asset, false).then(async document => {
          if (document.geometryLayout !== 1) throw new Error('CVD 模型缺少预计算几何数据');
          const buffer = await loadStaticBinary(document.binary);
          return {...document, nodes: document.nodes.map(node => {
            const data = node.vertexData;
            return {...node, animation: node.animation ? loadAnimation(node.animation, buffer) : undefined,
              vertexData: data ? {
                vertexCount: data.vertexCount, frameCount: data.frameCount,
                positions: new Float32Array(buffer, data.positionOffset, data.vertexCount * 3),
                uvs: new Float32Array(buffer, data.uvOffset, data.vertexCount * 2),
                minimum: data.minimum, maximum: data.maximum,
                frames: data.frames ? {
                  width: data.frames.width, height: data.frames.height,
                  pixels: new Float32Array(buffer, data.frames.pixelOffset, data.frames.width * data.frames.height * 4),
                  vs: new Float32Array(buffer, data.frames.vOffset, data.frames.width * data.frames.height),
                  vertexIds: new Float32Array(buffer, data.frames.idOffset, data.vertexCount),
                  indices: new Uint32Array(buffer, data.frames.indexOffset, data.frameCount),
                } : undefined,
                colors: data.colorOffset === undefined ? undefined
                  : new Float32Array(buffer, data.colorOffset, data.vertexCount * 4),
                times: node.times,
              } : undefined};
          })};
        }).catch(error => {if (models.get(row.asset) === loading) models.delete(row.asset); throw error;});
        models.set(row.asset, loading);
      }
      return loading;
    }));
  return {...index, resources};
}

export function releaseModelLibraries(scene: Scene, prefix: string): void {
  const libraries = resourcesByScene.get(scene);
  if (!libraries) return;
  // Pending loads retain only their detached library, never the next map's cache.
  for (const path of libraries.keys()) if (path.startsWith(prefix)) libraries.delete(path);
}
