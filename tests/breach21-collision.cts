import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRoomBattlefield, getBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';

const source = getSceneBreakables(21).find(value => value.id === '63')!;
const first = createRoomBattlefield(21), second = createRoomBattlefield(21), cached = getBattlefield(21);
const point = {x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
const originalCell = first.navigation.sample(point.x, point.z)!;
assert(originalCell.valid);
const id = `SCN:${source.id}`;
const from = {...point, z: point.z - 80}, to = {...point, z: point.z + 80};
first.setDynamicBox({...source, id}, id);
assert.equal(first.navigation.sample(point.x, point.z)!.valid, false);
assert.equal(first.navigation.sample(point.x, point.z)!.fields, originalCell.fields);
assert.equal(first.firstBoxHit(from, to, 1)?.boxId, id);
assert(second.navigation.sample(point.x, point.z)!.valid);
assert(cached.navigation.sample(point.x, point.z)!.valid);
assert.notEqual(second.firstBoxHit(from, to, 1)?.boxId, id);
// Releasing one overlapping instance must retain the other's occupancy.
first.setDynamicBox({...source, id: 'overlap'}, 'overlap');
const revision = first.navigationRevision;
first.setDynamicBox(undefined, id);
assert(first.navigationRevision > revision);
assert(!first.navigation.sample(point.x, point.z)!.valid);
assert.equal(first.firstBoxHit(from, to, 1)?.boxId, 'overlap');
first.setDynamicBox(undefined, 'overlap');
assert.deepEqual(first.navigation.sample(point.x, point.z), originalCell);
assert.notEqual(first.firstBoxHit(from, to, 1)?.boxId, id);
first.setDynamicBox({...source, id}, id);
assert(!first.navigation.sample(point.x, point.z)!.valid);
assert.equal(first.firstBoxHit(from, to, 1)?.boxId, id);
writeFileSync('recovery/output/breach21-collision.json', JSON.stringify({status: 'PASS',
  scope: 'Explicit source geometry fixture: intact collision, overlapping blockers, release/reset, immutable source NAV/BOX and per-room isolation. Not ordinary gameplay or original NAV kernel proof.',
  placement: source.id, originalCell, revision: first.navigationRevision}, null, 2) + '\n');
console.log('PASS: source barrel dynamic ray/NAV overlay, overlap release, room isolation and reset');
