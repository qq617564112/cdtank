import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {BotController, type BotActor} from '../apps/server/src/battle/cpu/controller';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {originalMovementParameters, predictBattleMovement} from '../apps/server/src/battle/movement';
import type {MsgPlayerInput, ObjectiveSnapshot} from '../apps/shared/protocols';

const source: {rows: {tankId: number; part: number; base: Record<string, number>;
  equipment: Record<string, number>}[]} = JSON.parse(readFileSync(
    'recovery/output/world-role-attributes-native.json', 'utf8'));
const row = source.rows.find(row => row.tankId === 1 && row.part === 0)!;
const fields = (values: Record<string, number>) => new Map(
  Object.entries(values).map(([key, value]) => [Number(key), value]));

function fixture(mapId: number) {
  let now = 100000;
  const world = new World(() => now, {timeLimitSeconds: 120, minPlayers: 1});
  const host = world.createAndJoin(`native-steering-${mapId}`, mapId === 20 ? 5 : 4,
    mapId, 'Steering', 'Owner', 1);
  world.bindRoleSources(host.playerId, {base: {name: 'Explicit native pet', fields: fields(row.base)},
    equipment: {name: 'Explicit native owned tank', fields: fields(row.equipment)}});
  world.ready(host.playerId, 1);
  const room = world['rooms'].get(host.roomId)!;
  const player = room.players.get(host.playerId)!;
  const parameters = originalMovementParameters(player)!;
  const navigation = createOriginalBotNavigation(room.battlefield);
  assert.equal(player.autopilot, undefined);
  assert.equal(player.cpu, undefined);
  assert.equal(room.phase, 'PLAYING');
  function captureGoal(bearing: number, distance: number): ObjectiveSnapshot {
    const x = player.x + Math.sin(bearing) * distance, z = player.z + Math.cos(bearing) * distance;
    const cell = room.battlefield.navigation.sample(x, z);
    assert(cell?.valid);
    return {id: 'navigation-fixture', kind: 'CAPTURE', x, y: cell.height, z,
      radius: 20, hp: 0, maxHp: 0, ownerTeam: -1, contested: false};
  }
  function actor(): BotActor {
    return {...player, movement: {...parameters, navigation,
      predict(input: MsgPlayerInput) {
        const predicted = predictBattleMovement(player, input, room.battlefield, .05)!;
        return {...predicted.pose.position, yaw: predicted.yaw};
      }}};
  }
  function step(input: MsgPlayerInput): number {
    const predicted = predictBattleMovement(player, input, room.battlefield, .05)!;
    const before = {x: player.x, z: player.z};
    world.updateInput(host.playerId, input);
    now += 50;
    world.step(50);
    assert.equal(player.x, predicted.pose.position.x);
    assert.equal(player.z, predicted.pose.position.z);
    assert.equal(player.yaw, predicted.yaw);
    assert.deepEqual(player.movementState!.pose.forward, predicted.pose.forward);
    const moved = Math.hypot(player.x - before.x, player.z - before.z);
    assert(moved <= parameters.speed * .05 + .01,
      'A rejected native step or corner retry cannot teleport to a waypoint');
    return moved;
  }
  return {world, host, room, player, parameters, navigation, actor, step,
    captureGoal, now: () => now};
}

// An ordinary map7 spawn has a small route-bearing error below half a native
// turn. Fractions still dispatch full native commands, so twelve forward ticks
// must preserve the nearest body heading instead of alternating full turns.
const straight = fixture(7);
const smallError = straight.parameters.turn * .05 * .25;
const straightGoal = straight.captureGoal(straight.player.yaw + smallError, 300);
assert.deepEqual(findBotPath(straight.room.battlefield, straight.player, straightGoal,
  straight.navigation), [straightGoal]);
