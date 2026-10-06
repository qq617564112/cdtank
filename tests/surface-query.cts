import assert from 'node:assert/strict';
import {getBattlefield, segmentBox, type Point, type SurfaceHit} from '../apps/server/src/battlefield';

// Allocation-based reference keeps the original query arithmetic and scans every
// source triangle; it shares no candidate selection with the indexed query.
function triangleHit(start: Point, end: Point, vertices: number[][]): number | undefined {
  const [a, b, c] = vertices;
  const direction = [end.x - start.x, end.y - start.y, end.z - start.z];
  const edge1 = b.map((value, axis) => value - a[axis]);
  const edge2 = c.map((value, axis) => value - a[axis]);
  const cross = (u: number[], v: number[]) =>
    [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u: number[], v: number[]) => u.reduce((sum, value, axis) => sum + value * v[axis], 0);
  const p = cross(direction, edge2), determinant = dot(edge1, p);
  if (Math.abs(determinant) < 1e-10) return undefined;
  const offset = [start.x - a[0], start.y - a[1], start.z - a[2]], u = dot(offset, p) / determinant;
  if (u < 0 || u > 1) return undefined;
  const q = cross(offset, edge1), v = dot(direction, q) / determinant;
  if (v < 0 || u + v > 1) return undefined;
  const fraction = dot(edge2, q) / determinant;
  return fraction > .000001 && fraction <= 1 ? fraction : undefined;
}
let seed = 17;
function random(): number {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;}
let checked = 0;
for (let map = 1; map <= 25; map++) {
  const field = getBattlefield(map), layer = field.navigation.source;
  const cases: Array<[Point, Point]> = [];
  for (let index = 0; index < 24; index++) {
    const point = () => ({x: layer.minimum[0] + random() * (layer.maximum[0] - layer.minimum[0]),
      y: -100 + random() * 600, z: layer.minimum[2] + random() * (layer.maximum[2] - layer.minimum[2])});
    cases.push([point(), point()]);
  }
  for (const spawn of field.spawns.slice(0, 4)) {
    cases.push([{...spawn, y: spawn.y + 100}, {...spawn, y: spawn.y - 100}]);
    cases.push([{...spawn, y: spawn.y + 20}, {...spawn, x: spawn.x + 700, z: spawn.z + 700, y: spawn.y + 20}]);
  }
  for (const vertices of field.source.terrainTriangles.slice(0, 8)) {
    const [x, y, z] = vertices[0];
    cases.push([{x, y: y + 100, z}, {x, y: y - 100, z}]);
  }
  // Cardinal/diagonal rays exactly on 128-unit bucket edges and corners.
  for (const [x, z] of [[0, 0], [128, 128], [-128, -128]]) {
    cases.push([{x, y: 500, z}, {x, y: -100, z: z + 512}]);
    cases.push([{x, y: 500, z}, {x: x + 512, y: -100, z: z + 512}]);
    cases.push([{x, y: 500, z}, {x, y: -100, z}]);
  }
  for (const [start, end] of cases) {
    for (const radius of [0, 1, 20]) {
      let expectedBox: SurfaceHit | undefined;
      for (const box of field.boxes) {
        const fraction = segmentBox(start, end, box, radius);
        if (fraction !== undefined && (!expectedBox || fraction < expectedBox.fraction)) {
          expectedBox = {fraction, boxId: box.id};
        }
      }
      assert.deepEqual(field.firstBoxHit(start, end, radius), expectedBox,
        `Map ${map} indexed box ray ${checked} radius ${radius}`);
    }
    let expected: SurfaceHit | undefined;
    for (const box of field.boxes) {
      const fraction = segmentBox(start, end, box, 1);
      if (fraction !== undefined && (!expected || fraction < expected.fraction)) expected = {fraction, boxId: box.id};
    }
    for (const triangle of field.source.terrainTriangles) {
      const fraction = triangleHit(start, end, triangle);
      if (fraction !== undefined && (!expected || fraction < expected.fraction)) expected = {fraction, boxId: 'terrain'};
    }
    assert.deepEqual(field.firstSurfaceHit(start, end, 1), expected, `Map ${map} ray ${checked}`);
    checked++;
  }
}
console.log(`PASS: ${checked} source-map surface rays and ${checked * 3} box sweeps equal exhaustive arithmetic, including source vertices, vertical rays and grid boundaries`);
