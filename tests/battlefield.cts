import {strict as assert} from 'node:assert';
import {getBattlefield, segmentBox} from '../apps/server/src/battlefield';
import {World} from '../apps/server/src/world';
import type {MsgPlayerInput} from '../apps/shared/protocols';
import {writeFileSync} from 'node:fs';

let boxes = 0;
let planes = 0;
for (let map = 1; map <= 25; map++) {
  const field = getBattlefield(map);
  for (const box of field.boxes) {
    const m = box.matrix;
    for (let axis = 0; axis < 3; axis++) {
      assert(Math.abs(Math.hypot(...m.slice(axis * 4, axis * 4 + 3)) - 1) < 0.00001);
    }
    const distance = box.dimensions[0] / 2 + 25;
    const start = {x: m[12] - m[0] * distance, y: m[13] - m[1] * distance,
      z: m[14] - m[2] * distance};
    const end = {x: m[12] + m[0] * distance, y: m[13] + m[1] * distance,
      z: m[14] + m[2] * distance};
    const hit = segmentBox(start, end, box, 20);
    assert(hit !== undefined);
    assert(Math.abs(hit - 5 / (distance * 2)) < 0.00001, `Source box ${map}/${box.id}`);
    boxes++;
    if (box.dimensions.some(value => value === 0)) {
      planes++;
    }
  }
}
assert.equal(boxes, 2058);
assert.equal(planes, 5);

let sourceTime = 1000000;
const world = new World(() => sourceTime, {minPlayers: 2});
function driver(world: World, roomId: string, playerId: string, advance: (ms: number) => void) {
  let sequence = 0;
  const input = (command: Partial<MsgPlayerInput>) => world.updateInput(playerId,
    {sequence: ++sequence, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0, ...command});
  const step = (ms = 50) => {advance(ms); return world.step(ms);};
  const player = () => world.snapshot(roomId)!.players.find(row => row.id === playerId)!;
  const turnTo = (target: number) => {
    for (let tick = 0; tick < 10000; tick++) {
      const difference = Math.atan2(Math.sin(target - player().yaw), Math.cos(target - player().yaw));
      if (Math.abs(difference) < .01) {input({}); return;}
      input({turn: Math.sign(difference)});
      step(10);
    }
    assert.fail('Ordinary short-step turning must reach the target bearing');
  };
  return {input, step, player, turnTo};
}
const room = world.listRooms()[0];
const field = getBattlefield(room.mapId);
const a = world.joinRoom(room.id, 'a', 'A', 1);
const b = world.joinRoom(room.id, 'b', 'B', 1);
world.ready(a.playerId, 1);
world.ready(b.playerId, 1);
const initial = world.snapshot(room.id)!.players.find(player => player.id === a.playerId)!;
assert(Math.abs(initial.x - field.spawns[0].x) < 0.01);
assert(Math.abs(initial.z - field.spawns[0].z) < 0.01);

// Aim at an actual source box within projectile range. The authoritative
// simulation must sweep the shot and emit its impact before crossing the box.
const start = {x: initial.x, y: initial.y + 20, z: initial.z};
const ground = field.firstSurfaceHit({...start, y: start.y + 100}, {...start, y: -20}, 0);
assert(ground && ground.boxId === 'terrain', 'Original terrain triangles must stop downward projectiles');
let angle = 0;
let found = false;
for (let index = 0; index < 72; index++) {
  angle = index * Math.PI / 36;
  const end = {x: start.x + Math.sin(angle) * 500, y: start.y,
    z: start.z + Math.cos(angle) * 500};
  const hit = field.firstBoxHit(start, end, 1);
  if (hit && hit.fraction > 0.1) {
    found = true;
    break;
  }
}
assert(found, 'Need a recovered obstacle near the source spawn');
const control = driver(world, room.id, a.playerId, ms => {sourceTime += ms;});
control.turnTo(angle);
control.input({fire: true});
control.step();
assert(world.snapshot(room.id)!.bullets.length > 0);
control.input({});
let impact;
for (let tick = 0; tick < 40 && !impact; tick++) {
  impact = control.step().events.find(event => event.type === 'terrainHit');
}
assert(impact, 'Projectile must collide with the original map box');
assert(field.boxes.some(box => box.id === impact.targetId),
  'The actual impact must name an original source BOX, rather than terrain');
assert.equal(world.snapshot(room.id)!.bullets.length, 0);

