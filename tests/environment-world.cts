import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {Battlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import type {MsgRoomEvent} from '../apps/shared/protocols';

// Ordinary input fixture with a simulated clock and a legal 30-second deadline.
// Source transforms and the actual room field are observed, never changed.
let now = 100000;
const world = new World(() => now, {minPlayers: 2, timeLimitSeconds: 30});
const joined = world.createAndJoin('environment-owner', 4, 18, '射箱验收', 'Shooter', 1);
const guest = world.joinRoom(joined.roomId, 'environment-guest', 'Observer', 1);
world.ready(joined.playerId, 1);
world.ready(guest.playerId, 1);
const snapshot = () => world.snapshot(joined.roomId)!;
const field = (world as unknown as {rooms: ReadonlyMap<string, {battlefield: Battlefield}>})
  .rooms.get(joined.roomId)!.battlefield;
const sourceId = process.argv[2] ?? '87';
const source = getSceneBreakables(18).find(source => source.id === sourceId)!;
assert(['obj05424', 'obj05442'].includes(source.model));
const point = {x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
const object = () => snapshot().match!.sceneObjects!.find(object => object.sourcePlacementId === source.id)!;
const player = () => snapshot().players.find(player => player.id === joined.playerId)!;
const events: MsgRoomEvent[] = [];
let sequence = 0;
function step(move = 0, aim = 0, fire = false): void {
  world.updateInput(joined.playerId, {sequence: ++sequence, move, turn: 0, aim, fire,
    useItem: 0, clientTime: now});
  now += 50;
  events.push(...world.step(50).events);
}
const start = {...player()};
for (let tick = 0; tick < 5; tick++) step(1);
assert(Math.hypot(player().x - start.x, player().z - start.z) > 1);
for (let tick = 0; tick < 100; tick++) {
  const p = player();
  const bearing = Math.atan2(point.x - p.x, point.z - p.z);
  const error = Math.atan2(Math.sin(bearing - p.yaw - p.aim), Math.cos(bearing - p.yaw - p.aim));
  if (Math.abs(error) < .00001) break;
  step(0, Math.max(-1, Math.min(1, error / .045)));
}
const firingPosition = {...player()};
const shotEnd = {...point, y: firingPosition.y + 20};
assert.equal(field.firstSurfaceHit({...firingPosition, y: shotEnd.y}, shotEnd, 1)?.boxId, object().id);
for (let tick = 0; tick < 300 && object().hp > 0; tick++) step(0, 0, true);
assert.equal(object().hp, 0, 'Ordinary shots must destroy a source environment object');
const destroyedAt = object().destroyedAt!;
const hits = events.filter(event => event.type === 'sceneObjectHit' && event.targetId === object().id);
assert(hits.length > 1);
assert.equal(hits.reduce((sum, event) => sum + event.value, 0), 200);
assert.equal(events.filter(event => event.type === 'sceneObjectDestroyed' && event.targetId === object().id).length, 1);
assert.equal(player().score, 0);
assert.equal(player().kills, 0);
assert.equal(player().objectivesDestroyed, 0);
assert.equal(snapshot().match!.objectives.length, 0);
while (now < destroyedAt + 2000) step();
assert.equal(field.firstBoxHit(point, point, 0)?.boxId, object().id);
assert.equal(field.navigation.sample(point.x, point.z)?.valid, false);
step();
assert.notEqual(field.firstBoxHit(point, point, 0)?.boxId, object().id);
assert.equal(field.navigation.sample(point.x, point.z)?.valid, true);
while (snapshot().phase === 'PLAYING') step();
assert.equal(snapshot().match!.result!.reason, 'TIME_LIMIT');
assert(snapshot().match!.result!.players.every(player => player.combatScore === 0));
const final = snapshot();
const frozen = structuredClone(final.match!.result);
step();
assert.deepEqual(snapshot().match!.result, frozen);
world.rematch(joined.playerId, 1);
world.rematch(guest.playerId, 1);
assert.equal(snapshot().phase, 'PLAYING');
assert.equal(snapshot().match!.round, 2);
assert.equal(snapshot().match!.sceneObjects!.length, 34);
assert(snapshot().match!.sceneObjects!.every(object => object.hp === 200 && object.destroyedAt === undefined));
assert.equal(field.firstBoxHit(point, point, 0)?.boxId, object().id);
assert.equal(field.navigation.sample(point.x, point.z)?.valid, false);
world.leave(joined.playerId);
world.leave(guest.playerId);
assert.equal(world.snapshot(joined.roomId), undefined);
assert.equal(field.navigation.sample(point.x, point.z)?.valid, true);
assert.notEqual(field.firstBoxHit(point, point, 0)?.boxId, `ENV:${source.id}`);
writeFileSync(sourceId === '87' ? 'recovery/output/environment-world.json' : `recovery/output/environment-world-${sourceId}.json`, JSON.stringify({status: 'PASS',
  scope: 'World map18 mode4, ordinary movement/aim/fire, simulated clock and 30-second deadline; source/field observed without state injection.',
  sourcePlacementId: source.id, start, firingPosition, hits, destroyedAt,
  destruction: events.filter(event => event.type === 'sceneObjectDestroyed'), final,
  fadeRetainedAt: destroyedAt + 2000, fadeReleasedAt: destroyedAt + 2050,
  rematchRestored: true, departureReleased: true}, null, 2) + '\n');
console.log('PASS: ordinary input destroys map18 source environment object once without score, fade release, natural deadline, rematch and departure');
