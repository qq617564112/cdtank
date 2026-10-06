import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {createSceneObjects, damageSceneObject, resetSceneObjectCollision,
  syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const models = ['obj05425', 'obj05426', 'obj05428'];
const sources = getSceneBreakables(14).filter(source => models.includes(source.model));
assert.deepEqual(models.map(model => sources.filter(source => source.model === model).length), [47, 40, 33]);
const room = {roomId: 'map14-authority', phase: 'PLAYING', mode: 4, map: {mapId: 14},
  battlefield: createRoomBattlefield(14), sceneObjects: createSceneObjects({mode: 4, map: {mapId: 14}})};
assert.equal(room.sceneObjects.length, 120);
for (const [index, object] of room.sceneObjects.entries()) {
  assert.equal(object.id, `ENV:${sources[index].id}`);
  assert.equal(object.sourceModel, sources[index].model);
  assert.deepEqual([object.x, object.y, object.z], sources[index].matrix.slice(12, 15));
  assert.equal(object.hp, 200);
  assert.equal(object.maxHp, 200);
}
for (const mode of [1, 2, 3, 5]) assert.deepEqual(createSceneObjects({mode, map: {mapId: 14}}), []);
const target = room.sceneObjects.find(object => object.sourcePlacementId === '148')!;
assert.equal(target.sourceModel, 'obj05426');
const independent = createSceneObjects(room).find(object => object.id === target.id)!;
syncSceneObjectCollision(room, 0);
assert.equal(room.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
const owner = {id: 'shooter', name: 'Shooter', score: 0, kills: 0, objectivesDestroyed: 0};
const events: MsgRoomEvent[] = [];
for (const phase of ['WAITING', 'FINISHED']) damageSceneObject({...room, phase}, owner, target, 200, 10, events);
assert.equal(target.hp, 200);
assert.equal(events.length, 0);
damageSceneObject(room, owner, target, 43, 100, events);
damageSceneObject(room, owner, target, 200, 200, events);
damageSceneObject(room, owner, target, 43, 300, events);
assert.deepEqual(events.map(event => [event.type, event.targetId, event.value]),
  [['sceneObjectHit', target.id, 43], ['sceneObjectHit', target.id, 157], ['sceneObjectDestroyed', target.id, 0]]);
assert.equal(independent.hp, 200);
assert.deepEqual([owner.score, owner.kills, owner.objectivesDestroyed], [0, 0, 0]);
syncSceneObjectCollision(room, 2200);
assert.equal(room.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
syncSceneObjectCollision(room, 2201);
assert.notEqual(room.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
resetSceneObjectCollision(room.battlefield);
room.sceneObjects = createSceneObjects(room);
syncSceneObjectCollision(room, 2300);
assert.equal(room.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
assert(room.sceneObjects.every(object => object.hp === 200 && object.destroyedAt === undefined));
resetSceneObjectCollision(room.battlefield);
writeFileSync('recovery/output/environment14-objects.json', JSON.stringify({status: 'PASS_MAP14_NAMED_AUTHORITY_RULE_SCOPE',
  models, counts: [47, 40, 33], mode: 4, target: target.id, events,
  scope: 'Named registration, damage once, room isolation, collision fade and reset; ordinary browser acceptance pending'}, null, 2) + '\n');
console.log('PASS map14 named120, mode4 permission, once destruction, isolated state and collision release/reset');
