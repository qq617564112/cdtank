import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import type {RoomState} from '../apps/server/src/rooms/state';

const world = new World();
const joined = world.createAndJoin('departure-21', 5, 21, 'Departure21', 'Player', 105);
for (let index = 0; index < 3; index++) world.manageCpu(joined.playerId, 1, 'ADD', 1);
world.ready(joined.playerId, 1);
assert.equal(world.snapshot(joined.roomId)?.phase, 'PLAYING');
const rooms = (world as unknown as {rooms: ReadonlyMap<string, RoomState>}).rooms;
const field = rooms.get(joined.roomId)!.battlefield;
const sources = getSceneBreakables(21);
const baseline = createRoomBattlefield(21);
const sample = (source: typeof sources[number]) => {
  const point = {x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
  return {point, nav: baseline.navigation.sample(point.x, point.z), box: baseline.firstBoxHit(point, point, 0)};
};
const baselineSamples = sources.map(sample);
assert(sources.some((source, index) => field.firstBoxHit(baselineSamples[index].point,
  baselineSamples[index].point, 0)?.boxId === `SCN:${source.id}`));
world.leave(joined.playerId);
assert.equal(world.snapshot(joined.roomId), undefined);
for (const {point, nav, box} of baselineSamples) {
  assert.deepEqual(field.navigation.sample(point.x, point.z), nav);
  assert.deepEqual(field.firstBoxHit(point, point, 0), box);
}
writeFileSync('recovery/output/breach21-room-departure.json', JSON.stringify({status: 'PASS',
  scope: 'Ordinary World create/CPU/Ready/last-human Leave; retained field restores original NAV and BOX at all73 placements. No gameplay state writes; not webpage proof.',
  sourcePlacements: sources.length, removedRoom: joined.roomId}, null, 2) + '\n');
console.log('PASS: last human leaves; all73 retained field samples restored to original NAV/BOX');
