import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webAssetPath} from './runtime/content-paths';
import {CollisionMesh} from './collision-mesh';
import {loadGlbTriangles, loadCvdTriangles, placedCollisionMesh, sampleCvdTriangles,
  sampleGlbTriangles, hasGlbAnimation} from './render-collision-assets';
import {castleResourceFile} from '../../shared/maps/castle-resources';
import {castleAnimationTime, plantSwayParameter, plantSwayDisplacement} from '../../shared/movement/scene-animation-clock';
import type {RoleObb} from '../../shared/movement/obb-intersection';

export interface SceneBreakable {
  id: string;
  model: string;
  matrix: number[];
  dimensions: number[];
  mesh?: CollisionMesh;
  placementId?: string;
}

export interface AnimatedSceneCollider extends SceneBreakable {
  position: number[];
  animation: {
    kind: 'CVD' | 'GLB';
    asset: string;
    reference?: string;
    duration: number;
    initialTime: number;
    actions?: Partial<Record<'c2' | 'c3' | 'n1' | 'n2', {asset: string; duration: number}>>;
  };
}

interface SourcePlacement {
  id: string;
  model: string;
  className: string;
  matrix: number[];
  bounds: number[];
  position: number[];
  asset?: string;
  animation?: {library: string; reference: string};
  tail?: string;
  enabled?: number;
}

interface SourceScene {id: string; terrain: string; records: SourcePlacement[]; castles: SourcePlacement[];}
interface SceneCollider extends SceneBreakable {mesh: CollisionMesh; placementId: string;}
interface CastleResource {
  sourcePlacementId: string; model: string; matrix: number[]; position: number[];
  actions: {name: string; asset: string; available: boolean; durationMs: number}[];
}

const scenes = JSON.parse(readFileSync(resolve(
  process.env.SCENE_PLACEMENTS ?? webAssetPath('scene-placements.json')), 'utf8')) as
  SourceScene[];
const colliders = new Map<string, SceneCollider>();
const breakables = new Map<number, readonly SceneCollider[]>();
const terrains = new Map<number, CollisionMesh>();
const castleResources = new Map<number, CastleResource[]>();
const animated = new Map<string, AnimatedSceneCollider>();
const animatedScenes = new Map<number, readonly AnimatedSceneCollider[]>();

function castleResourcesFor(scene: SourceScene): CastleResource[] {
  let resources = castleResources.get(Number(scene.id));
  if (!resources) {
    resources = (JSON.parse(readFileSync(webAssetPath(castleResourceFile(Number(scene.id))), 'utf8')) as
      {castles: CastleResource[]}).castles;
    castleResources.set(Number(scene.id), resources);
  }
  return resources;
}

function sceneAt(mapId: number): SourceScene {
  const scene = scenes.find(scene => Number(scene.id) === mapId);
  if (!scene) throw new Error(`缺少地图${mapId}的原场景记录`);
  return scene;
}

function collider(scene: SourceScene, source: SourcePlacement): SceneCollider {
  const key = `${scene.id}:${source.id}`;
  const cached = colliders.get(key);
  if (cached) return cached;
  let asset = source.asset, matrix = source.matrix, position = source.position;
  if (source.className === 'SYcCastle') {
    const resource = castleResourcesFor(scene).find(value => value.model === source.model);
    const action = resource?.actions.find(value => value.name === 'n1' && value.available);
    if (!resource || !action) throw new Error(`缺少城堡初始渲染模型：${scene.id}/${source.id}`);
    asset = action.asset;
  }
  if (matrix.length !== 16 || position.length !== 3 || ![...matrix, ...position].every(Number.isFinite)) {
    throw new Error(`场景物件放置变换无效：${scene.id}/${source.id}`);
  }
  const triangles = source.animation ? loadCvdTriangles(source.animation.library, source.animation.reference)
    : asset ? loadGlbTriangles(asset) : undefined;
  if (!triangles) throw new Error(`缺少场景渲染模型：${scene.id}/${source.id}`);
  const value = {id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    placementId: source.id, mesh: placedCollisionMesh(triangles, matrix, position)};
  colliders.set(key, value);
  return value;
}

