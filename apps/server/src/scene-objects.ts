import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webAssetPath} from './runtime/content-paths';
import {CollisionMesh} from './collision-mesh';
import {loadGlbTriangles, loadCvdTriangles, placedCollisionMesh} from './render-collision-assets';

export interface SceneBreakable {
  id: string;
  model: string;
  matrix: number[];
  dimensions: number[];
  mesh?: CollisionMesh;
  placementId?: string;
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
  sourcePlacementId: string; matrix: number[]; position: number[];
  actions: {name: string; asset: string; available: boolean}[];
}

const scenes = JSON.parse(readFileSync(resolve(
  process.env.SCENE_PLACEMENTS ?? webAssetPath('scene-placements.json')), 'utf8')) as
  SourceScene[];
const colliders = new Map<string, SceneCollider>();
const breakables = new Map<number, readonly SceneCollider[]>();
const terrains = new Map<number, CollisionMesh>();
const castleResources = new Map<number, CastleResource[]>();

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
  if (source.className === 'SYcCastle' && [2, 5, 6, 10, 11].includes(Number(scene.id))) {
    let resources = castleResources.get(Number(scene.id));
    if (!resources) {
      resources = (JSON.parse(readFileSync(webAssetPath(`scene-castle-${scene.id}.json`), 'utf8')) as
        {castles: CastleResource[]}).castles;
      castleResources.set(Number(scene.id), resources);
    }
    const resource = resources.find(value => value.sourcePlacementId === source.id);
    const action = resource?.actions.find(value => value.name === 'n1' && value.available);
    if (!resource || !action) throw new Error(`缺少城堡初始渲染模型：${scene.id}/${source.id}`);
    asset = action.asset; matrix = resource.matrix; position = resource.position;
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
