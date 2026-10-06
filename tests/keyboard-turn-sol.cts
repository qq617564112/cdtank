import assert from 'node:assert/strict';
import {turnStationaryRolePose} from '../apps/server/src/battle/roles/keyboard-turn';
import type {RoleMovementPose} from '../apps/server/src/battle/roles/movement-math';
const yaw = (v: {x: number; z: number}) => Math.atan2(v.x, v.z);
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const vector = (angle: number) => ({x: Math.fround(Math.sin(angle)), y: 0, z: Math.fround(Math.cos(angle))});
const source: RoleMovementPose = {position: {x: 81.23456789, y: 7, z: -145.123456789},
  look: vector(-1.2), forward: vector(-1.8405)};
const preserved = structuredClone(source);
const turn = Math.fround(0.6806783676147461);
for (const input of [-1, 1]) {
  for (const seconds of [.05, .15, .2, .6]) {
    const result = turnStationaryRolePose(source, input, turn, seconds);
    const expectedAngle = input * turn * Math.min(seconds, .2);
    assert.deepEqual(result.position, source.position);
    for (const direction of ['look', 'forward'] as const) {
      const measured = angleDifference(yaw(result[direction]), yaw(source[direction]));
      assert(Math.abs(measured - expectedAngle) < .0000002);
    }
    assert(Math.abs(angleDifference(yaw(result.look), yaw(result.forward))
      - angleDifference(yaw(source.look), yaw(source.forward))) < .0000002);
  }
  let result = source;
  for (let tick = 0; tick < 20; tick++) result = turnStationaryRolePose(result, input, turn, .05);
  assert(Math.abs(angleDifference(yaw(result.forward), yaw(source.forward)) - input * turn) < .000001);
}
for (const seconds of [-.1, 0]) assert.deepEqual(turnStationaryRolePose(source, 1, turn, seconds), source);
assert.deepEqual(turnStationaryRolePose(source, 0, turn, .05), source);
assert.deepEqual(source, preserved);
// Normal held A/D repeatedly reaches the cardinal axes sampled by NAV acos(z).
let continuous = source;
for (let tick = 0; tick < 2000; tick++) {
  continuous = turnStationaryRolePose(continuous, 1, turn, .05);
  for (const direction of [continuous.look, continuous.forward]) {
    assert(direction.x >= -1 && direction.x <= 1);
    assert(direction.z >= -1 && direction.z <= 1);
    assert(Number.isFinite(Math.acos(direction.z)));
  }
}
console.log('PASS: stationary A/D rotates actual body and travel reference at computed turn, preserves angle difference/position, respects original elapsed gate/cap');
