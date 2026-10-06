import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {moveRoleThroughNavigation} from '../apps/server/src/battle/roles/movement-wrapper';
import {respawnPlayer} from '../apps/server/src/battle/life';
import type {BattleMovementState} from '../apps/server/src/battle/movement';
import {originalMovementParameters} from '../apps/server/src/battle/movement';
import type {RoleMovementPose} from '../apps/server/src/battle/roles/movement-math';

const source: {rows: {tankId: number; part: number; base: Record<string, number>;
  equipment: Record<string, number>}[]} = JSON.parse(readFileSync(
    'recovery/output/world-role-attributes-native.json', 'utf8'));
const fields = (values: Record<string, number>) => new Map(
  Object.entries(values).map(([key, value]) => [Number(key), value]));
let comparisons = 0, divergentBodyAngles = 0;
for (const row of source.rows.filter(row => row.part === 0)) {
  let now = 100000;
  const world = new World(() => now, {timeLimitSeconds: 2});
  const host = world.createAndJoin(`movement-${row.tankId}`, 4, 7, 'Movement', 'Owner', row.tankId);
  world.bindRoleSources(host.playerId, {base: {name: 'Explicit native pet', fields: fields(row.base)},
    equipment: {name: 'Explicit native tank', fields: fields(row.equipment)}});
  world.ready(host.playerId, 1);
  // Read authoritative state solely to compare the real World step against the
  // already native-verified wrapper. No injected positions, damage or AI input.
  const room = world['rooms'].get(host.roomId)!;
  const player = room.players.get(host.playerId)!;
  assert(player.attributesReady);
  assert.equal(player.movementState, undefined);
  let pose: RoleMovementPose = {position: {x: player.x, y: player.y, z: player.z},
    look: {x: Math.fround(Math.sin(player.yaw)), y: 0, z: Math.fround(Math.cos(player.yaw))},
    forward: {x: Math.fround(Math.sin(player.yaw)), y: 0, z: Math.fround(Math.cos(player.yaw))}};
  let sequence = 0;
  for (const [move, turn, command] of [[0, 1, 3], [1, 1, 6], [1, 0, 1], [-1, 0, 2]] as const) {
    let expected = moveRoleThroughNavigation({...pose, command,
      tankType: player.tank.recomputeBase.tankType as 1 | 2 | 3 | 4,
      move: player.attributes.record.move, turn: player.attributes.record.turn, dt: .05},
      room.battlefield.navigation, {width: 49, depth: 52});
    if (command === 3) {
      // Stationary keyboard steering is an explicit rebuilt mapping; the moving
      // cases below continue to compare against the recovered native wrapper.
      const angle = player.attributes.record.turn * .05;
      const rotate = (direction: RoleMovementPose['look']) => {
        const yaw = Math.atan2(direction.x, direction.z) + angle;
        return {x: Math.sin(yaw), y: 0, z: Math.cos(yaw)};
      };
      expected = {...expected, pose: {...pose, look: rotate(pose.look), forward: rotate(pose.forward)}};
    }
    world.updateInput(host.playerId, {sequence: ++sequence, move, turn, aim: 0,
      fire: false, useItem: 0, clientTime: now});
    now += 50; world.step(50);
    const actual: BattleMovementState = player.movementState!;
    for (const key of ['look', 'forward'] as const) {
      if (command === 3) {
        assert(Math.abs(actual.pose[key].x - expected.pose[key].x) < .000001);
        assert(Math.abs(actual.pose[key].z - expected.pose[key].z) < .000001);
      } else assert.deepEqual(actual.pose[key], expected.pose[key]);
    }
    assert.equal(player.x, expected.pose.position.x);
    assert.equal(player.z, expected.pose.position.z);
    const grounding = room.battlefield.navigation.sample(player.x, player.z)?.height ?? pose.position.y;
    assert.equal(player.y, grounding, 'Explicit rebuilt grounding remains separate from horizontal oracle');
    assert(Math.abs(player.yaw - Math.atan2(expected.pose.look.x, expected.pose.look.z)) < .000001);
    assert(Math.abs(player.bodyYaw! - Math.atan2(expected.pose.forward.x, expected.pose.forward.z)) < .000001);
    const published = world.snapshot(host.roomId)!.players.find(p => p.id === player.id)!;
    assert.equal(published.bodyYaw, Math.round(player.bodyYaw! * 10000) / 10000);
    divergentBodyAngles += Math.abs(player.bodyYaw! - player.yaw) > .001 ? 1 : 0;
    pose = structuredClone(actual.pose);
    comparisons++;
  }
  // Movement denial must not consume the ordinary aiming/firing path.
  player.combat.setFlag(9, 0);
  const before = {x: player.x, z: player.z, yaw: player.yaw, aim: player.aim};
  world.updateInput(host.playerId, {sequence: ++sequence, move: 1, turn: 0,
    aim: 1, fire: true, useItem: 0, clientTime: now});
  now += 50;
  const events = world.step(50).events;
  assert.equal(player.x, before.x); assert.equal(player.z, before.z);
  assert.equal(player.yaw, before.yaw); assert(player.aim > before.aim);
  assert(events.some(event => event.type === 'fire' && event.playerId === player.id));
  player.combat.setFlag(9, 1);
  respawnPlayer(room.battlefield, player, player.hp, {...player.input, move: 0, turn: 0, fire: false});
  assert.equal(player.bodyYaw, undefined); assert.equal(player.movementState, undefined);
  now += 2100; world.step(2100);
  assert.equal(world.snapshot(host.roomId)!.phase, 'FINISHED');
  world.rematch(host.playerId, 1);
  assert.equal(player.bodyYaw, undefined); assert.equal(player.movementState, undefined);
  assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
  world.leave(host.playerId);
}
const incomplete = new World();
const missing = incomplete.createAndJoin('missing-movement', 4, 7, 'Missing', 'Owner', 1);
const missingPlayer = incomplete['rooms'].get(missing.roomId)!.players.get(missing.playerId)!;
const complete = source.rows.find(row => row.tankId === 1 && row.part === 0)!;
incomplete.bindRoleSources(missing.playerId, {base: {name: '', fields: fields(complete.base)},
  equipment: {name: '', fields: fields(complete.equipment)}});
assert(originalMovementParameters(missingPlayer));
incomplete.bindRoleSources(missing.playerId, {base: undefined, equipment: undefined});
assert.equal(originalMovementParameters(missingPlayer), undefined, 'Incomplete source cannot reuse prior native parameters');
incomplete.leave(missing.playerId);
assert(divergentBodyAngles > 0, 'Independent movement/body directions must be exercised');
writeFileSync('recovery/output/world-role-movement.json', JSON.stringify({status: 'PASS',
  tanks: source.rows.filter(row => row.part === 0).length, comparisons, divergentBodyAngles,
  source: 'Explicit full original attribute fixtures, normal World input and actual NAV',
  scope: 'Horizontal integration only: original constructor 49x52, independent vectors, snapshot, permission/free aim/fire, spawn/reset. Rebuilt Y grounding, final dimensions and dynamic OBB remain open.'}, null, 2) + '\n');
console.log(`PASS: ${comparisons} World horizontal wrapper comparisons; source parameters, independent body angle, denial/free aim/fire and life resets`);