function animatedCollider(scene: SourceScene, source: SourcePlacement): AnimatedSceneCollider {
  const key = `${scene.id}:${source.id}`;
  const cached = animated.get(key);
  if (cached) return cached;
  let asset = source.asset, matrix = source.matrix, position = source.position;
  let reference: string | undefined;
  let actions: AnimatedSceneCollider['animation']['actions'];
  if (source.className === 'SYcCastle') {
    let resources = castleResources.get(Number(scene.id));
    if (!resources) {
      resources = (JSON.parse(readFileSync(webAssetPath(castleResourceFile(Number(scene.id))), 'utf8')) as
        {castles: CastleResource[]}).castles;
      castleResources.set(Number(scene.id), resources);
    }
    const resource = resources.find(value => value.model === source.model);
    const action = resource?.actions.find(value => value.name === 'n1' && value.available);
    if (!resource || !action) throw new Error(`缺少城堡初始渲染模型：${scene.id}/${source.id}`);
    asset = action.asset;
    actions = {};
    for (const value of resource.actions) {
      if (['c2', 'c3', 'n1', 'n2'].includes(value.name) && value.available) {
        actions[value.name as keyof NonNullable<typeof actions>] =
          {asset: value.asset, duration: value.durationMs};
      }
    }
  }
  if (source.animation) {
    reference = source.animation.reference;
  }
  if (!asset && !source.animation) throw new Error(`缺少场景渲染模型：${scene.id}/${source.id}`);
  const initialTime = 0;
  const triangles = source.animation
    ? sampleCvdTriangles(source.animation.library, source.animation.reference, initialTime)
    : sampleGlbTriangles(asset!, initialTime);
  const duration = source.animation ? cvdDuration(source.animation.library, source.animation.reference) : 0;
  const value = {id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    placementId: source.id, mesh: placedCollisionMesh(triangles, matrix, position),
    position: [...position],
    animation: {kind: source.animation ? 'CVD' as const : 'GLB' as const, asset: source.animation?.library ?? asset!,
      reference, duration, initialTime, actions}};
  animated.set(key, value);
  return value;
}

/** Current collision geometry for one animated placement at round-relative seconds.
 * Castle actions use their converted GLB's seconds; CVD uses its own published clock.
 */
export function sampleAnimatedSceneCollider(collider: AnimatedSceneCollider, timeSeconds: number,
  action: 'c2' | 'c3' | 'n1' | 'n2' = 'n1', stopAtEnd = false): CollisionMesh {
  const {animation} = collider;
  const triangles = animation.kind === 'CVD'
    ? sampleCvdTriangles(animation.asset, animation.reference!, timeSeconds)
    : sampleGlbTriangles(animation.actions?.[action]?.asset ?? animation.asset,
      animation.actions ? castleAnimationTime(timeSeconds, animation.actions[action]!.duration, stopAtEnd) : timeSeconds,
      !animation.actions);
  return placedCollisionMesh(triangles, collider.matrix, collider.position);
}

function cvdDuration(asset: string, reference: string): number {
  return Math.max(0, ...readCvdResource(asset, reference).nodes.map(node => node.duration ?? 0));
}

function readCvdResource(asset: string, reference: string): {nodes: {duration?: number}[]} {
  const library = JSON.parse(readFileSync(webAssetPath(asset), 'utf8')) as
    {resources: {reference: string; resolution: string; nodes: {duration?: number}[]}[]};
  const resource = library.resources.find(value => value.reference === reference);
  if (!resource || resource.resolution !== 'published') throw new Error(`缺少场景渲染几何：${reference}`);
  return resource;
}

export function getSceneTerrain(mapId: number): CollisionMesh {
  let mesh = terrains.get(mapId);
  if (!mesh) {
    mesh = new CollisionMesh(loadGlbTriangles(sceneAt(mapId).terrain));
    terrains.set(mapId, mesh);
  }
  return mesh;
}

/** Solid rendered instances. Plants retain their existing pass-through contact policy. */
export function getSceneSolids(mapId: number): readonly SceneCollider[] {
  const scene = sceneAt(mapId);
  return [...scene.records, ...scene.castles].filter(source =>
    ['SYcScnObjBreach', 'SYcScnObjGeneral', 'SYcScnObjCrush', 'SYcCastle'].includes(source.className)
    && (source.asset || source.animation) && (source.className !== 'SYcScnObjCrush' || source.enabled === 1))
    .map(source => ({...collider(scene, source), id: `SCN:${source.id}`}));
}

