import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {requestRoleFreeFire, encodeRoleFreeFire, decodeRoleFreeFire, ROLE_FREE_FIRE_MESSAGE_TYPE} from '../recovery/evidence/roles/role-free-fire';
const evidence: {rows: {present: boolean; local: boolean; status: 0 | 1 | 2 | 3; stage: number;
  controller: boolean; scene: boolean; count: number; position: number[]; direction: number[]; current: number;
  events: {kind: string; point?: number[]; type?: number; values?: number[]; itemId?: number}[]; specialFlag12: number}[];
  wire: {values: number[]; offset: number; payload: string}[]} = JSON.parse(readFileSync('recovery/output/role-free-fire-native.json', 'utf8'));
for (const row of evidence.rows) {
  const role = createRoleCombatState();
  role.record!.status = row.status;
  role.record!.numericFields!.set(0x44, row.count);
  role.specialFlag12 = 7;
  const before = [...role.record!.numericFields!];
  const events: typeof row.events = [];
  requestRoleFreeFire(row.present ? role : undefined, {local: row.local, stage: row.stage,
    controllerPresent: row.controller, sceneReady: row.scene,
    position: {x: row.position[0], y: row.position[1], z: row.position[2]},
    direction: {x: row.direction[0], y: row.direction[1], z: row.direction[2]}, currentSeconds: row.current}, {
    aim: point => events.push({kind: 'aim', point: [point.x, point.y, point.z]}),
    send: request => events.push({kind: 'send', type: ROLE_FREE_FIRE_MESSAGE_TYPE,
      values: [request.x, request.y, request.z, request.seconds]}),
    fire: () => events.push({kind: 'fire', itemId: 2001}),
  });
  assert.deepEqual(events, row.events);
  assert.equal(role.specialFlag12, row.specialFlag12);
  assert.deepEqual([...role.record!.numericFields!], before);
}
for (const row of evidence.wire) {
  const [x, y, z, seconds] = row.values;
  const request = {x, y, z, seconds};
  assert.equal(Buffer.from(encodeRoleFreeFire(request, row.offset)).toString('hex'), row.payload);
  const decoded = decodeRoleFreeFire(Buffer.from(row.payload, 'hex'), row.offset);
  assert.equal(Buffer.from(encodeRoleFreeFire(decoded, row.offset)).toString('hex'), row.payload);
  assert.deepEqual([decoded.x, decoded.y, decoded.z], [x, y, z]);
}
console.log(`PASS: ${evidence.rows.length} original free-fire gates/float32 requests/no-consumption and ${evidence.wire.length} raw codecs`);
