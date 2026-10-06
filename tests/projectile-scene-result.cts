import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {attachProjectileSceneResult} from '../apps/server/src/battle/projectile-scene-result';
import {damageSceneObject} from '../apps/server/src/battle/environment';
import {damageObjective} from '../apps/server/src/modes/objectives';
import {advanceProjectiles} from '../apps/server/src/battle/projectiles';
import type {MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot} from '../apps/shared/protocols';
import type {Battlefield} from '../apps/server/src/battlefield';

const owner = {id: 'P1', name: 'Owner', score: 0, objectivesDestroyed: 0,
  x: 0, y: 0, z: 0, alive: true, currentAmmoItemId: 2009};
const room = {roomId: 'R1', phase: 'PLAYING', map: {mapId: 7, hitScore: 1, destroyScore: 10}};
const object: SceneObjectSnapshot = {id: 'ENV:79', sourcePlacementId: '79',
  sourceModel: 'obj05466', x: 50, y: 0, z: 0, hp: 60, maxHp: 60};
const events: MsgRoomEvent[] = [];
damageSceneObject(room, owner, object, 40, 100, events);
attachProjectileSceneResult(events, 0, owner.id, 2002);
assert(events.every(event => !event.shotItemResult));
let first = events.length;
damageSceneObject(room, owner, object, 40, 200, events);
attachProjectileSceneResult(events, first, owner.id, 2002);
const result = events.find(event => event.type === 'sceneObjectDestroyed')!;
assert.deepEqual(result.shotItemResult, {itemId: 2002, x: 50, y: 0, z: 0});
first = events.length;
damageSceneObject(room, owner, object, 40, 300, events);
attachProjectileSceneResult(events, first, owner.id, 2002);
assert.equal(events.filter(event => event.shotItemResult).length, 1);

const objective: ObjectiveSnapshot = {id: 'OBJ:1', kind: 'DESTROY', x: 50, y: 0, z: 0,
  radius: 10, hp: 40, maxHp: 40, ownerTeam: -1, contested: false};
const projectileRoom = {...room, players: new Map([[owner.id, owner]]), objectives: [objective],
  bullets: [{id: 'B1', ownerId: owner.id, x: 0, y: 20, z: 0, vx: 100, vy: 0, vz: 0,
    damage: 50, ammoItemId: 2002, ttl: 2}],
  battlefield: {firstSurfaceHit: () => undefined} as unknown as Battlefield};
advanceProjectiles(projectileRoom, .6, 10, {
  hitPlayer: () => assert.fail('No victim in this transaction'),
  hitObjective: (attacker, target, damage, frozenAmmo) => {
    const start = events.length;
    damageObjective(room, attacker, target, damage, 400, events);
    attachProjectileSceneResult(events, start, attacker.id, frozenAmmo);
  }, terrainHit: event => events.push(event),
});
assert.equal(projectileRoom.bullets.length, 0);
const destroyed = events.find(event => event.type === 'objectiveDestroyed')!;
assert.deepEqual(destroyed.shotItemResult, {itemId: 2002, x: 50, y: 0, z: 0});
assert.equal(owner.currentAmmoItemId, 2009);
for (const type of ['fire', 'terrainHit', 'sceneObjectHit', 'objectiveHit', 'sceneCrushed']) {
  const ignored = {...result, type, shotItemResult: undefined};
  const batch = [ignored]; attachProjectileSceneResult(batch, 0, owner.id, 2002);
  assert.equal(ignored.shotItemResult, undefined);
}
for (const itemId of [2003, 2004, 2005, 2006, 2008, 2011]) {
  const lastShot = {...result, shotItemResult: undefined} as MsgRoomEvent;
  attachProjectileSceneResult([lastShot], 0, owner.id, itemId);
  assert.deepEqual(lastShot.shotItemResult, {itemId, x: 50, y: 0, z: 0});
}
for (const ammo of [undefined, 2001, 2010, 2009]) {
  const ignored = {...result, shotItemResult: undefined};
  attachProjectileSceneResult([ignored], 0, owner.id, ammo);
  assert.equal(ignored.shotItemResult, undefined);
}
writeFileSync('recovery/output/projectile-scene-result.json', JSON.stringify({status: 'PASS_MODULE_TRANSACTION_SCOPE',
  scene: result, objective: destroyed, frozenAmmoSurvivesSelectionChange: true,
  nonlethalAndUnrelatedEventsSilent: true, noDuplicateSceneDeath: true,
  scope: 'Real damage transactions and projectile callback; isolated module fixture, not ordinary browser evidence.'}, null, 2) + '\n');
console.log('PASS: frozen supported ammo lethal scene/objective endpoints; unrelated events silent');
