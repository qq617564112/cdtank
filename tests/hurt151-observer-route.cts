import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {Battlefield, Point} from '../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';

// Simulated World route fixture; only normal inputs move actors. No browser evidence.
let now = 100000, sequence = 0;
const world = new World(() => now);
const host = world.createAndJoin('hurt151-host', 4, 7, '近观151', 'Host', 151);
const guest = world.joinRoom(host.roomId, 'hurt151-observer', 'Observer', 1);
world.joinRoom(host.roomId, 'hurt151-aux1', 'Aux1', 1);
world.joinRoom(host.roomId, 'hurt151-aux2', 'Aux2', 1);
for (const p of world.snapshot(host.roomId)!.players) world.ready(p.id, 1);
const snapshot = () => world.snapshot(host.roomId)!;
const player = () => snapshot().players.find(p => p.id === guest.playerId)!;
const observed = snapshot().players.find(p => p.id === host.playerId)!;
const start = {...player()};
const field = (world as unknown as {rooms: ReadonlyMap<string, {battlefield: Battlefield}>})
  .rooms.get(host.roomId)!.battlefield;
const nav = createOriginalBotNavigation(field);
const policy = {cacheKey: 'hurt151-observer-nav-box', canTraverse: (a: Point, b: Point) => {
  if (!nav.canTraverse(a, b)) return false;
  const moved = field.move(a, b, 26);
  return Math.hypot(moved.x - b.x, moved.z - b.z) < .01;
}};
const goal = {x: observed.x + 80, y: observed.y, z: observed.z};
const waypoints = findBotPath(field, start, goal, policy);
assert(waypoints.length > 0);
const traces: Array<{time: number; x: number; y: number; z: number; yaw: number; move: number; turn: number}> = [];
for (const waypoint of waypoints) {
  for (let tick = 0; tick < 400; tick++) {
    const p = player();
    if (Math.hypot(waypoint.x - p.x, waypoint.z - p.z) < 4) break;
    const bearing = Math.atan2(waypoint.x - p.x, waypoint.z - p.z);
    const error = Math.atan2(Math.sin(bearing - p.yaw), Math.cos(bearing - p.yaw));
    const move = Math.abs(error) < .02 ? 1 : 0;
    const turn = move ? 0 : Math.max(-1, Math.min(1, error * 2));
    world.updateInput(guest.playerId, {sequence: ++sequence, move, turn, aim: 0, fire: false,
      useItem: 0, clientTime: now});
    now += 50;
    world.step(50);
    const next = player();
    if (move) assert.equal(field.firstBoxHit({...p, y: p.y + 20}, {...next, y: next.y + 20}, 20), undefined,
      'Actual ordinary movement must not cross a source obstacle');
    traces.push({time: now, x: next.x, y: next.y, z: next.z, yaw: next.yaw, move, turn});
    assert(tick < 399, 'Observer ordinary input must reach waypoint within twenty seconds');
  }
}
const final = {...player()};
const distance = Math.hypot(final.x - observed.x, final.z - observed.z);
assert(distance >= 60 && distance <= 100);
assert.equal(field.firstSurfaceHit({...final, y: final.y + 20}, {...observed, y: observed.y + 20}, 1), undefined);
assert(snapshot().players.every(p => p.score === 0 && p.kills === 0 && p.alive));
writeFileSync('recovery/output/hurt151-observer-route.json', JSON.stringify({status: 'PASS',
  scope: 'Simulated World map7 initial P1/P2 source spawns, original NAV plus BOX planning and ordinary move/turn; not browser combat or visual readability proof.',
  start, observed, goal, waypoints, final, distance, unobstructed: true, traces}, null, 2) + '\n');
console.log('PASS: observer ordinary input reaches unobstructed 60–100-unit position near initial151 without crossing source obstacles');
