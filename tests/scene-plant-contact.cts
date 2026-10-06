import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import type {MsgRoomEvent} from '../apps/shared/protocols';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getScenePlants} from '../apps/server/src/scene-objects';
import {createScenePlants, plantContactColliders} from '../apps/server/src/battle/scene-plant-contact';
import {isRoleControllerMovementAllowed, type RoleMovementCollider} from '../apps/server/src/battle/roles/movement-controller';

const source = getScenePlants(2).find(source => source.id === '327')!;
const events: MsgRoomEvent[] = [];
const room = {roomId: 'PLANT_TEST', phase: 'PLAYING', map: {mapId: 2},
  battlefield: createRoomBattlefield(2), scenePlants: createScenePlants({mode: 1, map: {mapId: 2}})};
assert.equal(room.scenePlants.length, 29);
assert(room.scenePlants.every(state => state.enabled && !state.hidden && state.sourceModel === 'obj05413'));
assert.deepEqual(room.scenePlants.map(state => state.sourcePlacementId), getScenePlants(2).map(source => source.id));
for (const mode of [2, 3]) assert.equal(createScenePlants({mode, map: {mapId: 2}}).length, 29);
for (const mode of [4, 5]) assert.deepEqual(createScenePlants({mode, map: {mapId: 2}}), []);
assert.deepEqual(createScenePlants({mode: 1, map: {mapId: 7}}), []);

const obb = {matrix: source.matrix, dimensions: [20, 20, 20] as const};
const role: RoleMovementCollider = {id: 'P1', status: 2, x: source.matrix[12],
  z: source.matrix[14], command: 1, currentObb: obb, predictObb: () => obb};
const peer = {...role, id: 'P2'};
assert.equal(isRoleControllerMovementAllowed(role, 1, [peer],
  plantContactColliders(room, role.id as string, events), true, () => {}), false);
assert.equal(events.length, 0);
assert.equal(room.scenePlants.find(state => state.sourcePlacementId === '327')!.hidden, false);
assert.equal(isRoleControllerMovementAllowed(role, 1, [],
  plantContactColliders(room, role.id as string, events), true, () => {}), true);
assert.equal(events.length, 1);
assert.equal(events[0].type, 'scenePlantHidden');
assert.equal(events[0].targetId, 'PLANT:327');
assert.deepEqual(events[0].scenePlant, {placementId: '327'});
assert.equal(room.scenePlants.find(state => state.sourcePlacementId === '327')!.hidden, true);
assert.equal(isRoleControllerMovementAllowed(role, 1, [],
  plantContactColliders(room, role.id as string, events), true, () => {}), true);
assert.equal(events.length, 1);
room.phase = 'FINISHED';
assert.deepEqual(plantContactColliders(room, role.id as string, events), []);
const reset = createScenePlants({mode: 1, map: {mapId: 2}});
assert(reset.every(state => !state.hidden));
writeFileSync('recovery/output/scene-plant-contact.json', JSON.stringify({
  status: 'PASS_SOURCE_PLANT_STATIC_CONTACT_DYNAMIC_PRIORITY_RESET', sourceCount: 29,
  target: 'PLANT:327', event: events[0],
  scope: 'Source OBB/controller static notification, dynamic rejection precedence, repeat/phase guards and round initialization; no network or pixel claim.',
}, null, 2) + '\n');
