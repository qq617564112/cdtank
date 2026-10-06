import assert from 'node:assert/strict';
import {Battlefield, type Point} from '../apps/server/src/battlefield';
import {BotPathPlanner, findBotPath, type BotNavigationPolicy} from '../apps/server/src/battle/cpu/navigation';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {ORIGINAL_MOVEMENT_DIMENSIONS} from '../apps/server/src/battle/movement';
import {sampleRoleNavigation} from '../apps/server/src/battle/roles/movement-navigation';

function arena(wideOpening = false, collisionWall = false): Battlefield {
  const width = 60, height = 60, minimum = -360;
  const cells = Buffer.alloc(width * height * 8);
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const centerX = minimum + x * 12 + 6, centerZ = minimum + z * 12 + 6;
      const opening = centerX >= 0 && centerX < 24
        || wideOpening && centerX >= 144 && centerX < 252;
      const blocked = !collisionWall && centerZ >= -36 && centerZ < 36 && !opening;
      cells.writeUInt32LE(blocked ? 0 : 2, (z * width + x) * 8 + 4);
    }
  }
  const box = (id: string, z: number, depth: number) => ({id,
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 40, z, 1],
    dimensions: [24, 200, depth]});
  return new Battlefield({id: 'original-cpu-navigation', terrainTriangles: [],
    collisionBoxes: collisionWall ? [box('south', -180, 360), box('north', 192, 336)] : [],
    navigationLayers: [{minimum: [minimum, 0, minimum], maximum: [360, 0, 360],
      width, height, cells: cells.toString('base64')}], respawnGroups: [[], []]});
}

// Verify returned routes against the recovered movement sampler independently
// of the policy and planner. The planner aligns the body to each segment.
function verifyOriginalRoute(field: Battlefield, start: Point, path: Point[],
  policy: BotNavigationPolicy): void {
  let previous = start;
  for (const waypoint of path) {
    assert(policy.canTraverse(previous, waypoint), 'Every simplified route segment must pass the policy');
    const dx = waypoint.x - previous.x, dz = waypoint.z - previous.z;
    const length = Math.hypot(dx, dz);
    if (length > 0) {
      const forward = {x: Math.fround(dx / length), y: 0, z: Math.fround(dz / length)};
      const samples = Math.ceil(length / 6);
      for (let step = 1; step <= samples; step++) {
        const position = {x: previous.x + dx * step / samples, y: 0,
          z: previous.z + dz * step / samples};
        assert(field.navigation.sample(position.x, position.z)?.valid,
          'The route center must remain on valid NAV');
        assert(sampleRoleNavigation(field.navigation, {position, forward}, 1,
          ORIGINAL_MOVEMENT_DIMENSIONS.width, ORIGINAL_MOVEMENT_DIMENSIONS.depth).accepted,
        'Every short forward sample must pass the original footprint kernel');
      }
    }
    previous = waypoint;
  }
}

const narrow = arena();
const start = {x: 6, y: 0, z: -126}, goal = {x: 6, y: 0, z: 126};
const original = createOriginalBotNavigation(narrow);
assert.equal(narrow.navigation.firstInvalidFraction(start, goal), undefined);
assert.deepEqual(findBotPath(narrow, start, goal, 20), [goal],
  'The prototype center sweep accepts the narrow NAV opening');
assert.equal(sampleRoleNavigation(narrow.navigation,
  {position: {x: 6, y: 0, z: -54}, forward: {x: 0, y: 0, z: 1}}, 1, 49, 52).accepted, false,
'The recovered footprint reaches blocked cells beside the opening');
assert.equal(original.canTraverse(start, goal), false);
const stopped = original.reachable(start, goal);
assert(stopped.z < goal.z && stopped.z >= start.z,
  'Reachability must stop before the rejected footprint instead of returning the goal');
assert.deepEqual(findBotPath(narrow, start, goal, original), [],
  'A failed search must not supply a direct waypoint through the narrow opening');

const detour = arena(true), detourPolicy = createOriginalBotNavigation(detour);
const path = findBotPath(detour, start, goal, detourPolicy);
assert(path.length > 1, 'The original footprint must detour through the wide opening');
assert.deepEqual(path.at(-1), goal);
assert(path.some(point => point.x >= 144), 'The route must visit the wide opening');
verifyOriginalRoute(detour, start, path, detourPolicy);
const planner = new BotPathPlanner(detour, start, goal, detourPolicy);
let incremental: Point[] | undefined;
for (let advance = 0; advance < 10000 && incremental === undefined; advance++) {
  incremental = planner.advance(32, 1000);
}
assert.deepEqual(incremental, path, 'Resumable and complete planning must use the same footprint');

// Start away from the opening so the permissive policy populates search edges.
// Reusing this field with the full footprint must not reuse those accepted edges.
const cacheField = arena(), cacheStart = {...start, x: -114}, cacheGoal = {...goal, x: -114};
const thin = createOriginalBotNavigation(cacheField, {width: 25, depth: 36});
assert(findBotPath(cacheField, cacheStart, cacheGoal, thin).length,
  'A one-column original sampling footprint can traverse the narrow opening');
const full = createOriginalBotNavigation(cacheField);
assert.notEqual(thin.cacheKey, full.cacheKey);
assert.deepEqual(findBotPath(cacheField, cacheStart, cacheGoal, full), [],
  'Search edges cached for different footprint dimensions must remain separate');
const numericField = arena();
assert(findBotPath(numericField, cacheStart, cacheGoal, 0).length);
assert.deepEqual(findBotPath(numericField, cacheStart, cacheGoal,
  createOriginalBotNavigation(numericField)), [],
  'Numeric radius routes must not change original-footprint search edges');

// Static boxes leave a 24-unit opening: the zero-radius center can pass, while
// the prototype radius20 cannot. Both searches must populate their own edges.
const boxes = arena(false, true);
const boxStart = {x: -126, y: 0, z: -114}, boxGoal = {x: 126, y: 0, z: -114};
const centerPath = findBotPath(boxes, boxStart, boxGoal, 0);
assert(centerPath.length, 'A point center can detour through the static-box opening');
assert.deepEqual(findBotPath(boxes, boxStart, boxGoal, 20), [],
  'Radius20 must not reuse radius0 search edges through the static-box opening');
console.log('PASS: original CPU footprint rejects narrow NAV, takes a valid wide detour, isolates edge caches, and refuses unreachable waypoints');
