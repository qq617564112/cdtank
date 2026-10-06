import {readFileSync, writeFileSync} from 'node:fs';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {createSceneObjects, syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
import {originalActorCameraHeading, originalBattleCameraPose} from '../apps/web/src/render/battle-camera';

const field = createRoomBattlefield(2);
const sceneObjects = createSceneObjects({mode: 1, map: {mapId: 2}});
syncSceneObjectCollision({map: {mapId: 2}, battlefield: field, sceneObjects}, 0);
const original = createOriginalBotNavigation(field);
const clearanceRadius = Math.hypot(49 / 2, 52 / 2);
const canTraverse = (start: {x: number; y: number; z: number}, end: typeof start) => {
  if (!original.canTraverse(start, end)) return false;
  const reached = field.move(start, end, clearanceRadius);
  return Math.hypot(reached.x - end.x, reached.z - end.z) < .01;
};
const policy = {cacheKey: 'prepared-nav-static-full-footprint', canTraverse,
  reachable: original.reachable};
const water = JSON.parse(readFileSync('recovery/output/web-assets/scene-water-0002.json', 'utf8'));
const bounds = water.geometry.find((value: {name: string}) => value.name === 'water').bounds[0];
const target = {x: (bounds[0] + bounds[3]) / 2, y: bounds[1], z: (bounds[2] + bounds[5]) / 2};
const starts = [field.spawn(0), field.spawn(1)];
const candidates = [];
for (const [x, z] of [[-1250, -270], [-1250, -450], [-1100, -620],
  [-850, -620], [-600, -620], [-250, -400]]) {
  const cell = field.navigation.sample(x, z);
  if (!cell?.valid) continue;
  const goal = {x, y: cell.height, z};
  const yaw = Math.atan2(target.x - x, target.z - z);
  const pose = originalBattleCameraPose([x, goal.y, z], originalActorCameraHeading(yaw));
  const eye = {x: pose.eye[0], y: pose.eye[1], z: pose.eye[2]};
  const obstruction = field.firstSurfaceHit(eye, target, 0);
  if (obstruction && obstruction.fraction < .99) continue;
  const routes = starts.map(start => findBotPath(field, start, goal, policy));
  if (routes.some(route => !route.length)) continue;
  candidates.push({goal, yaw, camera: pose, obstruction: obstruction ?? null, routes});
}
const evidence = {status: candidates.length ? 'PREPARED_NEW_MAP02_WATER_ENTRY' : 'GAP_NEW_MAP02_WATER_ENTRY',
  starts, target, clearanceRadius, candidates,
  scope: 'Published water bounds and current NAV/static Castle2ENV60 pipeline only. Conservative circular clearance is a route proposal, not original OBB movement or visual acceptance. New west/south candidates; no old north-bank route, live input, camera injection or source revalidation.'};
writeFileSync('recovery/output/map02-water-entry-prepared.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status, candidates.length);
