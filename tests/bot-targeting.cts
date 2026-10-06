import assert from 'node:assert/strict';
import {Battlefield, getBattlefield, segmentBox} from '../apps/server/src/battlefield';
import {BotController, type BotActor} from '../apps/server/src/battle/cpu/controller';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {getTankConfig} from '../apps/server/src/config';
import {BotPathPlanner} from '../apps/server/src/battle/cpu/navigation';
import type {ObjectiveSnapshot} from '../apps/shared/protocols';

// Flat test NAV uses the actual Battlefield sweep and planner, with no obstacles.
function field(invalidGoal = false): Battlefield {
  const cells = Buffer.alloc(200 * 200 * 8);
  for (let z = 0; z < 200; z++) {
    for (let x = 0; x < 200; x++) {
      const centerX = x * 12 - 1200 + 6, centerZ = z * 12 - 1200 + 6;
      const blocked = invalidGoal && Math.abs(centerX) < 12 && centerZ >= 96 && centerZ < 108;
      cells.writeUInt32LE(blocked ? 0 : 2, (z * 200 + x) * 8 + 4);
    }
  }
  return new Battlefield({id: 'cpu-fixture', terrainTriangles: [], collisionBoxes: [],
    navigationLayers: [{minimum: [-1200, 0, -1200], maximum: [1200, 0, 1200],
      width: 200, height: 200, cells: cells.toString('base64')}],
    respawnGroups: [[{position: [0, 0, 12], heading: 0, slot: 0},
      {position: [0, 0, 24], heading: 0, slot: 1}], []]});
}
function actor(id: string, team: number, z: number): BotActor {
  return {id, team, x: 0, y: 0, z, yaw: 0, aim: 0, alive: true, vip: false,
    tank: {speed: 30, turn: 100}};
}
const arena = field();
const cpu = actor('cpu', 0, 0), ally = actor('ally', 0, 120), enemy = actor('enemy', 1, 240);
const controller = new BotController();
const first = controller.input(cpu, [cpu, ally, enemy], [], arena, 1, 1000, .05);
assert.equal(first.fire, false, 'CPU must not shoot through its teammate');
assert(first.move !== 0 || first.turn !== 0, 'CPU must reposition instead of parking behind its teammate');
let fired = false;
for (let tick = 1; tick <= 400; tick++) {
  const input = controller.input(cpu, [cpu, ally, enemy], [], arena, 1, 1000 + tick * 50, .05);
  assert(Math.abs(input.move) <= 1 && Math.abs(input.turn) <= 1 && Math.abs(input.aim) <= 1);
  cpu.yaw += input.turn * cpu.tank.turn * .12 * .05;
  cpu.aim += input.aim * .9 * .05;
  const reached = arena.move(cpu, {x: cpu.x + Math.sin(cpu.yaw) * input.move * cpu.tank.speed * 6 * .05,
    y: cpu.y, z: cpu.z + Math.cos(cpu.yaw) * input.move * cpu.tank.speed * 6 * .05}, 20);
  Object.assign(cpu, reached);
  if (input.fire) {fired = true; break;}
}
assert(fired, 'CPU must find a clear shot while the teammate stays in place');
assert(Math.abs(cpu.x) > 24, 'CPU should leave the blocked firing line');

const unreachableArena = field(true), seeker = actor('seeker', 0, 0);
const inaccessible = {...actor('inaccessible', 1, 100), y: 100};
const reachable = actor('reachable', 1, 200);
const search = new BotController();
let alternativeShot = false;
for (let tick = 0; tick < 20; tick++) {
  const input = search.input(seeker, [seeker, inaccessible, reachable], [], unreachableArena, 1, 1000 + tick * 50, .05);
  if (input.fire) {alternativeShot = true; break;}
}
assert(alternativeShot, 'A failed route and absent firing positions must allow another enemy');
assert.deepEqual([seeker.x, seeker.y, seeker.z], [0, 0, 0], 'Controller must only emit inputs');
console.log('PASS: CPU repositions around stationary ally and switches from an unreachable enemy using ordinary inputs');

