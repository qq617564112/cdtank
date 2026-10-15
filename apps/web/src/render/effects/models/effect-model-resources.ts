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
  nodes: (Omit<EffectModelResource['nodes'][number], 'vertexData' | 'animation'> & {
    animation?: AnimationDocument;
    vertexData?: {offset: number; vertexCount: number; frameCount: number; colorOffset?: number};
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
          const buffer = await loadStaticBinary(document.binary);
          return {...document, nodes: document.nodes.map(node => {
            const data = node.vertexData;
            return {...node, animation: node.animation ? loadAnimation(node.animation, buffer) : undefined,
              vertexData: data ? {
                vertexCount: data.vertexCount, frameCount: data.frameCount,
                values: new Float32Array(buffer, data.offset, data.vertexCount * data.frameCount * 5),
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
