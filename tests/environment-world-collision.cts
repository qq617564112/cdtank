import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {segmentBox} from '../apps/server/src/battlefield';

// Only ordinary inputs change the world; source geometry plans a straight approach.
let now = 100000, sequence = 0;
const world = new World(() => now, {minPlayers: 2, timeLimitSeconds: 120});
const joined = world.createAndJoin('collision-owner', 4, 18, '通行验收', 'Shooter', 1);
const guest = world.joinRoom(joined.roomId, 'collision-guest', 'Observer', 1);
world.ready(joined.playerId, 1);
world.ready(guest.playerId, 1);
const sourceId = process.argv[2] ?? '87';
const source = getSceneBreakables(18).find(source => source.id === sourceId)!;
assert(['obj05424', 'obj05442'].includes(source.model));
const snapshot = () => world.snapshot(joined.roomId)!;
const player = () => snapshot().players.find(player => player.id === joined.playerId)!;
const target = () => snapshot().match!.sceneObjects!.find(object => object.sourcePlacementId === source.id)!;
const traces: Array<{stage: string; time: number; x: number; y: number; z: number; yaw: number; hp: number}> = [];
function step(stage: string, move = 0, turn = 0, fire = false): void {
  world.updateInput(joined.playerId, {sequence: ++sequence, move, turn, aim: 0, fire, useItem: 0, clientTime: now});
  now += 50;
  world.step(50);
  const p = player();
  traces.push({stage, time: now, x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: target().hp});
}
function orient(): void {
  for (let tick = 0; tick < 160; tick++) {
    const p = player();
    const bearing = Math.atan2(source.matrix[12] - p.x, source.matrix[14] - p.z);
    const error = Math.atan2(Math.sin(bearing - p.yaw), Math.cos(bearing - p.yaw));
    if (Math.abs(error) < .003) return;
    step('orient', 0, Math.max(-1, Math.min(1, error * 2)));
  }
  throw new Error('Ordinary turn could not align within eight seconds');
}
function approach(stage: string): {x: number; y: number; z: number} {
  orient();
  let unchanged = 0;
  for (let tick = 0; tick < 1000; tick++) {
    const before = {...player()};
    step(stage, 1);
    unchanged = Math.hypot(player().x - before.x, player().z - before.z) < .001 ? unchanged + 1 : 0;
    if (unchanged === 20) return {...player()};
  }
  throw new Error('Approach did not produce a stable collision within fifty seconds');
}
const blocked = approach('intact-approach');
const distance = Math.hypot(blocked.x - source.matrix[12], blocked.z - source.matrix[14]);
assert(distance < 80, `Approach stopped ${distance} units from source box`);
assert.equal(target().hp, 200);
assert.equal(segmentBox({...blocked, y: blocked.y + 20},
  {x: source.matrix[12], y: blocked.y + 20, z: source.matrix[14]}, source, 1) !== undefined, true);
for (let tick = 0; tick < 300 && target().hp > 0; tick++) step('fire', 0, 0, true);
assert.equal(target().hp, 0);
const destroyedAt = target().destroyedAt!;
while (now < destroyedAt + 2000) step('fade', 1);
assert(Math.hypot(player().x - blocked.x, player().z - blocked.z) < .001,
  'Ordinary forward input remains blocked throughout fade including its boundary');
step('fade-release');
let crossed = false;
for (let tick = 0; tick < 120; tick++) {
  step('cleared-crossing', 1);
  const p = player();
  if (segmentBox({...p, y: p.y + 20}, {...p, y: p.y + 20}, source, 0) !== undefined) crossed = true;
}
assert(crossed, 'Ordinary movement must enter the removed source OBB');
const afterCrossing = {...player()};
const forward = {x: source.matrix[12] - blocked.x, z: source.matrix[14] - blocked.z};
assert((afterCrossing.x - source.matrix[12]) * forward.x
  + (afterCrossing.z - source.matrix[14]) * forward.z > 0,
  'Ordinary movement must reach the opposite side of the source centre');
assert.equal(segmentBox({...afterCrossing, y: afterCrossing.y + 20},
  {...afterCrossing, y: afterCrossing.y + 20}, source, 0), undefined,
  'Ordinary movement must exit the removed source OBB on its far side; adjacent intact objects remain solid');
while (snapshot().phase === 'PLAYING') step('deadline');
assert.equal(snapshot().match!.result!.reason, 'TIME_LIMIT');
world.rematch(joined.playerId, 1);
world.rematch(guest.playerId, 1);
assert.equal(snapshot().match!.round, 2);
assert.equal(target().hp, 200);
const restoredBlocked = approach('restored-approach');
assert(Math.hypot(restoredBlocked.x - blocked.x, restoredBlocked.z - blocked.z) < 5);
world.leave(joined.playerId);
world.leave(guest.playerId);
writeFileSync(sourceId === '87' ? 'recovery/output/environment-world-collision.json' : `recovery/output/environment-world-collision-${sourceId}.json`, JSON.stringify({status: 'PASS',
  scope: 'Ordinary World turn/move/fire, original spawn and source OBB, simulated clock with natural120s deadline; no position/health/outcome injection.',
  sourcePlacementId: source.id, blocked, destroyedAt, crossed, afterCrossing, restoredBlocked, traces}, null, 2) + '\n');
console.log('PASS: ordinary movement blocked by intact source environment object, enters cleared source OBB, and blocks again after natural rematch');