const object: ObjectiveSnapshot = {id: 'barrel', kind: 'DESTROY', x: 0, y: 20, z: 240,
  radius: 20, hp: 200, maxHp: 200, ownerTeam: -1, contested: false};
const destroyer = actor('destroyer', 0, 0), destroy = new BotController();
let repositioned = false;
for (let tick = 0; tick < 140; tick++) {
  const input = destroy.input(destroyer, [destroyer], [object], arena, 5, tick * 50, .05);
  if (input.move !== 0 || input.turn !== 0) {
    repositioned = true;
    // Planning/movement must persist beyond the timeout tick.
    const next = destroy.input(destroyer, [destroyer], [object], arena, 5, (tick + 1) * 50, .05);
    assert(next.move !== 0 || next.turn !== 0);
    break;
  }
}
assert(repositioned, 'Sustained fire without target damage must try a different firing position');
const productive = new BotController();
const damaged = {...object};
for (let tick = 0; tick < 160; tick++) {
  if (tick % 40 === 0) damaged.hp--;
  const input = productive.input(destroyer, [destroyer], [damaged], arena, 5, tick * 50, .05);
  assert(input.fire && input.move === 0 && input.turn === 0,
    'Continued target damage must retain the working firing position');
}
assert.equal(object.hp, 200, 'Controller must not mutate target HP');
console.log('PASS: CPU changes ineffective destroy firing positions and retains damaging ones');

const stalled = new BotController();
const cornerField = getBattlefield(21);
const corner = {...actor('corner', 0, -601.9327906561862), x: -808.2605059974783,
  y: -0.000026176478058914654, yaw: -4.2006017236751765, aim: 6.041059306190954,
  tank: {speed: 3, turn: 7}};
const start = {...corner};
const distant = {...object, id: 'SCN:118', x: 398.6138916015625,
  y: 21.603193283081055, z: -935.5050048828125};
for (let tick = 0; tick < 1000; tick++) {
  const input = stalled.input(corner, [corner], [distant], cornerField, 5, tick * 50, .05);
  corner.yaw += input.turn * corner.tank.turn * .12 * .05;
  corner.aim += input.aim * .9 * .05;
  const reached = cornerField.move(corner, {x: corner.x + Math.sin(corner.yaw) * Math.sign(input.move) * 3 * 6 * .05,
    y: corner.y, z: corner.z + Math.cos(corner.yaw) * Math.sign(input.move) * 3 * 6 * .05}, 20);
  Object.assign(corner, reached);
  if (Math.hypot(corner.x - start.x, corner.z - start.z) > 36) break;
}
assert(Math.hypot(corner.x - start.x, corner.z - start.z) > 36,
  'CPU must escape the observed source-map corner through normal movement and unchanged collision');
console.log('PASS: CPU escapes the observed original0021 collision corner through ordinary inputs');

// Original0020 route: rounding the first bend crosses the collision corner.
const bendField = getBattlefield(20);
const bendActor = {...actor('bend', 0, -1218.4049971582274), x: 957.6515362572053,
  yaw: -59.7995083383524, aim: 53.193712226686415, tank: getTankConfig(1)};
const bendTarget = {...object, id: 'SCN:122', sourcePlacementId: '122',
  x: 837.5186767578125, y: 21.74738121032715, z: -675.0929565429688};
const bendController = new BotController();
const bendRoute = [
  {x: 982.617431640625, y: 0, z: -1224.403564453125},
  {x: 994.617431640625, y: 0, z: -1212.403564453125},
  {x: 1018.617431640625, y: 0, z: -888.403564453125},
];
Object.assign(bendController, {targetId: bendTarget.id, path: bendRoute,
  goal: bendRoute.at(-1), nextPlan: 100000});
