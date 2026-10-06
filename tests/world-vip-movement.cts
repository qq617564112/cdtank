import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {battleMovementPose, originalMovementParameters, predictBattleMovement} from '../apps/server/src/battle/movement';
import {predictControlledBattleMovement} from '../apps/server/src/battle/dynamic-movement';
import {moveRoleThroughNavigation} from '../apps/server/src/battle/roles/movement-wrapper';

interface SourceRow {
  tankId: number;
  part: number;
  base: Record<string, number>;
  equipment: Record<string, number>;
}
interface NativeRow {
  tank: {id: number};
  part: number;
  vip: number;
  vipMultiplier: number;
  base: Record<string, number>;
  equipment: Record<string, number>;
  movement: {selector: number; value: number}[];
}
const sources: {rows: SourceRow[]} = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
const native: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/vip-movement-native.json', 'utf8'));
const rows = sources.rows.filter(row => row.part === 0);
const fields = (values: Record<string, number>) => new Map(Object.entries(values).map(([key, value]) => [Number(key), value]));
function parameters(row: SourceRow) {
  const evidence = native.rows.find(candidate => candidate.tank.id === row.tankId && candidate.part === 0
    && candidate.vip === 1 && candidate.vipMultiplier === 0)!;
  assert(evidence, `Native VIP movement capture for tank ${row.tankId}`);
  assert.deepEqual(evidence.base, row.base);
  assert.deepEqual(evidence.equipment, row.equipment);
  return {speed: evidence.movement.find(value => value.selector === 10)!.value,
    turn: evidence.movement.find(value => value.selector === 11)!.value};
}
function createMatch(row: SourceRow, duration = 120) {
  let now = 100000;
  const world = new World(() => now, {timeLimitSeconds: duration});
  const host = world.createAndJoin(`vip-${row.tankId}`, 3, 2, 'VIP movement', 'Owner', row.tankId);
  const ids = [host.playerId];
  for (let index = 1; index < 4; index++) ids.push(world.joinRoom(host.roomId, `vip-peer-${index}`, 'Peer', row.tankId).playerId);
  for (const id of ids) world.bindRoleSources(id, {base: {name: 'Explicit native pet', fields: fields(row.base)},
    equipment: {name: 'Explicit native tank', fields: fields(row.equipment)}});
  for (const id of ids) world.ready(id, 1);
  const room = world['rooms'].get(host.roomId)!;
  assert.equal(room.phase, 'PLAYING');
  assert.equal([...room.players.values()].filter(player => player.vip).length, 2);
  return {world, room, ids, advance: (milliseconds: number) => {now += milliseconds; return world.step(milliseconds);}, clock: () => now};
}
let comparisons = 0, divergentBodyAngles = 0, translated = 0, rotated = 0;
for (const row of rows) {
  const match = createMatch(row, 2);
  const {world, room, ids} = match;
  const vip = room.players.get(ids[0])!;
  const expectedParameters = parameters(row);
  assert(vip.vip);
  assert.equal(vip.attributesReady, false);
  assert.deepEqual(originalMovementParameters(vip), expectedParameters);
  const fallbackHp = Math.max(1, room.map.vipHp);
  assert.equal(vip.hp, fallbackHp);
  assert.equal(world.snapshot(room.roomId)!.players.find(player => player.id === vip.id)!.maxHp, fallbackHp);
  let sequence = 0;
  for (const [move, turn, command] of [[0, 1, 3], [1, 1, 6], [1, 0, 1], [-1, 0, 2]] as const) {
    const pose = battleMovementPose(vip);
    const expected = moveRoleThroughNavigation({...pose, command,
      tankType: vip.tank.recomputeBase.tankType as 1 | 2 | 3 | 4,
      move: expectedParameters.speed, turn: expectedParameters.turn, dt: .05}, room.battlefield.navigation, {width: 49, depth: 52});
    const before = {x: vip.x, z: vip.z, yaw: vip.yaw};
    world.updateInput(vip.id, {sequence: ++sequence, move, turn, aim: 0, fire: false, useItem: 0, clientTime: match.clock()});
    match.advance(50);
    assert.equal(vip.x, expected.pose.position.x);
    assert.equal(vip.z, expected.pose.position.z);
    assert.deepEqual(vip.movementState!.pose.look, expected.pose.look);
    assert.deepEqual(vip.movementState!.pose.forward, expected.pose.forward);
    assert.equal(vip.yaw, Math.atan2(expected.pose.look.x, expected.pose.look.z));
    assert.equal(vip.bodyYaw, Math.atan2(expected.pose.forward.x, expected.pose.forward.z));
    const published = world.snapshot(room.roomId)!.players.find(player => player.id === vip.id)!;
    assert.equal(published.bodyYaw, Math.round(vip.bodyYaw! * 10000) / 10000);
    translated += Math.hypot(vip.x - before.x, vip.z - before.z) > .05 ? 1 : 0;
    rotated += Math.abs(vip.yaw - before.yaw) > .001 ? 1 : 0;
    divergentBodyAngles += Math.abs(vip.bodyYaw! - vip.yaw) > .001 ? 1 : 0;
    assert.equal(vip.attributesReady, false);
    comparisons++;
  }
  match.advance(2100);
  assert.equal(room.phase, 'FINISHED');
  for (const id of ids) world.rematch(id, 1);
  assert.equal(room.phase, 'PLAYING');
  assert.equal(vip.bodyYaw, undefined);
  assert.equal(vip.movementState, undefined);
  assert.deepEqual(originalMovementParameters(vip), expectedParameters);
  assert.equal(vip.attributesReady, false);
  assert.equal(vip.hp, fallbackHp);
  for (const id of ids) world.leave(id);
}
assert.equal(rows.length, 21);
assert(translated > 0 && rotated > 0 && divergentBodyAngles > 0);

