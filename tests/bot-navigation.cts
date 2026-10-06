import assert from 'node:assert/strict';
import {getBattlefield} from '../apps/server/src/battlefield';
import {findBotPath, BotPathPlanner} from '../apps/server/src/battle/cpu/navigation';
const field = getBattlefield(7);
for (const index of [0, 2]) {
  let position = field.spawn(index);
  const path = findBotPath(field, position, {x: -144, y: .32, z: 240});
  assert(path.length);
  for (const waypoint of path) {
    const moved = field.move(position, waypoint, 20);
    assert(Math.hypot(moved.x - waypoint.x, moved.z - waypoint.z) < .01);
    position = {...moved, yaw: position.yaw};
  }
}
assert.deepEqual(findBotPath(field, field.spawn(0), {x: 1e6, y: 0, z: 1e6}), []);
console.log('PASS: CPU routes use source NAV/static collision, every segment traversable, invalid goal refused');

// Incremental planning must produce the same traversable result as the helper.
const complex = getBattlefield(2);
const start = complex.spawn(0), goal = complex.spawn(6);
const planner = new BotPathPlanner(complex, start, goal);
let path: ReturnType<typeof findBotPath> | undefined;
let advances = 0;
while (path === undefined && advances++ < 50000) path = planner.advance(1, 1000);
assert(path !== undefined);
assert.deepEqual(path, findBotPath(complex, start, goal));
assert(advances > 1, 'Complex source map search must be resumable over multiple advances');
console.log(`PASS: resumable CPU route ${advances} advances matches complete route`);

// Original0020 observed pose: 24-step ticks cannot finish this detour before
// the controller's 160-tick search timeout, even without wall-clock overhead.
const detourField = getBattlefield(20);
const detourStart = {x: -387.3, y: 0, z: -1043.8};
const detourGoal = {x: -87.50240094869972, y: 0, z: -687.0823872672229};
const detour = new BotPathPlanner(detourField, detourStart, detourGoal);
let detourPath: ReturnType<typeof findBotPath> | undefined;
let detourAdvances = 0;
while (detourPath === undefined && detourAdvances++ < 160) detourPath = detour.advance(256, 1000);
assert(detourPath?.length, 'The expansion cap must allow the observed detour within 160 advances');
assert.deepEqual(detourPath, findBotPath(detourField, detourStart, detourGoal));
let detourPosition = detourStart;
for (const waypoint of detourPath) {
  const reached = detourField.move(detourPosition, waypoint, 20);
  assert(Math.hypot(reached.x - waypoint.x, reached.z - waypoint.z) < .01);
  detourPosition = reached;
}
console.log(`PASS: original0020 detour completes in ${detourAdvances} 256-step advances, every segment collision-approved; wall-clock budget verified separately`);
