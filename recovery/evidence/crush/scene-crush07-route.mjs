/** Offline original NAV/BOX planning; this never mutates an active match. */
import {readFileSync, writeFileSync} from 'node:fs';
import {createRoomBattlefield, segmentBox} from '../../../apps/server/src/battlefield.ts';
import {createOriginalBotNavigation} from '../../../apps/server/src/battle/cpu/original-navigation.ts';
import {findBotPath} from '../../../apps/server/src/battle/cpu/navigation.ts';

var field = createRoomBattlefield(7);
var policy = createOriginalBotNavigation(field);
var map = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json', 'utf8')).find(row => row.id === '0007');
var target = map.records.find(row => row.className === 'SYcScnObjCrush' && row.id === '76');
var goals = [{x: target.position[0] - 150, y: 0, z: target.position[2] + 150},
  {x: target.position[0] + 150, y: 0, z: target.position[2] + 150}];
var rows = goals.map((goal, index) => {
  var spawn = field.spawns[index];
  var path = findBotPath(field, spawn, goal, policy);
  var start = {...goal, y: 35};
  var end = {x: target.matrix[12], y: 35, z: target.matrix[14]};
  var staticHit = field.firstBoxHit(start, end, 0);
  // Explicitly project only the target OBB onto the horizontal shot plane,
  // following the mainline's declared reconstructed Crush selection policy.
  var projected = [...target.matrix]; projected[13] = 35;
  var projectedTargetFraction = segmentBox(start, end,
    {id: 'CRUSH:76', matrix: projected, dimensions: target.bounds}, 0);
  return {playerSlot: index, spawn, goal, path, staticHit: staticHit ?? null,
    projectedTargetFraction, targetDistance: Math.hypot(end.x-start.x, end.z-start.z)};
});
var output = {status: rows.every(row => row.path.length &&
  (row.staticHit === null || row.staticHit.fraction > row.projectedTargetFraction))
  ? 'OFFLINE_ENTRANCE_READY' : 'OFFLINE_ROUTE_GAP', mapId: 7, modeId: 1,
  sourcePlacementId: '76', enabled: target.enabled, rows,
  observerSeparation: Math.hypot(goals[0].x-goals[1].x, goals[0].z-goals[1].z),
  scope: 'Two normal source spawn slots to separated near points. Original NAV planner/static BOX only; horizontal target selection is declared reconstruction. No active position/events, ordinary movement, participant collision, screenshot or gameplay claim.'};
writeFileSync('recovery/output/scene-crush07-route.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
