import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {Battlefield, Point} from '../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';

let now = 100000, sequence = 0;
const world = new World(() => now, {timeLimitSeconds: 300});
const host = world.createAndJoin('route-host', 4, 18, '桶路线', 'Host', 1);
const guest = world.joinRoom(host.roomId, 'route-guest', 'Guest', 1);
world.joinRoom(host.roomId, 'route-aux1', 'Aux1', 1);
world.joinRoom(host.roomId, 'route-aux2', 'Aux2', 1);
for (const p of world.snapshot(host.roomId)!.players) world.ready(p.id, 1);
const snapshot = () => world.snapshot(host.roomId)!;
const player = () => snapshot().players.find(p => p.id === guest.playerId)!;
const field = (world as unknown as {rooms: ReadonlyMap<string, {battlefield: Battlefield}>})
  .rooms.get(host.roomId)!.battlefield;
const original = createOriginalBotNavigation(field);
const policy = {cacheKey: 'barrel-route-nav-and-box26', canTraverse: (a: Point, b: Point) => {
  if (!original.canTraverse(a, b)) return false;
  const moved = field.move(a, b, 26);
  return Math.hypot(moved.x - b.x, moved.z - b.z) < .01;
}};
const start = {...player()};
const goal = {x: 380, y: 0, z: -910};
const waypoints = findBotPath(field, start, goal, policy);
const traces: Array<{time: number; x: number; z: number; yaw: number; waypoint: number}> = [];
let failure = '', waypoint = 0;
if (!waypoints.length) failure = 'No NAV plus26-radius BOX path from guest original spawn to approach goal';
for (; waypoint < waypoints.length && !failure; waypoint++) {
  const goal = waypoints[waypoint];
  let stuck = 0;
  for (let tick = 0; tick < 600; tick++) {
    const p = player();
    if (Math.hypot(goal.x - p.x, goal.z - p.z) < 7) break;
    const bearing = Math.atan2(goal.x - p.x, goal.z - p.z);
    const error = Math.atan2(Math.sin(bearing - p.yaw), Math.cos(bearing - p.yaw));
    const moving = Math.abs(error) < .035;
    world.updateInput(guest.playerId, {sequence: ++sequence, move: moving ? 1 : 0,
      turn: moving ? 0 : Math.max(-1, Math.min(1, error * 2)), aim: 0, fire: false, useItem: 0, clientTime: now});
    now += 50;
    world.step(50);
    const next = player();
    traces.push({time: now, x: next.x, z: next.z, yaw: next.yaw, waypoint});
    stuck = moving && Math.hypot(next.x - p.x, next.z - p.z) < .001 ? stuck + 1 : 0;
    if (stuck > 30 || tick === 599) {failure = `Ordinary guest stalled at waypoint${waypoint} (${next.x},${next.z})`; break;}
  }
}
const final = {...player()};
const barrel = snapshot().match!.sceneObjects!.find(o => o.sourcePlacementId === '43')!;
const visible = field.firstSurfaceHit({...final, y: final.y + 20}, {...barrel, y: final.y + 20}, 1)?.boxId === barrel.id;
if (!failure && !visible) failure = 'Reached planned approach but original wall still occludes source43';
let stopped = 0;
for (let tick = 0; tick < 300 && !failure; tick++) {
  const p = player();
  const error = Math.atan2(Math.sin(Math.atan2(barrel.x - p.x, barrel.z - p.z) - p.yaw),
    Math.cos(Math.atan2(barrel.x - p.x, barrel.z - p.z) - p.yaw));
  const moving = Math.abs(error) < .02;
  world.updateInput(guest.playerId, {sequence: ++sequence, move: moving ? 1 : 0,
    turn: moving ? 0 : Math.max(-1, Math.min(1, error * 2)), aim: 0, fire: false, useItem: 0, clientTime: now});
  now += 50;
  world.step(50);
  const next = player();
  traces.push({time: now, x: next.x, z: next.z, yaw: next.yaw, waypoint});
  stopped = moving && Math.hypot(next.x - p.x, next.z - p.z) < .001 ? stopped + 1 : 0;
  if (stopped >= 20) break;
}
const blocked = {...player()};
if (!failure && stopped < 20) failure = 'Source43 approach did not reach stable ordinary collision';
writeFileSync('recovery/output/environment-barrel-route.json', JSON.stringify({status: failure ? 'BLOCKED' : 'PASS',
  scope: 'Readonly original NAV plus26-radius BOX planning, four ordinary humans, guestP2 original spawn, normal turn/forward inputs; no state injection.',
  start, goal, waypoints, final, blocked, visible, failure, traces}, null, 2) + '\n');
assert.equal(failure, '');
console.log('PASS: guest ordinary inputs follow source NAV/BOX waypoints to visible source43 approach');