// Source BOX is the projectile surface contract; recovered tank movement
// follows NAV and the constructor footprint. Find a source NAV boundary ahead.
let movementAngle: number | undefined;
let boundaryDistance = Infinity;
for (let index = 0; index < 72; index++) {
  const heading = index * Math.PI / 36;
  const end = {x: initial.x + Math.sin(heading) * 750, z: initial.z + Math.cos(heading) * 750};
  const fraction = field.navigation.firstInvalidFraction(initial, end);
  if (fraction !== undefined && fraction * 750 > 80 && fraction * 750 < boundaryDistance) {
    movementAngle = heading;
    boundaryDistance = fraction * 750;
  }
}
assert(movementAngle !== undefined, 'A source NAV obstacle must be reachable from the ordinary spawn');
control.turnTo(movementAngle);
const movementStart = control.player();
const heading = movementStart.yaw;
const boundary = field.navigation.firstInvalidFraction(movementStart,
  {x: movementStart.x + Math.sin(heading) * 750, z: movementStart.z + Math.cos(heading) * 750});
assert(boundary !== undefined);
control.input({move: 1});
let beforeFinal = movementStart;
for (let tick = 0; tick < 250; tick++) {
  if (tick === 230) beforeFinal = control.player();
  control.step();
  const player = control.player();
  assert(field.navigation.sample(player.x, player.z)?.valid, 'Ordinary tank cannot enter an invalid source NAV cell');
}
const stopped = control.player();
const traveled = Math.hypot(stopped.x - movementStart.x, stopped.z - movementStart.z);
assert(traveled > 1 && traveled <= boundary * 750 + 1,
  'Ordinary movement must advance and stop before the source NAV boundary');
assert(Math.hypot(stopped.x - beforeFinal.x, stopped.z - beforeFinal.z) < .1,
  'Held movement must remain blocked across the final twenty ordinary ticks');
assert(boundary * 750 - traveled < 70, 'Tank must actually approach the NAV obstacle, not stop at an unrelated player');
console.log(`PASS: ${boxes} original OBBs (${planes} zero-width planes), source spawns, authoritative NAV movement and swept BOX projectile impact`);

let time = 1000000;
const combat = new World(() => time, {minPlayers: 2});
const combatRoom = combat.listRooms()[0];
const attacker = combat.joinRoom(combatRoom.id, 'attacker', 'Attacker', 1);
const victim = combat.joinRoom(combatRoom.id, 'victim', 'Victim', 1);
combat.ready(attacker.playerId, 1);
combat.ready(victim.playerId, 1);
const snapshot = () => combat.snapshot(combatRoom.id)!;
const attacking = snapshot().players.find(player => player.id === attacker.playerId)!;
const target = snapshot().players.find(player => player.id === victim.playerId)!;
const bearing = Math.atan2(target.x - attacking.x, target.z - attacking.z);
const attackControl = driver(combat, combatRoom.id, attacker.playerId, ms => {time += ms;});
attackControl.turnTo(bearing);
attackControl.input({fire: true});
let destroyed = false;
for (let tick = 0; tick < 240 && !destroyed; tick++) {
  destroyed = attackControl.step().events.some(event => event.type === 'destroy' && event.targetId === victim.playerId);
}
assert(destroyed, 'Authoritative fire must hit and destroy the enemy on original terrain');
assert.equal(snapshot().players.find(player => player.id === victim.playerId)!.alive, false);
assert.equal(snapshot().players.find(player => player.id === attacker.playerId)!.kills, 1);
attackControl.input({});
let respawned = false;
for (let tick = 0; tick < 70 && !respawned; tick++) {
  respawned = attackControl.step().events.some(event => event.type === 'respawn' && event.playerId === victim.playerId);
}
assert(respawned);
const revived = snapshot().players.find(player => player.id === victim.playerId)!;
assert.equal(revived.alive, true);
assert(field.spawns.some(spawn => Math.hypot(spawn.x - revived.x, spawn.z - revived.z) < 0.02),
  'Respawn must return to a recovered map position');
assert.equal(revived.deaths, 1);
console.log('PASS: authoritative original-map hit, destruction, scoring ownership and recovered-position respawn');

writeFileSync('recovery/output/battlefield-ordinary-input.json', JSON.stringify({status: 'PASS',
  boxes, planes, scope: 'Source BOX projectile sweeps; ordinary short-step yaw, NAV obstacle movement, natural damage/death/scoring/respawn.',
  mapId: room.mapId, movement: {boundaryDistance: boundary * 750, traveled,
    finalMotion: Math.hypot(stopped.x - beforeFinal.x, stopped.z - beforeFinal.z)},
  impact, deathAndRespawn: {kills: snapshot().players.find(row => row.id === attacker.playerId)!.kills, deaths: revived.deaths}
}, null, 2) + '\n');
