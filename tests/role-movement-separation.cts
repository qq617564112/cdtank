import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NavigationGrid} from '../apps/server/src/navigation';
import {separateRoleOverlap, originalSeparationRandom, type SeparatingRole} from '../apps/server/src/battle/roles/movement-separation';
import {createRoleObbFromPose} from '../apps/server/src/battle/roles/movement-obb-prediction';
const vector = (v: number[]) => ({x: v[0], y: v[1], z: v[2]});
const evidence: {nav: string; rows: {name: string; input_position: number[]; input_previous: number[];
  input_obb: number[]; other_position: number[]; status: number; same_id: boolean; depth: number;
  clock: number; output_position: number[]; output_previous: number[]; output_obb: number[];
  clock_calls: number}[]} = JSON.parse(readFileSync('recovery/output/movement-separation-native.json', 'utf8'));
// Source NAV header: one layer with 160-byte description/min/max/dimensions,
// 8-byte cells. Read original unaltered file used by the native oracle.
const bytes = readFileSync(evidence.nav);
// Reuse exported NAV geometry from the actual battlefield catalog by matching
// the original oracle's selected source path, not a synthetic clear grid.
const data = JSON.parse(readFileSync('recovery/output/web-assets/battlefields.json', 'utf8')) as
  {id: string; navigationLayers: {minimum: number[]; maximum: number[]; width: number; height: number; cells: string}[]}[];
const field = data.find(field => Number(field.id) === 1)!;
assert(field);
assert(bytes.length > 1000);
const grid = new NavigationGrid(field.navigationLayers[0]);
for (const row of evidence.rows) {
  const pose = {position: vector(row.input_position), look: {x: 1, y: 0, z: 0}, forward: {x: 1, y: 0, z: 0}};
  const role: SeparatingRole = {id: 1, status: 2, pose,
    previousPosition: vector(row.input_previous), obb: {matrix: row.input_obb.slice(0, 16), dimensions: [49, 24, 52]}};
  const otherPose = {...pose, position: vector(row.other_position)};
  const other: SeparatingRole = {id: row.same_id ? 1 : 2, status: row.status, pose: otherPose,
    obb: createRoleObbFromPose(otherPose)};
  const frozen = JSON.stringify(other);
  let clocks = 0;
  separateRoleOverlap(role, [other], grid, () => {clocks++; return row.clock;}, row.depth);
  assert.deepEqual(Object.values(role.pose.position), row.output_position, row.name);
  assert.deepEqual(Object.values(role.previousPosition!), row.output_previous, row.name);
  role.obb.matrix.forEach((value, index) => assert(Math.abs(value - row.output_obb[index]) < .000002, row.name));
  assert.equal(clocks, row.clock_calls, row.name);
  assert.equal(JSON.stringify(other), frozen, row.name);
}
assert.equal(originalSeparationRandom(12345), .2314453125);
assert.equal(originalSeparationRandom(1), .001251220703125);
console.log(`PASS: ${evidence.rows.length} complete native separation/network-pose outputs, previous position, OBB matrix, RNG and blocked recursion`);
