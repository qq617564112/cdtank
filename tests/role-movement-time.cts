import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roleMovementElapsed} from '../apps/server/src/battle/roles/movement-time';
import {World} from '../apps/server/src/world';
const dispatch: {roleRows: {delta: number; calls: {kind: string; arguments: number[]}[]}[]} =
  JSON.parse(readFileSync('recovery/output/movement-dispatch-native.json', 'utf8'));
const wrappers: {rows: {delta: number; attempts: {delta: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/movement-wrapper-native.json', 'utf8'));
for (const row of dispatch.roleRows) {
  const call = row.calls.find(call => call.kind === 'wrapper');
  assert.equal(roleMovementElapsed(row.delta), call
    ? Math.min(call.arguments[7], Math.fround(.2)) : 0);
}
for (const row of wrappers.rows) {
  // Direct wrapper accepts negative dt; formal role433190 rejects it first.
  assert.equal(roleMovementElapsed(row.delta), Math.max(0, row.attempts[0].delta));
}
function move(deltaMs: number) {
  const world = new World(() => 1000000, {minPlayers: 2, timeLimitSeconds: 60});
  const room = world.listRooms().find(room => room.mode === 1)!;
  const a = world.joinRoom(room.id, 'A', 'A', 1);
  const b = world.joinRoom(room.id, 'B', 'B', 1);
  world.ready(a.playerId, 1); world.ready(b.playerId, 1);
  const before = world.snapshot(room.id)!.players.find(player => player.id === a.playerId)!;
  world.updateInput(a.playerId, {sequence: 1, move: 1, turn: 1, aim: 0,
    fire: false, useItem: 0, clientTime: 0});
  world.step(deltaMs);
  const after = world.snapshot(room.id)!.players.find(player => player.id === a.playerId)!;
  return {before: [before.x, before.y, before.z, before.yaw], after: [after.x, after.y, after.z, after.yaw]};
}
const capped = move(200);
assert.notDeepEqual(capped.after, capped.before, 'Fixture must actually move and turn');
assert.deepEqual(move(400), capped, 'A long frame cannot move farther or turn farther than the original upper cap');
assert.deepEqual(move(1500), capped, 'Both original role and wrapper upper clamps must apply');
for (const delta of [0, -50]) {
  const stopped = move(delta);
  assert.deepEqual(stopped.after, stopped.before, 'Nonpositive role movement elapsed must not reverse movement');
}
console.log(`PASS: ${dispatch.roleRows.length} native role time paths, ${wrappers.rows.length} native wrapper caps and actual World short/long/nonpositive movement`);