const straightController = new BotController();
let straightDistance = Math.hypot(straightGoal.x - straight.player.x, straightGoal.z - straight.player.z);
let straightBodyYaw: number | undefined;
for (let tick = 0; tick < 12; tick++) {
  const actor = straight.actor();
  const input = straightController.input(actor, [actor], [straightGoal],
    straight.room.battlefield, 2, straight.now(), .05);
  assert.equal(input.turn, 0, 'Nearest discrete body heading must stay in the turn deadband');
  assert(input.move > 0);
  assert(straight.step(input) > 7);
  const distance = Math.hypot(straightGoal.x - straight.player.x, straightGoal.z - straight.player.z);
  assert(distance < straightDistance);
  straightDistance = distance;
  if (straightBodyYaw !== undefined) assert.equal(straight.player.bodyYaw, straightBodyYaw);
  straightBodyYaw = straight.player.bodyYaw;
}
straight.world.leave(straight.host.playerId);

// Original0020's natural spawn and this valid NAV endpoint require a route
// around the source wall, with multiple bends. The endpoint is a steering test
// goal; it does not claim a recovered capture placement or original AI policy.
// Collision witness is independent of A*'s wall-clock scheduling: follow the
// direct blocked bearing using ordinary input, rather than requiring a safe
// detour to clip a wall on every machine.
const blocked = fixture(20);
let rejectedOrdinarySteps = 0;
for (let tick = 0; tick < 240; tick++) {
  const bearing = Math.PI / 8;
  const error = Math.atan2(Math.sin(bearing - blocked.player.yaw), Math.cos(bearing - blocked.player.yaw));
  const aligned = Math.abs(error) < blocked.parameters.turn * .05 * .5;
  const input: MsgPlayerInput = {sequence: tick + 1, move: aligned ? 1 : 0,
    turn: aligned ? 0 : Math.sign(error), aim: 0, fire: false, useItem: 0, clientTime: blocked.now()};
  const moved = blocked.step(input);
  if (input.move === 1 && moved < .05) rejectedOrdinarySteps++;
}
assert(rejectedOrdinarySteps > 0, 'Ordinary direct forward steps must be rejected by the actual source wall');
blocked.world.leave(blocked.host.playerId);

const corner = fixture(20);
const {world, host, room, player, parameters, navigation} = corner;
const goal = corner.captureGoal(Math.PI / 8, 720);
const path = findBotPath(room.battlefield, player, goal, navigation);
assert(path.length > 1);
assert.equal(navigation.canTraverse(player, goal), false);
const controller = new BotController();
const initial = {x: player.x, z: player.z, yaw: player.yaw};
const initialDistance = Math.hypot(goal.x - player.x, goal.z - player.z);
let movedTicks = 0, stationaryTurns = 0, rejected = 0, deadband = 0;
for (let tick = 0; tick < 1200; tick++) {
  const actor = corner.actor();
  const input = controller.input(actor, [actor], [goal], room.battlefield, 2, corner.now(), .05);
  const straight = predictBattleMovement(player, {...input, move: 1, turn: 0}, room.battlefield, .05)!;
  rejected += Math.hypot(straight.pose.position.x - player.x, straight.pose.position.z - player.z) < .05 ? 1 : 0;
  const moved = corner.step(input);
  movedTicks += moved > .05 ? 1 : 0;
  stationaryTurns += moved < .05 && input.turn !== 0 ? 1 : 0;
  deadband += input.move > 0 && input.turn === 0 ? 1 : 0;
}
const finalDistance = Math.hypot(goal.x - player.x, goal.z - player.z);
assert(finalDistance < goal.radius * .45, 'Ordinary native inputs must finish the route around the actual source wall');
assert(movedTicks > 100);
assert(stationaryTurns > 0, 'The route must exercise body alignment at corners');
assert(rejectedOrdinarySteps > 0, 'The separate ordinary-input wall witness must remain rejected');
assert(deadband > 0);
console.log(JSON.stringify({source: 'world-role-attributes-native.json tank1 part0; actual map7/map20 NAV',
  straightTicks: 12, initial, goal, parameters, initialDistance, finalDistance,
  pathWaypoints: path.length, movedTicks, stationaryTurns, rejected, rejectedOrdinarySteps, deadband}));
world.leave(host.playerId);
console.log('PASS: native CPU turn deadband and source-wall steering use ordinary World inputs, preserve collision rejection, and finish the route');
