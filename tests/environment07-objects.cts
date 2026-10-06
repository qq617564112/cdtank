import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {createSceneObjects, damageSceneObject, resetSceneObjectCollision,
  syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const source = getSceneBreakables(7).filter(object => ['obj05466', 'obj05467', 'obj05468', 'obj05462'].includes(object.model));
assert.equal(source.length, 13);
assert.deepEqual(['obj05466', 'obj05467', 'obj05468', 'obj05462'].map(model => source.filter(object => object.model === model).length), [4, 3, 3, 3]);
for (const mode of [1, 3]) {
  const objects = createSceneObjects({mode, map: {mapId: 7}});
  assert.deepEqual(objects.map(object => object.sourcePlacementId), source.map(object => object.id));
  assert(objects.every(object => object.hp === 200 && object.maxHp === 200));
  for (const [index, object] of objects.entries()) {
    assert.equal(object.sourceModel, source[index].model);
    assert.deepEqual([object.x, object.y, object.z], source[index].matrix.slice(12, 15));
  }
}
for (const mode of [2, 4, 5]) assert.deepEqual(createSceneObjects({mode, map: {mapId: 7}}), []);
for (const mapId of [20, 21, 22]) assert.deepEqual(createSceneObjects({mode: 1, map: {mapId}}), []);
const first = {roomId: 'environment07-first', phase: 'PLAYING', mode: 1, map: {mapId: 7},
  battlefield: createRoomBattlefield(7), sceneObjects: createSceneObjects({mode: 1, map: {mapId: 7}})};
const second = {...first, roomId: 'environment07-second', battlefield: createRoomBattlefield(7),
  sceneObjects: createSceneObjects(first)};
syncSceneObjectCollision(first, 0);
syncSceneObjectCollision(second, 0);
const target = first.sceneObjects.find(object => object.sourceModel === 'obj05467')!;
const counterpart = second.sceneObjects.find(object => object.id === target.id)!;
assert.equal(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
const events: MsgRoomEvent[] = [];
const owner = {id: 'shooter', name: 'Shooter', score: 17, objectivesDestroyed: 3, kills: 2};
const before = {...owner};
for (const phase of ['WAITING', 'FINISHED']) damageSceneObject({...first, phase}, owner, target, 200, 50, events);
assert.equal(target.hp, 200);
assert.equal(events.length, 0);
damageSceneObject(first, owner, target, 43, 100, events);
assert.equal(target.hp, 157);
assert.equal(target.destroyedAt, undefined);
damageSceneObject(first, owner, target, 200, 200, events);
assert.equal(target.hp, 0);
assert.equal(target.destroyedAt, 200);
assert.deepEqual(events.map(event => [event.type, event.value]), [['sceneObjectHit', 43], ['sceneObjectHit', 157], ['sceneObjectDestroyed', 0]]);
damageSceneObject(first, owner, target, 43, 300, events);
assert.equal(events.length, 3);
assert.deepEqual(owner, before, 'Environment damage never changes player or objective scores');
assert.equal(counterpart.hp, 200, 'Damage is isolated to its room');
syncSceneObjectCollision(first, 2200);
assert.equal(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
syncSceneObjectCollision(first, 2201);
assert.notEqual(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
assert.equal(second.battlefield.firstBoxHit(counterpart, counterpart, 0)?.boxId, counterpart.id);
resetSceneObjectCollision(first.battlefield);
first.sceneObjects = createSceneObjects(first);
syncSceneObjectCollision(first, 2300);
assert.equal(first.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
assert(first.sceneObjects.every(object => object.hp === 200 && object.destroyedAt === undefined));
resetSceneObjectCollision(first.battlefield);
resetSceneObjectCollision(second.battlefield);
writeFileSync('recovery/output/environment07-objects.json', JSON.stringify({status: 'PASS',
  scope: 'Source eligibility, isolated authoritative damage and strict collision release/reset; not ordinary player or browser acceptance',
  modes: [1, 3], models: ['obj05466', 'obj05467', 'obj05468', 'obj05462'], instances: source.map(object => object.id), events}, null, 2) + '\n');
console.log('PASS map7 source13, legal team eligibility, isolated damage/no score, fade collision boundary and reset');