const collisionWitnesses = [];
for (const ownerVip of [true, false]) {
  const match = createMatch(rows[0]);
  const {world, room, ids} = match;
  const owner = room.players.get(ids[ownerVip ? 1 : 2])!;
  const other = room.players.get(ids[ownerVip ? 2 : 1])!;
  assert.equal(owner.vip, ownerVip);
  assert.equal(other.vip, !ownerVip);
  let acceptedMoves = 0, blocked = false;
  for (let tick = 0; tick < 1800; tick++) {
    const bearing = Math.atan2(other.x - owner.x, other.z - owner.z);
    const error = Math.atan2(Math.sin(bearing - owner.yaw), Math.cos(bearing - owner.yaw));
    const input = {sequence: tick + 1, move: Math.abs(error) < .15 ? 1 : 0,
      turn: Math.abs(error) < originalMovementParameters(owner)!.turn * .05 * .5 ? 0 : Math.sign(error),
      aim: 0, fire: false, useItem: 0, clientTime: match.clock()};
    const predicted = predictControlledBattleMovement(owner, input, room.battlefield, room.players.values(), .05)!;
    const navOnly = predictBattleMovement(owner, input, room.battlefield, .05)!;
    const excludingOther = predictControlledBattleMovement(owner, input, room.battlefield,
      [...room.players.values()].filter(player => player.id !== other.id), .05)!;
    const before = {x: owner.x, z: owner.z, yaw: owner.yaw};
    const navTranslates = Math.hypot(navOnly.pose.position.x - before.x, navOnly.pose.position.z - before.z) > .05;
    world.updateInput(owner.id, input);
    match.advance(50);
    assert.equal(owner.x, predicted.pose.position.x);
    assert.equal(owner.z, predicted.pose.position.z);
    assert.equal(owner.yaw, predicted.yaw);
    assert.equal(owner.movementCommand, predicted.command);
    acceptedMoves += Math.hypot(owner.x - before.x, owner.z - before.z) > .05 ? 1 : 0;
    if (predicted.command === 0 && input.move !== 0 && navTranslates && excludingOther.command !== 0) {
      assert.equal(owner.x, before.x);
      assert.equal(owner.z, before.z);
      assert.equal(owner.yaw, before.yaw);
      assert.equal(owner.movementCommand, 0);
      blocked = true;
      collisionWitnesses.push({ownerVip, peerVip: other.vip, tick: tick + 1, acceptedMoves,
        distance: Math.hypot(owner.x - other.x, owner.z - other.z)});
      break;
    }
  }
  assert(blocked && acceptedMoves > 0, `Actual mode3 ordinary approach must meet ${ownerVip ? 'VIP to normal' : 'normal to VIP'} dynamic refusal`);
  for (const id of ids) world.leave(id);
}

// Source rebinding is a preparation API. Scope this lifecycle diagnostic to a
// waiting VIP flag, without replacing source spawn poses or movement inputs.
const lifecycle = new World();
const host = lifecycle.createAndJoin('vip-source-reset', 3, 2, 'VIP sources', 'Owner', rows[0].tankId);
const player = lifecycle['rooms'].get(host.roomId)!.players.get(host.playerId)!;
player.vip = true;
const bind = (row: SourceRow) => lifecycle.bindRoleSources(player.id, {base: {name: 'Explicit native pet', fields: fields(row.base)},
  equipment: {name: 'Explicit native tank', fields: fields(row.equipment)}});
bind(rows[0]);
assert.deepEqual(originalMovementParameters(player), parameters(rows[0]));
lifecycle.bindRoleSources(player.id, {base: undefined, equipment: undefined});
assert.equal(player.recoveredMovement, undefined);
assert.equal(originalMovementParameters(player), undefined);
lifecycle.bindRoleSources(player.id, {base: {name: 'Incomplete pet', fields: new Map([[0, 73], [8, 1]])},
  equipment: {name: 'Explicit native tank', fields: fields(rows[0].equipment)}});
assert.equal(player.recoveredMovement, undefined);
assert.equal(originalMovementParameters(player), undefined);
bind(rows[1]);
assert.deepEqual(originalMovementParameters(player), parameters(rows[1]));
assert.notDeepEqual(parameters(rows[0]), parameters(rows[1]));
assert.equal(player.attributesReady, false);
lifecycle.leave(player.id);
writeFileSync('recovery/output/world-vip-movement.json', JSON.stringify({status: 'PASS', tanks: rows.length,
  comparisons, translated, rotated, divergentBodyAngles, collisionWitnesses,
  source: 'Explicit world-role-attributes-native owned rows; movement compared with complete original433466 VIP selector10/11 captures',
  actualMode3Map2: true, nativeParameterMatch: true, rematchRecompute: true,
  fullAttributesRemainUnready: true, fallbackVipHpPreserved: true,
  sourceLifecycle: 'Preparation API diagnostic with waiting VIP flag: missing/incomplete clears movement; replacement recomputes',
  scope: 'Horizontal original movement and VIP/normal dynamic admission through source spawns and ordinary World inputs. VIP HP multiplier, original final dimensions and vertical postprocessing remain unresolved.'}, null, 2) + '\n');
console.log(`PASS: ${comparisons} real mode3 VIP movement comparisons across ${rows.length} tanks; two VIP/normal dynamic refusal witnesses; source reset and rematch`);
