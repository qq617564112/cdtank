import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {originalMovementParameters} from '../apps/server/src/battle/movement';

const evidence: {rows: {tankId: number; part: number; base: Record<string, number>;
  equipment: Record<string, number>}[]} = JSON.parse(readFileSync(
  'recovery/output/world-role-attributes-native.json', 'utf8'));
const row = evidence.rows.find(value => value.tankId === 1 && value.part === 0)!;
const fields = (values: Record<string, number>) => new Map(
  Object.entries(values).map(([key, value]) => [Number(key), value]));
const full = () => ({base: {name: 'Explicit native pet fixture', fields: fields(row.base)},
  equipment: {name: 'Explicit native tank fixture', fields: fields(row.equipment)}});
let now = 100000;
const world = new World(() => now);
const host = world.createAndJoin('authority-source-gate', 4, 7, 'Movement', 'Owner', 1);
world.bindRoleSources(host.playerId, full());
world.ready(host.playerId, 1);
const player = world['rooms'].get(host.roomId)!.players.get(host.playerId)!;
let sequence = 0;
const step = (move: number, turn: number) => {
  world.updateInput(host.playerId, {sequence: ++sequence, move, turn, aim: 1,
    fire: false, useItem: 0, clientTime: now});
  now += 50;
  world.step(50);
};
const pose = () => ({x: player.x, y: player.y, z: player.z,
  yaw: player.yaw, bodyYaw: player.bodyYaw});
const sparse = full();
for (const offset of [0x2c, 0x34, 0x3c]) sparse.base.fields.delete(offset);
for (const offset of [0x3c, 0x40, 0x4c, 0x50]) sparse.equipment.fields.delete(offset);
world.bindRoleSources(host.playerId, sparse);
assert.equal(player.attributesReady, false);
assert(originalMovementParameters(player));
const initial = pose();
step(1, 0);
assert(Math.hypot(player.x - initial.x, player.z - initial.z) > 0,
  'Independent qualified movement must execute without HP/armor readiness');

let deniedSteps = 0;
for (const kind of ['missing34', 'withdrawal', 'mismatch'] as const) {
  const sources = full();
  if (kind === 'missing34') sources.equipment.fields.delete(0x34);
  if (kind === 'mismatch') sources.equipment.fields.set(0x24, 3);
  world.bindRoleSources(host.playerId, kind === 'withdrawal'
    ? {base: undefined, equipment: undefined} : sources);
  assert.equal(originalMovementParameters(player), undefined);
  for (const [move, turn] of [[1, 0], [-1, 0], [0, 1], [1, 1]]) {
    const before = pose();
    const aim = player.aim;
    step(move, turn);
    assert.deepEqual(pose(), before, `${kind}: authority must not use TankConfig movement`);
    assert(player.aim > aim, 'Independent rebuilt aim remains available');
    deniedSteps++;
  }
}
world.bindRoleSources(host.playerId, full());
const restored = pose();
step(1, 0);
assert(Math.hypot(player.x - restored.x, player.z - restored.z) > 0,
  'Restoring actual sources restores authoritative movement');
world.leave(host.playerId);
writeFileSync('recovery/output/tank-movement-authority-qualification.json', JSON.stringify({
  status: 'PASS_WORLD_RULE_SCOPE_ONLY', deniedSteps,
  scope: 'Tank1/part0 native source fixture; ordinary World input and stepping. Independent sparse movement, missing +34, withdrawal, mismatched ownership, rebuilt aim and restored movement. No purchased/network claim.'
}, null, 2) + '\n');
console.log(`PASS: ${deniedSteps} unqualified authority steps remain stationary; qualified sparse and restored movement execute`);