for (let tick = 0; tick < 400 && bendActor.z < -1150; tick++) {
  const input = bendController.input(bendActor, [bendActor], [bendTarget], bendField, 5, tick * 50, .05);
  bendActor.yaw += input.turn * bendActor.tank.turn * .12 * .05;
  bendActor.aim += input.aim * .9 * .05;
  Object.assign(bendActor, bendField.move(bendActor, {
    x: bendActor.x + Math.sin(bendActor.yaw) * Math.sign(input.move) * bendActor.tank.speed * 6 * .05,
    y: bendActor.y,
    z: bendActor.z + Math.cos(bendActor.yaw) * Math.sign(input.move) * bendActor.tank.speed * 6 * .05,
  }, 20));
}
assert(bendActor.z > -1150, 'CPU must follow the original0020 bend without cutting the collision corner');
assert.equal(bendTarget.hp, 200);
console.log('PASS: CPU follows the observed original0020 bend through ordinary collision-constrained movement');

// Original0022 observation: this idle search occupied the rest of the match.
const waiting = new BotController();
const waitingActor = {...actor('waiting', 0, 443.39685841035566), x: 229.618679140106,
  y: .000019615879864431918, yaw: 2.864910072170785, aim: 4.8739474770270785};
const waitingTarget = {...object, id: 'SCN:496', sourcePlacementId: '496',
  x: 766.5989379882812, y: 14.908896446228027, z: 505.49078369140625};
const waitingField = getBattlefield(22);
const waitingState = waiting as unknown as {goal?: {x: number; z: number}; planner?: unknown};
waiting.input(waitingActor, [waitingActor], [waitingTarget], waitingField, 5, 0, .05);
const firstGoal = structuredClone(waitingState.goal);
assert(firstGoal);
for (let tick = 1; tick <= 161; tick++) {
  waiting.input(waitingActor, [waitingActor], [waitingTarget], waitingField, 5, tick * 50, .05);
}
assert.equal(waitingState.planner, undefined, 'An idle long search must release the CPU to consider other targets');
for (let tick = 162; tick <= 321; tick++) {
  waiting.input(waitingActor, [waitingActor], [waitingTarget], waitingField, 5, tick * 50, .05);
}
assert(waitingState.goal);
assert.notDeepEqual(waitingState.goal, firstGoal, 'The next attempt must retain the failed approach and try a different position');
assert.deepEqual([waitingActor.x, waitingActor.z], [229.618679140106, 443.39685841035566]);
assert.equal(waitingTarget.hp, 200);
console.log('PASS: CPU bounds the observed original0022 idle search and retries a different firing position');

// Exercise the real World order from an observed original0021 firing pose.
const rotating = new BotController();
const movingShooter = {...actor('moving-shooter', 0, 252.59529146458485),
  x: 773.4534200173288, yaw: -9.408069037061976, aim: .23787689443943041,
  tank: getTankConfig(1)};
const turningTarget = {...object, id: 'SCN:124', sourcePlacementId: '124',
  x: 636.9254760742188, y: 21.603193283081055, z: -416.78228759765625};
const hitBox = getSceneBreakables(21).find(source => source.id === '124')!;
// Retain the recorded approach to reproduce firing while steering its route.
const approachPoint = {x: 636.9254760742188, y: -.00000571954751649173, z: -136.78228759765625};
Object.assign(rotating, {targetId: turningTarget.id, goal: approachPoint,
  path: [approachPoint], nextPlan: 1000000});
