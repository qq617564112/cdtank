import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CollisionMesh, type SerializedCollisionMesh} from '../apps/shared/movement/collision-mesh';
import {NavigationGrid, type SourceNavigationLayer} from '../apps/shared/movement/navigation';
import {navigationOccupancy} from '../apps/shared/movement/navigation-collision';
import {castleResourceFile} from '../apps/shared/maps/castle-resources';
import {plantSwayDisplacement, plantSwayParameter} from '../apps/shared/movement/scene-animation-clock';
import {loadCvdTriangles, loadGlbTriangles, placedCollisionMesh, sampleGlbTriangles} from '../apps/server/src/render-collision-assets';
import {serverAssetPath, webAssetPath} from '../apps/server/src/runtime/content-paths';

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

interface SourceScene {
  id: string;
  terrain: string;
  records: SourcePlacement[];
  castles: SourcePlacement[];
}

interface SourceField {
  id: string;
  navigationLayers: SourceNavigationLayer[];
}

interface CastleResource {
  model: string;
  actions: {name: string; asset: string; available: boolean}[];
}

const workspace = fileURLToPath(new URL('../', import.meta.url));
const serverAssets = resolve(process.env.SERVER_ASSETS ?? resolve(workspace, 'apps/server/resources/assets'));
const output = resolve(process.env.SCENE_COLLISION_ASSETS ??
  resolve(serverAssets, 'scene-collision'));
mkdirSync(serverAssets, {recursive: true});
const sourceExport = existsSync(webAssetPath('scene-placements.json'));
const placementsFile = sourceExport ? 'scene-placements.json' : 'data/maps/shared/placements.json';
const battlefieldsFile = sourceExport ? 'battlefields.json' : 'data/maps/battlefields.json';
for (const [source, filename] of [
  [placementsFile, 'scene-placements.json'],
  [battlefieldsFile, 'battlefields.json'],
]) {
  copyFileSync(webAssetPath(source), serverAssetPath(filename));
}
const scenes = JSON.parse(readFileSync(webAssetPath(placementsFile), 'utf8')) as SourceScene[];
const fields = new Map((JSON.parse(readFileSync(webAssetPath(battlefieldsFile), 'utf8')) as SourceField[])
  .map(field => [Number(field.id), field] as const));

function castleResources(scene: SourceScene): CastleResource[] {
  const published = castleResourceFile(Number(scene.id));
  const filename = sourceExport ? `scene-castle-${published.split('/')[2]}.json` : published;
  return JSON.parse(readFileSync(webAssetPath(filename), 'utf8')).castles;
}

function collisionFor(scene: SourceScene, source: SourcePlacement, resources: CastleResource[],
  navigation: NavigationGrid): {
    id: string; model: string; matrix: number[]; dimensions: number[]; placementId: string;
    mesh: SerializedCollisionMesh; navigationCells: number[];
  } {
  let asset = source.asset;
  if (source.className === 'SYcCastle') {
    const resource = resources.find(value => value.model === source.model);
    const action = resource?.actions.find(value => value.name === 'n1' && value.available);
    if (!resource || !action) throw new Error(`缺少城堡初始渲染模型：${scene.id}/${source.id}`);
    asset = action.asset;
  }
  if (source.matrix.length !== 16 || source.position.length !== 3
      || ![...source.matrix, ...source.position].every(Number.isFinite)) {
    throw new Error(`场景物件放置变换无效：${scene.id}/${source.id}`);
  }
  const triangles = source.animation
    ? loadCvdTriangles(source.animation.library, source.animation.reference)
    : asset ? sampleGlbTriangles(asset, 0) : undefined;
  if (!triangles) throw new Error(`缺少场景渲染模型：${scene.id}/${source.id}`);
  const mesh = placedCollisionMesh(triangles, source.matrix, source.position);
  if (!mesh.triangles.length) throw new Error(`场景碰撞模型为空：${scene.id}/${source.id}`);
  return {id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    placementId: source.id, mesh: mesh.serialize(),
    navigationCells: [...navigationOccupancy(mesh, navigation)]};
}

