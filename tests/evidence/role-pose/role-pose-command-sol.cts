import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeRolePoseCommands, dispatchRolePoseCommand, encodeRolePoseCommands,
  rolePoseHalfDegreeVector} from './role-pose-command-sol';
const native = JSON.parse(fs.readFileSync('recovery/output/role-pose-producer-sol-native.json', 'utf8'));
const clock = new DataView(Uint32Array.of(0x87654321).buffer).getFloat32(0, true);
for (const row of native.wireRows) {
  const command = {roleId: 73, command: 5, state: row.state, x: 12.25, z: -9.75,
    lookHalfDegrees: row.look, forwardHalfDegrees: row.forward, clock};
  const payload = encodeRolePoseCommands([command], row.offset);
  assert.equal(Buffer.from(payload).toString('hex'), row.payload);
  assert.deepEqual(decodeRolePoseCommands(payload, row.offset), [command]);
}
for (const row of native.rows) {
  const result = dispatchRolePoseCommand({roleId: 73, command: 5, state: row.messageState,
    x: 12.25, z: -9.75, lookHalfDegrees: 180, forwardHalfDegrees: 360, clock: 0},
  {rolePresent: row.present, actorPresent: true, roleState: row.roleState, roleY: 7, actorTargetBlocked: row.blocked});
  const curve = row.events.find((event: {kind: string}) => event.kind === 'curve');
  assert.equal(result.mode, curve ? 'target' : row.present && row.messageState <= 1 ? 'immediate' : 'none');
  if (curve) assert.deepEqual(result.position, row.target);
  if (result.mode === 'immediate') assert.deepEqual(result.position, row.position);
  const matrix = row.events.find((event: {kind: string}) => event.kind === 'matrix');
  if (matrix) {
    assert.deepEqual(result.position, matrix.position);
    result.forward.forEach((value, index) => assert.ok(Math.abs(value - matrix.forward[index]) < 1e-7));
  }
}
assert.deepEqual(decodeRolePoseCommands(encodeRolePoseCommands([])), []);
const east = rolePoseHalfDegreeVector(0);
assert.deepEqual(east, [1, 0, 0]);
assert.throws(() => decodeRolePoseCommands(new Uint8Array(3)), RangeError);
for (const row of native.anglePoseRows) {
  const vector = rolePoseHalfDegreeVector(row.angle);
  for (const original of [row.forward, row.look]) {
    vector.forEach((value, index) => assert.ok(Math.abs(value - original[index]) < 1e-7));
  }
}

console.log(`PASS ${native.wireRows.length} native codecs, ${native.rows.length} native pose dispatches and ${native.anglePoseRows.length} complete producer angles`);