let verifiedShots = 0, bodyTurns = 0;
for (let tick = 0; tick < 300; tick++) {
  const input = rotating.input(movingShooter, [movingShooter], [turningTarget], cornerField, 5, tick * 50, .05);
  bodyTurns += Number(input.turn !== 0);
  movingShooter.yaw += input.turn * movingShooter.tank.turn * .12 * .05;
  movingShooter.aim += input.aim * .9 * .05;
  const travel = Math.sign(input.move) * movingShooter.tank.speed * 6 * .05;
  Object.assign(movingShooter, cornerField.move(movingShooter, {
    x: movingShooter.x + Math.sin(movingShooter.yaw) * travel, y: movingShooter.y,
    z: movingShooter.z + Math.cos(movingShooter.yaw) * travel,
  }, 20));
  if (!input.fire) continue;
  const heading = movingShooter.yaw + movingShooter.aim;
  const muzzle = {x: movingShooter.x + Math.sin(heading) * 30, y: movingShooter.y + 20,
    z: movingShooter.z + Math.cos(heading) * 30};
  const end = {x: muzzle.x + Math.sin(heading) * 792, y: muzzle.y,
    z: muzzle.z + Math.cos(heading) * 792};
  const hit = segmentBox(muzzle, end, hitBox, 1);
  const obstruction = cornerField.firstSurfaceHit(muzzle, end, 1);
  assert(hit !== undefined, 'CPU firing after body/turret turn and movement must intersect the actual target');
  assert(!obstruction || hit < obstruction.fraction, 'The target must precede the first real surface impact');
  verifiedShots++;
}
assert(bodyTurns > 0 && verifiedShots > 0, 'The source-map scenario must exercise both steering and actual firing');
console.log(`PASS: ${verifiedShots} CPU shots from the original0021 pose hit the source box after World input order`);

// A source-box hit within the actual projectile lifetime is a valid firing line.
const distantBearing = Math.atan2(turningTarget.x - 773.4534200173288,
  turningTarget.z - 252.59529146458485);
const rangedShooter = {...actor('ranged-shooter', 0, turningTarget.z - Math.cos(distantBearing) * 750),
  x: turningTarget.x - Math.sin(distantBearing) * 750, yaw: distantBearing,
  tank: getTankConfig(1)};
const rangedMuzzle = {x: rangedShooter.x + Math.sin(distantBearing) * 30, y: 20,
  z: rangedShooter.z + Math.cos(distantBearing) * 30};
const rangedEnd = {x: rangedMuzzle.x + Math.sin(distantBearing) * 792, y: 20,
  z: rangedMuzzle.z + Math.cos(distantBearing) * 792};
const rangedHit = segmentBox(rangedMuzzle, rangedEnd, hitBox, 1);
const rangedWall = cornerField.firstSurfaceHit(rangedMuzzle, rangedEnd, 1);
assert(rangedHit !== undefined && (!rangedWall || rangedHit < rangedWall.fraction));
assert(new BotController().input(rangedShooter, [rangedShooter], [turningTarget],
  cornerField, 5, 1000, .05).fire,
  'CPU must use a collision-approved source-box shot at750 instead of rejecting it at700');
console.log('PASS: CPU uses the actual projectile range for a clear original0021 source-box shot');
const shotBlocker = {...actor('shot-blocker', 0, rangedShooter.z + Math.cos(distantBearing) * 300),
  x: rangedShooter.x + Math.sin(distantBearing) * 300};
assert.equal(new BotController().input(rangedShooter, [rangedShooter, shotBlocker],
  [turningTarget], cornerField, 5, 1000, .05).fire, false,
  'A player sphere before the source box must prevent a destroy-object shot');
for (const other of [{...shotBlocker, alive: false}, {...shotBlocker, y: 100},
  {...shotBlocker, x: turningTarget.x + Math.sin(distantBearing) * 80,
    z: turningTarget.z + Math.cos(distantBearing) * 80}]) {
  assert(new BotController().input(rangedShooter, [rangedShooter, other],
    [turningTarget], cornerField, 5, 1000, .05).fire,
    'Dead, vertically separate or behind-target players must not block the object shot');
}
console.log('PASS: CPU destroy shots share the authoritative player-sphere collision and nearest-hit order');

