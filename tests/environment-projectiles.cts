import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {advanceProjectiles, type BulletState} from '../apps/server/src/battle/projectiles';
import {createSceneObjects, syncSceneObjectCollision} from '../apps/server/src/battle/environment';
import type {ObjectiveSnapshot} from '../apps/shared/protocols';

// Explicit projectile fixtures compare real source geometry with nearer actors
// and objectives. They do not replace the ordinary-input World acceptance.
const source = getSceneBreakables(18).find(source => source.id === '87')!;
const point = {x: source.matrix[12], y: 20, z: source.matrix[14]};
const start = {...point, z: point.z - 100}, end = {...point, z: point.z + 100};
const evidence: Array<{name: string; hits: string[]}> = [];
function fixture() {
  const owner = {id: 'owner', alive: true, x: start.x, y: 0, z: start.z};
  const room = {roomId: 'projectiles', phase: 'PLAYING', map: {mapId: 18},
    battlefield: createRoomBattlefield(18), sceneObjects: createSceneObjects({mode: 4, map: {mapId: 18}}),
    objectives: [] as ObjectiveSnapshot[], players: new Map([[owner.id, owner]]), bullets: [] as BulletState[]};
  syncSceneObjectCollision(room, 0);
  return room;
}
function shoot(name: string, room: ReturnType<typeof fixture>, expected: string[],
  from = start, to = end): void {
  room.bullets.push({id: 'bullet', ownerId: 'owner', ...from,
    vx: to.x - from.x, vy: to.y - from.y, vz: to.z - from.z, damage: 40, ttl: 2});
  const hits: string[] = [];
  advanceProjectiles(room, 1, 20, {
    hitPlayer: (_owner, target) => {hits.push(`player:${target.id}`);},
    hitObjective: (_owner, target) => {hits.push(`objective:${target.id}`);},
    hitSceneObject: (_owner, target) => {hits.push(`environment:${target.id}`);},
    terrainHit: event => {hits.push(`surface:${event.targetId}`);},
  });
  assert.deepEqual(hits, expected, name);
  assert.equal(room.bullets.length, expected.length ? 0 : 1, name);
  evidence.push({name, hits});
}
const envId = `ENV:${source.id}`;
shoot('source OBB ties its dynamic collider and damages once', fixture(), [`environment:${envId}`]);
{
  const room = fixture();
  room.players.set('front', {id: 'front', alive: true, x: point.x, y: 0, z: point.z - 65});
  shoot('nearer player wins over environment', room, ['player:front']);
}
{
  const room = fixture();
  room.players.set('back', {id: 'back', alive: true, x: point.x, y: 0, z: point.z + 65});
  shoot('environment wins over farther player', room, [`environment:${envId}`]);
}
for (const zOffset of [-65, 65]) {
  const room = fixture();
  room.objectives.push({id: 'objective', kind: 'DESTROY', x: point.x, y: 0, z: point.z + zOffset,
    radius: 10, hp: 100, maxHp: 100, ownerTeam: -1, contested: false});
  shoot(`objective offset ${zOffset} shares closest-hit selection`, room,
    zOffset < 0 ? ['objective:objective'] : [`environment:${envId}`]);
}
{
  const room = fixture();
  const from = {x: 122.27, y: 20, z: -766.81};
  const source = getSceneBreakables(18).find(source => source.id === '32')!;
  const to = {x: source.matrix[12], y: 20, z: source.matrix[14]};
  const wall = room.battlefield.firstSurfaceHit(from, to, 1)!;
  assert.equal(wall.boxId, '19');
  shoot('nearer original wall wins over environment', room, ['surface:19'], from, to);
}
{
  const room = fixture();
  const target = room.sceneObjects.find(object => object.id === envId)!;
  target.hp = 0;
  target.destroyedAt = 100;
  syncSceneObjectCollision(room, 2100);
  shoot('destroyed environment retains collider at fade boundary', room, [`surface:${envId}`]);
  syncSceneObjectCollision(room, 2101);
  assert.notEqual(room.battlefield.firstBoxHit(start, end, 1)?.boxId, envId);
  assert.equal(room.battlefield.navigation.sample(point.x, point.z)?.valid, true);
  shoot('released environment permits projectile passage', room, []);
}
{
  const room = fixture();
  const from = {x: 122.27, y: 100, z: -766.81};
  const to = {...from, y: -100};
  assert.equal(room.battlefield.firstSurfaceHit(from, to, 1)?.boxId, 'terrain');
  shoot('original terrain produces one surface event', room, ['surface:terrain'], from, to);
}
writeFileSync('recovery/output/environment-projectiles.json', JSON.stringify({status: 'PASS',
  scope: 'Explicit projectile fixtures using map18 original OBB/terrain with actor and objective competitors; closest hit occurs once.',
  sourcePlacementId: source.id, evidence}, null, 2) + '\n');
console.log('PASS: environment projectile OBB selection, nearer player/wall/objective mutual exclusion and strict fade release');