function plantCollision(source: SourcePlacement): {
  id: string; model: string; matrix: number[]; dimensions: number[]; enabled: boolean;
  contactObb: {matrix: number[]; dimensions: number[]};
} {
  const vertices = sampleGlbTriangles(source.asset!, 0).flatMap(triangle => triangle);
  if (!vertices.length) throw new Error(`场景植物碰撞模型为空：${source.id}`);
  const minY = Math.min(...vertices.map(vertex => vertex[1]));
  const maxY = Math.max(...vertices.map(vertex => vertex[1]));
  const parameter = plantSwayParameter(source.id, maxY - minY, 0);
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const vertex of vertices) {
    const point = [Math.fround(vertex[0] + plantSwayDisplacement(parameter, vertex[1])), vertex[1], vertex[2]];
    point.forEach((value, axis) => {
      minimum[axis] = Math.min(minimum[axis], value);
      maximum[axis] = Math.max(maximum[axis], value);
    });
  }
  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
  const matrix = [...source.matrix];
  for (let axis = 0; axis < 3; axis++) {
    matrix[12 + axis] = source.position[axis] + matrix[axis] * center[0]
      + matrix[4 + axis] * center[1] + matrix[8 + axis] * center[2];
  }
  return {id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    enabled: source.enabled === 1,
    contactObb: {matrix, dimensions: [maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]]}};
}

rmSync(output, {recursive: true, force: true});
mkdirSync(output, {recursive: true});
for (const scene of scenes) {
  const field = fields.get(Number(scene.id));
  if (!field) throw new Error(`缺少地图导航数据：${scene.id}`);
  const navigation = new NavigationGrid(field.navigationLayers[0]);
  const resources = castleResources(scene);
  const colliders: Record<string, ReturnType<typeof collisionFor>> = {};
  for (const source of [...scene.records, ...scene.castles]) {
    if (['SYcScnObjBreach', 'SYcScnObjGeneral', 'SYcScnObjCrush', 'SYcCastle'].includes(source.className)
        && (source.className === 'SYcCastle' || source.asset || source.animation)) {
      colliders[source.id] = collisionFor(scene, source, resources, navigation);
    }
  }
  const terrain = new CollisionMesh(loadGlbTriangles(scene.terrain));
  if (!terrain.triangles.length) throw new Error(`地图地形碰撞为空：${scene.id}`);
  const asset = {
    version: 1,
    id: scene.id,
    terrain: terrain.serialize(),
    terrainNavigationCells: [...navigationOccupancy(terrain, navigation, true)],
    colliders,
    solids: [...scene.records, ...scene.castles].filter(source =>
      ['SYcScnObjBreach', 'SYcScnObjGeneral', 'SYcScnObjCrush', 'SYcCastle'].includes(source.className)
      && (source.className === 'SYcCastle' || source.asset || source.animation)
      && (source.className !== 'SYcScnObjCrush' || source.enabled === 1)).map(source => source.id),
    breakables: scene.records.filter(source => source.className === 'SYcScnObjBreach').map(source => source.id),
    castles: scene.castles.map(source => {
      const tail = Buffer.from(source.tail!, 'hex');
      return {id: source.id, hp: tail.readUInt32LE(4), affiliation: tail.readUInt32LE(8)};
    }),
    crushes: scene.records.filter(source => source.className === 'SYcScnObjCrush')
      .map(source => ({id: source.id, enabled: source.enabled === 1})),
    plants: scene.records.filter(source => source.className === 'SYcScnObjPlant').map(plantCollision),
  };
  const missing = [...new Set([...asset.solids, ...asset.breakables, ...asset.castles.map(value => value.id)])
    .values()].filter(id => !colliders[id]);
  if (missing.length) throw new Error(`场景碰撞资产缺少网格：${scene.id}/${missing.join(',')}`);
  writeFileSync(resolve(output, `${scene.id}.json`), `${JSON.stringify(asset)}\n`);
}
console.log(`Scene collision assets published: ${output}`);