const partners = [0, 1, 2].map(index => ({...actor(`partner-${index}`, 0, 0), cpu: new BotController()}));
const sharedObjectives = [object, {...object, id: 'east', x: 80}, {...object, id: 'west', x: -80}];
for (const partner of partners) partner.cpu.input(partner, partners, sharedObjectives, arena, 5, 1000, .05);
const assignments = partners.map(partner => partner.cpu.objectiveTargetId);
assert.equal(new Set(assignments).size, 3, 'Nearby CPU partners must distribute three living objectives');
const closer = {...object, id: 'closer', z: 120};
for (const partner of partners) partner.cpu.input(partner, partners, [...sharedObjectives, closer], arena, 5, 1050, .05);
assert.deepEqual(partners.map(partner => partner.cpu.objectiveTargetId), assignments,
  'A nearer object must not repeatedly replace an already exclusive task');
partners[0].alive = false;
const replacement = {...actor('replacement', 0, 0), cpu: new BotController()};
replacement.cpu.input(replacement, [...partners, replacement], sharedObjectives, arena, 5, 1100, .05);
assert.equal(replacement.cpu.objectiveTargetId, assignments[0], 'An inactive CPU must not reserve its former target');
for (const partner of partners) partner.alive = true;
for (const partner of partners) partner.cpu.input(partner, partners, [object], arena, 5, 1150, .05);
assert(partners.every(partner => partner.cpu.objectiveTargetId === object.id),
  'When every remaining object is already being handled, CPU partners must be allowed to assist');
assert(sharedObjectives.every(target => target.hp === 200));
assert(partners.every(partner => partner.x === 0 && partner.z === 0));
console.log('PASS: CPU partners distribute objectives, retain exclusive tasks, release inactive claims and assist the last target');

// A slow tank must finish its route to a static object without periodic searches.
const traveller = {...actor('traveller', 0, 0), tank: {speed: 3, turn: 7}};
const travelling = new BotController();
const farObject = {...object, id: 'far-object', z: 1000};
const advance = BotPathPlanner.prototype.advance;
let searches = 0;
BotPathPlanner.prototype.advance = function(...args: Parameters<typeof advance>) {
  searches++;
  return advance.apply(this, args);
};
try {
  for (let tick = 0; tick < 200; tick++) {
    const input = travelling.input(traveller, [traveller], [farObject], arena, 5, tick * 50, .05);
    traveller.yaw += input.turn * traveller.tank.turn * .12 * .05;
    traveller.aim += input.aim * .9 * .05;
    const travel = Math.sign(input.move) * traveller.tank.speed * 6 * .05;
    Object.assign(traveller, arena.move(traveller, {
      x: traveller.x + Math.sin(traveller.yaw) * travel, y: traveller.y,
      z: traveller.z + Math.cos(traveller.yaw) * travel,
    }, 20));
  }
} finally {BotPathPlanner.prototype.advance = advance;}
assert(traveller.z > 100, 'The slow tank must actually follow its route through ordinary movement');
assert.equal(searches, 1, 'A usable route to a static destroy target must survive periodic planning deadlines');
assert.equal(farObject.hp, 200);
console.log('PASS: slow CPU follows a static-object route without restarting successful searches');

// Original0020 wall: the nearer SCN332 needs a detour, SCN320 has a clear shot.
const wallActor = {...actor('wall-actor', 0, -949.9150829763712),
  x: -480.41184256587275, tank: getTankConfig(105)};
