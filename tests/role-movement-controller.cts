import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRoleControllerMovementAllowed, type RoleMovementCollider} from '../apps/server/src/battle/roles/movement-controller';
import type {RoleObb} from '../apps/server/src/battle/roles/obb-intersection';

function box(x = 0, z = 0, yaw = 0): RoleObb {
  const c = Math.fround(Math.cos(yaw)), s = Math.fround(Math.sin(yaw));
  return {matrix: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, 0, z, 1], dimensions: [49, 24, 52]};
}
interface Row {name: string; result: number; map_present: boolean; status: number;
  same_id: boolean; position: [number, number]; static_count: number; candidate: boolean;
  shift: number; static_x: number; yaw: number; notifications: unknown[]; diagnostics: number;
  predictions: {role: number; command: number; dt: number}[];}
const source: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/movement-controller-native.json', 'utf8'));
for (const row of source.rows) {
  const predictions: {role: number; command: number; dt: number}[] = [];
  const collider = (id: number, x: number, z: number, yaw: number, status: number,
    address: number, shift: number): RoleMovementCollider => ({id, x, z, status, command: 4,
    currentObb: box(x, z, yaw), predictObb: (command, dt) => {
      predictions.push({role: address, command, dt});
      return box(x + shift, z, yaw);
    }});
  const role = collider(1, 0, 0, 0, 2, 0x2002000, row.shift);
  const other = collider(row.same_id ? 1 : 2, ...row.position, row.yaw, row.status, 0x2003000, 0);
  const notices: number[] = [], diagnostics: number[] = [];
  const result = isRoleControllerMovementAllowed(role, 3, row.candidate ? [other] : [],
    Array.from({length: row.static_count}, () => ({obb: box(row.static_x), notify: (type: 100) => notices.push(type)})),
    row.map_present, count => diagnostics.push(count));
  assert.equal(Number(result), row.result, row.name);
  assert.deepEqual(predictions, row.predictions.map(({role, command, dt}) => ({role, command, dt})), row.name);
  assert.equal(notices.length, row.notifications.length, row.name);
  assert(notices.every(type => type === 100));
  assert.equal(diagnostics.length, row.diagnostics, row.name);
}
const chained: {controller_rows: {name: string; result: number; obb: {left: number[]; right: number[]}[];
  matrices: {position: number[]}[]; predictions: {command: number}[]}[]} = JSON.parse(
  readFileSync('recovery/output/movement-prediction-native.json', 'utf8'));
for (const row of chained.controller_rows) {
  const from = (values: number[]): RoleObb => ({matrix: values.slice(0, 16),
    dimensions: values.slice(16) as [number, number, number]});
  const collision = row.obb[0];
  const role: RoleMovementCollider = {id: 1, status: 2, x: 200, z: 200, command: 0,
    currentObb: box(), predictObb: () => from(collision.left)};
  const other: RoleMovementCollider = {id: 2, status: 2, x: row.matrices[1].position[0], z: 200,
    command: row.predictions[1].command as RoleMovementCollider['command'],
    currentObb: box(), predictObb: () => from(collision.right)};
  assert.equal(Number(isRoleControllerMovementAllowed(role,
    row.predictions[0].command as RoleMovementCollider['command'], [other], [], true, () => {})), row.result, row.name);
}
// Stop at first dynamic blocker; native static notifications are not emitted on rejection.
let notified = false;
const same: RoleMovementCollider = {id: 1, status: 2, x: 0, z: 0, command: 1,
  currentObb: box(), predictObb: () => box()};
assert.equal(isRoleControllerMovementAllowed(same, 1, [{...same, id: 2}],
  [{obb: box(), notify: () => {notified = true;}}], false, () => {}), false);
assert.equal(notified, false);
console.log(`PASS: ${source.rows.length} original controller decisions/dispatch/notifications and ${chained.controller_rows.length} full native predictor+OBB outputs; ordered early return`);
