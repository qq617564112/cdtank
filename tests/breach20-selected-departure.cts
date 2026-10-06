import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import type {RoomState} from '../apps/server/src/rooms/state';

const world = new World();
const joined = world.createAndJoin('departure-20', 5, 20, 'Departure20', 'Player', 105);
for (let index = 0; index < 3; index++) world.manageCpu(joined.playerId, 1, 'ADD', 1);
world.ready(joined.playerId, 1);
assert.equal(world.snapshot(joined.roomId)?.phase, 'PLAYING');
const field = (world as unknown as {rooms: ReadonlyMap<string, RoomState>})
  .rooms.get(joined.roomId)!.battlefield;
const baseline = createRoomBattlefield(20);
const sources = getSceneBreakables(20).filter(s => ['obj05460', 'obj05461', 'obj05462', 'obj05442'].includes(s.model));
const samples = sources.map(source => {
  const point = {x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
  return {id: `SCN:${source.id}`, model: source.model, point,
    navigation: baseline.navigation.sample(point.x, point.z),
    box: baseline.firstBoxHit(point, point, 0)};
});
for (const row of samples) {
  assert.equal(field.firstBoxHit(row.point, row.point, 0)?.boxId, row.id);
  assert.equal(field.navigation.sample(row.point.x, row.point.z)?.valid, false);
}
assert(samples.some(row => row.model === 'obj05461'));
assert(samples.some(row => row.model === 'obj05462'));
assert(samples.some(row => row.model === 'obj05442'));
world.leave(joined.playerId);
assert.equal(world.snapshot(joined.roomId), undefined);
for (const row of samples) {
  assert.deepEqual(field.navigation.sample(row.point.x, row.point.z), row.navigation);
  assert.deepEqual(field.firstBoxHit(row.point, row.point, 0), row.box);
}
writeFileSync('recovery/output/breach20-selected-departure.json', JSON.stringify({status: 'PASS',
  scope: 'Ordinary World create/CPU/Ready installs selected0020 obj05460+05461+05462+05442 coverage; last-human Leave restores original NAV/BOX. No gameplay state writes; not webpage evidence.',
  placements: samples.map(row => ({id: row.id, model: row.model}))}, null, 2) + '\n');
console.log(`PASS: selected0020 coverage and last-human departure (${samples.length} placements)`);
