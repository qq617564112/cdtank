import assert from 'node:assert/strict';
import {createRoomBattlefield, getBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {createSceneObjects, damageSceneObject, resetSceneObjectCollision,
  syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const sources = getSceneBreakables(18).filter(source => ['obj05424', 'obj05442'].includes(source.model));
assert.equal(sources.length, 34);
assert.equal(sources.filter(source => source.model === 'obj05424').length, 18);
assert.equal(sources.filter(source => source.model === 'obj05442').length, 16);
const first = {roomId: 'first', phase: 'PLAYING', mode: 4, map: {mapId: 18},
  battlefield: createRoomBattlefield(18), sceneObjects: createSceneObjects({mode: 4, map: {mapId: 18}})};
const second = {...first, roomId: 'second', battlefield: createRoomBattlefield(18),
  sceneObjects: createSceneObjects(first)};
const cached = getBattlefield(18);
assert.equal(first.sceneObjects.length, 34);
assert.deepEqual(createSceneObjects({mode: 5, map: {mapId: 18}}), []);
assert.deepEqual(createSceneObjects({mode: 4, map: {mapId: 20}}), []);
assert.deepEqual(first.sceneObjects.map(object => object.sourcePlacementId), sources.map(source => source.id));
for (const [index, object] of first.sceneObjects.entries()) {
  assert.equal(object.id, `ENV:${sources[index].id}`);
  assert.equal(object.sourceModel, sources[index].model);
  assert.deepEqual([object.x, object.y, object.z], sources[index].matrix.slice(12, 15));
  assert.equal(object.hp, 200);
  assert.equal(object.maxHp, 200);
}

const target = first.sceneObjects[0], counterpart = second.sceneObjects[0];
const baseline = first.battlefield.navigation.sample(target.x, target.z);
assert(baseline?.valid);
syncSceneObjectCollision(first, 0);
for (const object of first.sceneObjects) {
  assert.equal(first.battlefield.firstBoxHit(object, object, 0)?.boxId, object.id);
  assert.equal(first.battlefield.navigation.sample(object.x, object.z)?.valid, false);
}
assert(second.battlefield.navigation.sample(target.x, target.z)?.valid);
assert(cached.navigation.sample(target.x, target.z)?.valid);
assert.notEqual(second.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
const revision = first.battlefield.navigationRevision;
syncSceneObjectCollision(first, 1);
assert.equal(first.battlefield.navigationRevision, revision, 'Unchanged collision should not revise NAV');

const events: MsgRoomEvent[] = [];
const owner = {id: 'player', name: 'Player', score: 123, kills: 4, objectivesDestroyed: 6};
const ownerBefore = structuredClone(owner);
for (const phase of ['WAITING', 'FINISHED']) damageSceneObject({...first, phase}, owner, target, 10, 50, events);
for (const damage of [0, -1, NaN, Infinity, -Infinity]) damageSceneObject(first, owner, target, damage, 50, events);
assert.equal(target.hp, 200);
assert.equal(events.length, 0);
damageSceneObject(first, owner, target, 30, 100, events);
damageSceneObject(first, owner, target, 70, 200, events);
assert.equal(target.hp, 100);
assert.equal(target.destroyedAt, undefined);
damageSceneObject(first, owner, target, 150, 300, events);
assert.equal(target.hp, 0);
assert.equal(target.destroyedAt, 300);
assert.deepEqual(events.map(event => [event.type, event.value]),
  [['sceneObjectHit', 30], ['sceneObjectHit', 70], ['sceneObjectHit', 100], ['sceneObjectDestroyed', 0]]);
assert(events.every(event => event.roomId === first.roomId && event.playerId === owner.id
  && event.targetId === target.id && event.x === target.x && event.y === target.y && event.z === target.z));
damageSceneObject(first, owner, target, 10, 400, events);
assert.equal(events.length, 4);
assert.equal(target.destroyedAt, 300);
assert.equal(counterpart.hp, 200);
assert.deepEqual(owner, ownerBefore, 'Environment damage must not award score or objectives');

syncSceneObjectCollision(first, 2300);
assert.equal(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
assert.equal(first.battlefield.navigation.sample(target.x, target.z)?.valid, false);
syncSceneObjectCollision(first, 2301);
assert.notEqual(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
assert.deepEqual(first.battlefield.navigation.sample(target.x, target.z), baseline);
syncSceneObjectCollision(second, 2301);
assert.equal(second.battlefield.firstBoxHit(counterpart, counterpart, 0)?.boxId, counterpart.id);
resetSceneObjectCollision(first.battlefield);
for (const object of first.sceneObjects) assert.notEqual(first.battlefield.firstBoxHit(object, object, 0)?.boxId, object.id);
assert.equal(second.battlefield.firstBoxHit(counterpart, counterpart, 0)?.boxId, counterpart.id);
first.sceneObjects = createSceneObjects(first);
syncSceneObjectCollision(first, 2400);
assert.equal(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
assert(first.sceneObjects.every(object => object.hp === 200 && object.destroyedAt === undefined));
first.sceneObjects = [];
syncSceneObjectCollision(first, 2500);
assert.deepEqual(first.battlefield.navigation.sample(target.x, target.z), baseline);
resetSceneObjectCollision(first.battlefield);
resetSceneObjectCollision(second.battlefield);
assert.deepEqual(second.battlefield.navigation.sample(target.x, target.z), baseline);
console.log('PASS: map18 source34 environment objects, authoritative damage, fade OBB/NAV boundary, room isolation and round reset');
