import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {getSceneCrushes, getSceneSolids, getSceneTerrain} from '../apps/server/src/scene-objects';
import {webAssetPath} from '../apps/server/src/runtime/content-paths';
import {NavigationGrid, type SourceNavigationLayer} from '../apps/shared/movement/navigation';
import {navigationOccupancy} from '../apps/shared/movement/navigation-collision';
import type {SourceMovementField, SourceMovementSurface} from '../apps/shared/movement/movement-field';

const fields = JSON.parse(readFileSync(resolve(
  process.env.BATTLEFIELDS ?? webAssetPath('battlefields.json')), 'utf8')) as
  {id: string; navigationLayers: SourceNavigationLayer[]}[];
const directory = webAssetPath('movement');
mkdirSync(directory, {recursive: true});
let surfaceCount = 0;
let cellCount = 0;

for (const field of fields) {
  const mapId = Number(field.id);
  const source = field.navigationLayers[0];
  if (!source) throw new Error(`缺少地图${field.id}的原 NAV`);
  const navigation = new NavigationGrid(source);
  const surfaces: SourceMovementSurface[] = [{id: 'terrain', enabled: true,
    cells: [...navigationOccupancy(getSceneTerrain(mapId), navigation, true)].sort((a, b) => a - b)}];
  for (const solid of getSceneSolids(mapId)) {
    surfaces.push({id: solid.placementId, enabled: true,
      cells: [...navigationOccupancy(solid.mesh, navigation)].sort((a, b) => a - b)});
  }
  // Disabled Crush placements retain their cells for later activation.
  for (const crush of getSceneCrushes(mapId)) {
    if (crush.enabled) continue;
    if (!crush.mesh) throw new Error(`缺少 Crush 渲染模型：${field.id}/${crush.id}`);
    surfaces.push({id: crush.id, enabled: false,
      cells: [...navigationOccupancy(crush.mesh, navigation)].sort((a, b) => a - b)});
  }
  const movement: SourceMovementField = {id: field.id, navigation: source, surfaces};
  writeFileSync(join(directory, `${field.id}.json`), JSON.stringify(movement), 'utf8');
  surfaceCount += surfaces.length;
  cellCount += surfaces.reduce((sum, surface) => sum + surface.cells.length, 0);
}
console.log(`${fields.length} movement maps: ${surfaceCount} surfaces, ${cellCount} occupied cells`);
