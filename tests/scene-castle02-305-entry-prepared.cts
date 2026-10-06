import {writeFileSync} from 'node:fs';
import {createRoomBattlefield, segmentBox} from '../apps/server/src/battlefield';
import {getSceneCastles} from '../apps/server/src/scene-objects';
import {createSceneObjects, syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';

const field = createRoomBattlefield(2);
const sceneObjects = createSceneObjects({mode: 1, map: {mapId: 2}});
syncSceneObjectCollision({map: {mapId: 2}, battlefield: field, sceneObjects}, 0);
const target = getSceneCastles(2).find(value => value.id === '305')!;
const start = {x: -1779.89, y: 0.02, z: 525.64};
const navigation = createOriginalBotNavigation(field);
const candidates = [];
for (const radius of [300, 400, 500]) {
  for (let step = 0; step < 16; step++) {
    const angle = step * Math.PI / 8;
    const x = target.matrix[12] + Math.sin(angle) * radius;
    const z = target.matrix[14] + Math.cos(angle) * radius;
    const cell = field.navigation.sample(x, z);
    if (!cell?.valid) continue;
    const goal = {x, y: cell.height, z};
    const origin = {...goal, y: goal.y + 20};
    const end = {x: target.matrix[12], y: origin.y, z: target.matrix[14]};
    const fraction = segmentBox(origin, end, target, 1);
    const obstruction = field.firstSurfaceHit(origin, end, 1);
    if (fraction === undefined || (obstruction && obstruction.fraction + 0.00001 < fraction)) continue;
    const route = findBotPath(field, start, goal, navigation);
    if (!route.length || Math.hypot(route.at(-1)!.x - goal.x, route.at(-1)!.z - goal.z) > 45) continue;
    let length = 0;
    let prior = start;
    for (const point of route) {length += Math.hypot(point.x - prior.x, point.z - prior.z); prior = point;}
    candidates.push({goal, radius, route, length, origin, end, fraction, obstruction});
  }
}
candidates.sort((a, b) => a.length - b.length);
const evidence = {status: candidates.length ? 'PREPARED_MAP02_305_NAV_SHOT_ENTRY' : 'GAP_MAP02_305_NAV_SHOT_ENTRY',
  sourcePlacementId: '305', model: target.model, start, target, selected: candidates[0],
  candidateCount: candidates.length,
  scope: 'Read-only ordinary-input proposal using the current formal Map02 Castle2/ENV60 collision pipeline; no live movement, shot, damage, original-policy or pixel acceptance.'};
writeFileSync('recovery/output/scene-castle02-305-entry-prepared.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status, candidates.length, candidates[0]?.goal);
