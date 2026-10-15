import {readSimulationAsset} from './runtime/simulation-host';
import {CollisionMesh, type SerializedCollisionMesh} from './collision-mesh';
import type {RoleObb} from '../../shared/movement/obb-intersection';

export interface SceneBreakable {
  id: string;
  model: string;
  matrix: number[];
  dimensions: number[];
  mesh?: CollisionMesh;
  placementId?: string;
}

interface SerializedSceneCollider {
  id: string;
  model: string;
  matrix: number[];
  dimensions: number[];
  placementId: string;
  mesh: SerializedCollisionMesh;
  navigationCells: number[];
}

interface SerializedPlant extends Omit<SceneBreakable, 'mesh'> {
  enabled: boolean;
  contactObb: RoleObb;
}

interface SceneCollisionAsset {
  version: 1;
  id: string;
  terrain: SerializedCollisionMesh;
  terrainNavigationCells: number[];
  colliders: Record<string, SerializedSceneCollider>;
  solids: string[];
  breakables: string[];
  castles: {id: string; hp: number; affiliation: number}[];
  crushes: {id: string; enabled: boolean}[];
  plants: SerializedPlant[];
}

interface SceneCollider extends SceneBreakable {
  mesh: CollisionMesh;
  placementId: string;
  navigationCells: readonly number[];
}

export interface ScenePlant extends SceneBreakable {
  enabled: boolean;
  contactObb: RoleObb;
}

const assets = new Map<number, SceneCollisionAsset>();
const colliders = new Map<number, Map<string, SceneCollider>>();
const terrains = new Map<number, CollisionMesh>();
const terrainNavigation = new Map<number, readonly number[]>();
const solids = new Map<number, readonly SceneCollider[]>();
const breakables = new Map<number, readonly SceneCollider[]>();
const castles = new Map<number, readonly (SceneBreakable & {hp: number; affiliation: number})[]>();
const crushes = new Map<number, readonly (SceneBreakable & {enabled: boolean})[]>();
const plants = new Map<number, readonly ScenePlant[]>();

function collisionAt(mapId: number): SceneCollisionAsset {
  const cached = assets.get(mapId);
  if (cached) return cached;
  const id = String(mapId).padStart(4, '0');
  const asset = readSimulationAsset<SceneCollisionAsset>(`scene-collision/${id}.json`);
  if (asset.version !== 1 || Number(asset.id) !== mapId) {
    throw new Error(`场景碰撞资产无效：${mapId}`);
  }
  assets.set(mapId, asset);
  return asset;
}

function colliderMap(mapId: number): Map<string, SceneCollider> {
  const cached = colliders.get(mapId);
  if (cached) return cached;
  const values = new Map<string, SceneCollider>();
  for (const source of Object.values(collisionAt(mapId).colliders)) {
    values.set(source.id, {...source, mesh: new CollisionMesh(source.mesh),
      navigationCells: source.navigationCells});
  }
  colliders.set(mapId, values);
  return values;
}

function collider(mapId: number, id: string): SceneCollider {
  const value = colliderMap(mapId).get(id);
  if (!value) throw new Error(`缺少场景碰撞模型：${mapId}/${id}`);
  return value;
}

export function getSceneTerrain(mapId: number): CollisionMesh {
  let mesh = terrains.get(mapId);
  if (!mesh) {
    mesh = new CollisionMesh(collisionAt(mapId).terrain);
    terrains.set(mapId, mesh);
  }
  return mesh;
}

export function getSceneTerrainNavigationCells(mapId: number): readonly number[] {
  let cells = terrainNavigation.get(mapId);
  if (!cells) {
    cells = collisionAt(mapId).terrainNavigationCells;
    terrainNavigation.set(mapId, cells);
  }
  return cells;
}

/** Solid rendered instances. Plants retain their existing pass-through contact policy. */
export function getSceneSolids(mapId: number): readonly SceneCollider[] {
  let values = solids.get(mapId);
  if (!values) {
    values = collisionAt(mapId).solids.map(id => ({...collider(mapId, id), id: `SCN:${id}`}));
    solids.set(mapId, values);
  }
  return values;
}

/** Intact render mesh and source instance identity. */
export function getSceneBreakables(mapId: number): readonly SceneCollider[] {
  let values = breakables.get(mapId);
  if (!values) {
    values = collisionAt(mapId).breakables.map(id => collider(mapId, id));
    breakables.set(mapId, values);
  }
  return values;
}

/** Original CAS placement, initial HP and source affiliation; attack permission is battle policy. */
export function getSceneCastles(mapId: number): readonly (SceneBreakable & {hp: number; affiliation: number})[] {
  let values = castles.get(mapId);
  if (!values) {
    values = collisionAt(mapId).castles.map(source => ({...collider(mapId, source.id),
      hp: source.hp, affiliation: source.affiliation}));
    castles.set(mapId, values);
  }
  return values;
}

/** Original Crush identity, enabled bit and static first-frame render mesh. */
export function getSceneCrushes(mapId: number): readonly (SceneBreakable & {enabled: boolean})[] {
  let values = crushes.get(mapId);
  if (!values) {
    values = collisionAt(mapId).crushes.map(source => ({...collider(mapId, source.id), enabled: source.enabled}));
    crushes.set(mapId, values);
  }
  return values;
}

/** Original Plant order and build-time first-frame OBB. */
export function getScenePlants(mapId: number): readonly ScenePlant[] {
  let values = plants.get(mapId);
  if (!values) {
    values = collisionAt(mapId).plants.map(source => ({...source, contactObb: source.contactObb}));
    plants.set(mapId, values);
  }
  return values;
}
