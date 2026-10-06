import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {Battlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';

let now = 100000;
const world = new World(() => now);
const joined = world.createAndJoin('breach-state', 5, 21, '破坏碰撞', 'AI', 105);
for (let i = 0; i < 3; i++) world.manageCpu(joined.playerId, 1, 'ADD', 1);
world.configureAutopilot(joined.playerId, 1, true);
world.ready(joined.playerId, 1);
// Read-only observation of the actual room field; no position/HP/outcome writes.
const field = (world as unknown as {rooms: ReadonlyMap<string, {battlefield: Battlefield}>})
  .rooms.get(joined.roomId)!.battlefield;
const sources = getSceneBreakables(21);
const timeline = new Map<string, {id: string; destroyedAt: number; blockedDuringFade: boolean;
  released: boolean; walkedThrough: boolean}>();
for (let tick = 0; tick < 3600; tick++) {
  now += 50;
  const events = world.step(50).events;
  const snapshot = world.snapshot(joined.roomId)!;
  for (const event of events.filter(event => event.type === 'objectiveDestroyed')) {
    const objective = snapshot.match!.objectives.find(value => value.id === event.targetId)!;
    assert(objective.hp === 0 && objective.destroyedAt === now);
    timeline.set(objective.sourcePlacementId!, {id: objective.sourcePlacementId!, destroyedAt: now,
      blockedDuringFade: false, released: false, walkedThrough: false});
  }
  for (const row of timeline.values()) {
    const source = sources.find(value => value.id === row.id)!;
    const point = {x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
    const hit = field.firstBoxHit(point, point, 0);
    if (now - row.destroyedAt <= 2000 && hit?.boxId === `SCN:${row.id}`) row.blockedDuringFade = true;
    if (now - row.destroyedAt > 2000 && field.navigation.sample(point.x, point.z)?.valid
        && hit?.boxId !== `SCN:${row.id}`) row.released = true;
    if (row.released && snapshot.players.some(player => Math.hypot(player.x - point.x, player.z - point.z) < 25)) {
      row.walkedThrough = true;
    }
  }
  if (snapshot.phase === 'FINISHED') break;
}
assert(timeline.size > 0);
assert([...timeline.values()].some(row => row.blockedDuringFade && row.released));
assert([...timeline.values()].some(row => row.walkedThrough), 'Ordinary AI must enter a naturally cleared footprint');
world.rematch(joined.playerId, 1);
const reset = world.snapshot(joined.roomId)!;
assert(reset.match!.objectives.every(objective => objective.hp === objective.maxHp && objective.destroyedAt === undefined));
const restored = [...timeline.values()].filter(row => {
  const source = sources.find(value => value.id === row.id)!;
  return !field.navigation.sample(source.matrix[12], source.matrix[14])!.valid;
});
assert(restored.length > 0);
world.leave(joined.playerId);
assert.equal(world.snapshot(joined.roomId), undefined);
writeFileSync('recovery/output/breach21-world.json', JSON.stringify({status: 'PASS',
  scope: 'Ordinary CPU/AI inputs, natural destruction, intact coverage during fade, released NAV/OBB after source lifetime, actual AI movement into cleared footprint, rematch restore and exit. Overlay/kernel and authority remain rebuilt.',
  timeline: [...timeline.values()], restored: restored.length}, null, 2) + '\n');
console.log('PASS: ordinary AI clears source barrels, crosses cleared footprints and restores them on rematch');
