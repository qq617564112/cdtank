import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSceneCrushes, acceptSceneCrush, querySceneCrush} from '../apps/server/src/battle/scene-crush';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {createSceneObjects, syncSceneObjectCollision, resetSceneObjectCollision} from '../apps/server/src/battle/environment';
import {getSceneCrushes} from '../apps/server/src/scene-objects';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const room = {roomId: 'module', phase: 'PLAYING', mode: 1, map: {mapId: 7},
  battlefield: createRoomBattlefield(7), sceneCrushes: createSceneCrushes({mode: 1, map: {mapId: 7}}),
  sceneObjects: createSceneObjects({mode: 1, map: {mapId: 7}})};
assert.equal(room.sceneCrushes.length, 3);
assert.deepEqual(room.sceneCrushes.map(o => [o.sourcePlacementId, o.enabled, o.hidden]),
  [['75', false, true], ['76', true, false], ['77', true, false]]);
assert.equal(createSceneCrushes({mode: 4, map: {mapId: 7}}).length, 0);
assert.equal(createSceneCrushes({mode: 1, map: {mapId: 4}}).length, 0);
const source = getSceneCrushes(7).find(o => o.id === '76')!;
const start = {x: source.matrix[12], y: 40, z: source.matrix[14] - 50};
const end = {...start, z: source.matrix[14] + 50};
assert.equal(querySceneCrush(start, end, room.sceneCrushes)?.id, 'CRUSH:76');
const target = room.sceneCrushes.find(o => o.sourcePlacementId === '76')!;
const events: MsgRoomEvent[] = [];
syncSceneObjectCollision(room, 0);
const before = room.battlefield.navigationRevision;
assert.equal(acceptSceneCrush({...room, phase: 'WAITING'}, 'P1', target, events), false);
assert.equal(acceptSceneCrush(room, 'P1', room.sceneCrushes[0], events), false);
assert.equal(acceptSceneCrush(room, 'P1', target, events), true);
assert.equal(acceptSceneCrush(room, 'P1', target, events), false);
assert.equal(events.length, 1);
assert.equal(events[0].type, 'sceneCrushed');
assert.equal('hp' in target, false);
assert.equal(querySceneCrush(start, end, room.sceneCrushes), undefined);
syncSceneObjectCollision(room, 0);
assert.equal(room.battlefield.navigationRevision, before + 1, 'Collision releases immediately');
room.sceneCrushes = createSceneCrushes(room);
syncSceneObjectCollision(room, 1);
assert.equal(room.battlefield.navigationRevision, before + 2, 'New round restores source occupancy');
resetSceneObjectCollision(room.battlefield);
writeFileSync('recovery/output/scene-crush07-authority.json', JSON.stringify({
  status: 'PASS_AUTHORITY_MODULE', checks: ['source enabled', 'legal map/mode', 'horizontal source OBB',
    'waiting/disabled/hidden refusal', 'one event/no HP', 'immediate collision release', 'round occupancy reset', 'clear'],
  limits: ['server shot selection/permission rebuilt', 'ordinary network and visual output not covered'],
}, null, 2));
console.log('PASS Crush07 authority/source OBB/hidden guard/immediate release/round reset');