/** Intact render mesh and source instance identity. */
export function getSceneBreakables(mapId: number): readonly SceneBreakable[] {
  const cached = breakables.get(mapId);
  if (cached) return cached;
  const scene = sceneAt(mapId);
  const entries = scene.records.filter(source => source.className === 'SYcScnObjBreach').map(source => collider(scene, source));
  breakables.set(mapId, entries);
  return entries;
}

/** Original CAS placement, initial HP and source affiliation; attack permission is battle policy. */
export function getSceneCastles(mapId: number): readonly (SceneBreakable & {hp: number; affiliation: number})[] {
  const scene = sceneAt(mapId);
  return scene.castles.map(source => ({...collider(scene, source),
    hp: Buffer.from(source.tail!, 'hex').readUInt32LE(4),
    affiliation: Buffer.from(source.tail!, 'hex').readUInt32LE(8)}));
}

/** Animated scene geometry that changes collision/NAV outside the static instance cache. */
export function getAnimatedSceneColliders(mapId: number): readonly AnimatedSceneCollider[] {
  const cached = animatedScenes.get(mapId);
  if (cached) return cached;
  const scene = sceneAt(mapId);
  const sources = [...scene.records, ...scene.castles].filter(source =>
    ['SYcScnObjBreach', 'SYcScnObjGeneral', 'SYcScnObjCrush', 'SYcCastle'].includes(source.className)
    && (source.animation || source.className === 'SYcCastle' || (source.asset && hasGlbAnimation(source.asset))))
    .map(source => animatedCollider(scene, source));
  animatedScenes.set(mapId, sources);
  return sources;
}

/** Original Crush identity, enabled bit and render mesh, separate from its effect parent. */
export function getSceneCrushes(mapId: number): readonly (SceneBreakable & {enabled: boolean})[] {
  const scene = sceneAt(mapId);
  return scene.records.filter(source => source.className === 'SYcScnObjCrush').map(source => ({
    ...collider(scene, source),
    enabled: source.enabled === 1,
  }));
}

/** Original Plant order and OBB; enabled participation is a rebuilt room policy. */
export function getScenePlants(mapId: number): readonly (SceneBreakable & {enabled: boolean})[] {
  const scene = scenes.find(scene => Number(scene.id) === mapId);
  if (!scene) throw new Error(`缺少地图${mapId}的原场景记录`);
  return scene.records.filter(source => source.className === 'SYcScnObjPlant').map(source => ({
    id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    enabled: source.enabled === 1,
  }));
}

interface PlantGeometry {source: SourcePlacement; vertices: readonly (readonly number[])[]; height: number;}
const plantGeometry = new Map<string, PlantGeometry>();

/** Deformed local bounds retain the source placement axes; Plant never creates a NAV blocker. */
export function getScenePlantContactObb(mapId: number, placementId: string, seconds: number): RoleObb {
  const key = `${mapId}:${placementId}`;
  let geometry = plantGeometry.get(key);
  if (!geometry) {
    const source = sceneAt(mapId).records.find(value => value.id === placementId)!;
    const vertices = loadGlbTriangles(source.asset!).flatMap(triangle => [...triangle]);
    const minY = Math.min(...vertices.map(vertex => vertex[1]));
    const maxY = Math.max(...vertices.map(vertex => vertex[1]));
    geometry = {source, vertices, height: maxY - minY};
    plantGeometry.set(key, geometry);
  }
  const parameter = plantSwayParameter(placementId, geometry.height, seconds);
  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  for (const vertex of geometry.vertices) {
    const point = [Math.fround(vertex[0] + plantSwayDisplacement(parameter, vertex[1])), vertex[1], vertex[2]];
    point.forEach((value, axis) => {
      minimum[axis] = Math.min(minimum[axis], value);
      maximum[axis] = Math.max(maximum[axis], value);
    });
  }
  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
  const matrix = [...geometry.source.matrix];
  for (let axis = 0; axis < 3; axis++) {
    matrix[12 + axis] = geometry.source.position[axis] + matrix[axis] * center[0]
      + matrix[4 + axis] * center[1] + matrix[8 + axis] * center[2];
  }
  return {matrix, dimensions: [maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]]};
}