const wallField = getBattlefield(20);
const wallTargets = ['332', '320'].map(id => {
  const source = getSceneBreakables(20).find(source => source.id === id)!;
  return {...object, id: `SCN:${id}`, sourcePlacementId: id,
    x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
});
const wallController = new BotController();
wallController.input(wallActor, [wallActor], wallTargets, wallField, 5, 0, .05);
assert.equal(wallController.objectiveTargetId, 'SCN:320',
  'CPU must choose a source-box shot before routing to the closer object behind the original wall');
assert.deepEqual([wallActor.x, wallActor.z], [-480.41184256587275, -949.9150829763712]);
assert(wallTargets.every(target => target.hp === 200));
const wallAlly = {...actor('wall-ally', 0, -949), cpu: {objectiveTargetId: 'SCN:320'}};
const helping = new BotController();
helping.input(wallActor, [wallActor, wallAlly], wallTargets, wallField, 5, 0, .05);
assert.equal(helping.objectiveTargetId, 'SCN:320',
  'A CPU must assist a clear shot rather than remain idle searching for exclusive blocked work');
const openSource = getSceneBreakables(20).find(source => source.id === '327')!;
const openTarget = {...object, id: 'SCN:327', sourcePlacementId: '327',
  x: openSource.matrix[12], y: openSource.matrix[13], z: openSource.matrix[14]};
const independent = new BotController();
independent.input(wallActor, [wallActor, wallAlly], [...wallTargets, openTarget], wallField, 5, 0, .05);
assert.equal(independent.objectiveTargetId, 'SCN:327',
  'Among clear source-box shots the CPU must still prefer a teammate\'s unclaimed target');
const autopilotAlly = {...actor('autopilot-ally', 0, -949), autopilot: {objectiveTargetId: 'SCN:320'}};
const withAutopilotAlly = new BotController();
withAutopilotAlly.input(wallActor, [wallActor, autopilotAlly], [...wallTargets, openTarget], wallField, 5, 0, .05);
assert.equal(withAutopilotAlly.objectiveTargetId, 'SCN:327',
  'A CPU also respects its account-owned autopilot teammate\'s target');
console.log('PASS: CPU chooses the clear original0020 firing line over the nearer blocked target');

// Original0020 six-CPU observation: pending searches repeatedly held this pose.
const pendingActor = {...actor('pending-actor', 0, -1043.8), x: -387.3, tank: getTankConfig(1)};
const pendingStart = {...pendingActor};
const pendingController = new BotController();
const pendingSource = getSceneBreakables(20).find(source => source.id === '292')!;
const pendingTarget = {...object, id: 'SCN:292', sourcePlacementId: '292',
  x: pendingSource.matrix[12], y: pendingSource.matrix[13], z: pendingSource.matrix[14]};
let pendingShots = 0;
for (let tick = 0; tick < 160; tick++) {
  const input = pendingController.input(pendingActor, [pendingActor], [pendingTarget], wallField, 5, tick * 50, .05);
  pendingActor.yaw += input.turn * pendingActor.tank.turn * .12 * .05;
  pendingActor.aim += input.aim * .9 * .05;
  const travel = Math.sign(input.move) * pendingActor.tank.speed * 6 * .05;
  Object.assign(pendingActor, wallField.move(pendingActor, {
    x: pendingActor.x + Math.sin(pendingActor.yaw) * travel, y: pendingActor.y,
    z: pendingActor.z + Math.cos(pendingActor.yaw) * travel,
  }, 20));
  if (input.fire) {
    const heading = pendingActor.yaw + pendingActor.aim;
    const muzzle = {x: pendingActor.x + Math.sin(heading) * 30, y: pendingActor.y + 20,
      z: pendingActor.z + Math.cos(heading) * 30};
    const end = {x: muzzle.x + Math.sin(heading) * 792, y: muzzle.y,
      z: muzzle.z + Math.cos(heading) * 792};
    const hit = segmentBox(muzzle, end, pendingSource, 1);
    const wall = wallField.firstSurfaceHit(muzzle, end, 1);
    assert(hit !== undefined && (!wall || hit < wall.fraction));
    pendingShots++;
  }
}
assert(Math.hypot(pendingActor.x - pendingStart.x, pendingActor.z - pendingStart.z) > 36,
  'The CPU must advance on a collision-approved prefix while the full route is pending');
assert(pendingShots > 0, 'The observed CPU must reach a real source-box firing line through normal movement');
assert.equal(pendingTarget.hp, 200);
console.log('PASS: CPU advances from the original0020 idle-search pose and reaches a source-box shot');
