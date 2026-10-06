import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables, getSceneCastles} from '../apps/server/src/scene-objects';
import {createSceneObjects, damageSceneObject, resetSceneObjectCollision,
  syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const expectedCastles = (mapId: number) => getSceneCastles(mapId).map(source => ({
  id: `CASTLE:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
  x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp: source.hp, maxHp: source.hp,
}));
const objects = createSceneObjects({mode: 1, map: {mapId: 5}});
const castles = objects.filter(object => object.id.startsWith('CASTLE:'));
assert.deepEqual(castles, expectedCastles(5));
const source = getSceneBreakables(5).filter(object => ['obj05425', 'obj05426'].includes(object.model));
assert.deepEqual(['obj05425', 'obj05426'].map(model => source.filter(object => object.model === model).length), [11, 1]);
const environment = objects.filter(object => object.id.startsWith('ENV:'));
assert.deepEqual(environment.map(object => object.sourcePlacementId), source.map(object => object.id));
assert.equal(objects.length, castles.length + 12);
assert(environment.every(object => object.hp === 200 && object.maxHp === 200));
assert(!environment.some(object => object.sourceModel === 'obj05432'));
for (const mapId of [6, 11]) assert.deepEqual(createSceneObjects({mode: 1, map: {mapId}}), expectedCastles(mapId));
for (const mode of [2, 3, 4, 5]) assert.deepEqual(createSceneObjects({mode, map: {mapId: 5}}), []);
const target = environment.find(object => object.sourcePlacementId === '132')!;
assert.equal(target.sourceModel, 'obj05426');
const room = {roomId: 'map05-coexistence', phase: 'PLAYING', mode: 1, map: {mapId: 5},
  battlefield: createRoomBattlefield(5), sceneObjects: objects};
syncSceneObjectCollision(room, 0);
assert.equal(room.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
const frozenCastles = structuredClone(castles);
const events: MsgRoomEvent[] = [];
const owner = {id: 'shooter', name: 'Shooter', kills: 0, score: 0, objectivesDestroyed: 0};
damageSceneObject(room, owner, target, 43, 100, events);
damageSceneObject(room, owner, target, 200, 200, events);
damageSceneObject(room, owner, target, 43, 300, events);
assert.deepEqual(events.map(event => [event.type, event.targetId, event.value]),
  [['sceneObjectHit', target.id, 43], ['sceneObjectHit', target.id, 157], ['sceneObjectDestroyed', target.id, 0]]);
assert(events.every(event => event.castleDamage === undefined));
assert.deepEqual(castles, frozenCastles);
assert.deepEqual([owner.kills, owner.score, owner.objectivesDestroyed], [0, 0, 0]);
syncSceneObjectCollision(room, 2201);
assert.notEqual(room.battlefield.firstBoxHit(target, target, 0)?.boxId, target.id);
resetSceneObjectCollision(room.battlefield);
room.sceneObjects = createSceneObjects(room);
assert.deepEqual(room.sceneObjects.filter(object => object.id.startsWith('CASTLE:')), expectedCastles(5));
assert(room.sceneObjects.filter(object => object.id.startsWith('ENV:')).every(object => object.hp === 200));
writeFileSync('recovery/output/environment05-coexistence.json', JSON.stringify({
  status: 'PASS_MAP05_CASTLE_NAMED_ENV_COEXISTENCE_RULE_SCOPE', castleCount: castles.length,
  environmentCount: 12, target: target.id, events,
  scope: 'Original Castle identity/HP, named ENV registration and isolated damage/fade/reset; ordinary acceptance pending',
}, null, 2) + '\n');
console.log('PASS map05 original Castle snapshots + namedENV12 coexist; ENV does not damage Castle or award scores');
