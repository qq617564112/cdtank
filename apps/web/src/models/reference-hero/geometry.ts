import {Mesh, Scene, TransformNode, Vector3, VertexData} from '@babylonjs/core';
import type {Material} from '@babylonjs/core';

export interface Section {
  readonly at: number;
  readonly a: number;
  readonly b: number;
  readonly center?: number;
  readonly depth?: number;
}

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export type Surface = (u: number, v: number) => Vector3;
export type Projection = (x: number, y: number, offset: number) => Vector3;

function orientIndices(positions: number[], indices: number[], outward: Vector3): void {
  for (let i = 0; i < indices.length; i += 3) {
    const a = Vector3.FromArray(positions, indices[i] * 3);
    const b = Vector3.FromArray(positions, indices[i + 1] * 3);
    const c = Vector3.FromArray(positions, indices[i + 2] * 3);
    const normal = Vector3.Cross(a.subtract(b), c.subtract(b));
    if (Vector3.Dot(normal, outward) < 0) {
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
  }
}

export function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function component(section: Section, key: 'a' | 'b' | 'center' | 'depth'): number {
  return section[key] ?? 0;
}

/** Interpolate measured cross sections without overshooting the silhouette. */
export function sectionAt(sections: readonly Section[], at: number): Section {
  let index = 0;
  while (index < sections.length - 2 && sections[index + 1].at < at) {
    index++;
  }
  const left = sections[index];
  const right = sections[index + 1];
  const before = sections[Math.max(0, index - 1)];
  const after = sections[Math.min(sections.length - 1, index + 2)];
  const span = right.at - left.at;
  const t = Math.max(0, Math.min(1, (at - left.at) / span));
  const interpolate = (key: 'a' | 'b' | 'center' | 'depth'): number => {
    const a = component(left, key);
    const b = component(right, key);
    const m0 = (b - component(before, key)) / (right.at - before.at) * span;
    const m1 = (component(after, key) - a) / (after.at - left.at) * span;
    const value = (2 * t ** 3 - 3 * t ** 2 + 1) * a + (t ** 3 - 2 * t ** 2 + t) * m0
      + (-2 * t ** 3 + 3 * t ** 2) * b + (t ** 3 - t ** 2) * m1;
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), value));
  };
  return {at, a: interpolate('a'), b: interpolate('b'),
    center: interpolate('center'), depth: interpolate('depth')};
}

export function surfaceMesh(scene: Scene, parent: TransformNode, name: string,
  surface: Surface, material: Material, columns = 96, rows = 88,
  mirrored = false, closed = true, outward?: Vector3): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const stride = columns + 1;
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const v = row / rows;
      const p = surface(u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      if (row < rows && column < columns) {
        const a = row * stride + column;
        indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
      }
    }
  }
  if (closed) {
    for (const row of [0, rows]) {
      const center = Vector3.Zero();
      for (let column = 0; column < columns; column++) {
        center.addInPlace(Vector3.FromArray(positions, (row * stride + column) * 3));
      }
      center.scaleInPlace(1 / columns);
      const index = positions.length / 3;
      positions.push(center.x, center.y, center.z);
      uvs.push(0.5, row / rows);
      for (let column = 0; column < columns; column++) {
        const a = row * stride + column;
        if (row === 0) {
          indices.push(index, a + 1, a);
        } else {
          indices.push(index, a, a + 1);
        }
      }
    }
  }
  if (mirrored) {
    for (let i = 0; i < indices.length; i += 3) {
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
  }
  if (outward) orientIndices(positions, indices, outward);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  if (closed) {
    for (let row = 0; row <= rows; row++) {
      const a = row * stride * 3;
      const b = (row * stride + columns) * 3;
      const n = Vector3.FromArray(normals, a).add(Vector3.FromArray(normals, b)).normalize();
      for (const index of [a, b]) {
        normals[index] = n.x;
        normals[index + 1] = n.y;
        normals[index + 2] = n.z;
      }
    }
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.parent = parent;
  mesh.material = material;
  return mesh;
}

export function smoothPath(points: readonly Point2[], samples = 12, closed = false): Point2[] {
  const result: Point2[] = [];
  const count = closed ? points.length : points.length - 1;
  const point = (index: number): Point2 => closed
    ? points[(index + points.length) % points.length]
    : points[Math.max(0, Math.min(points.length - 1, index))];
  for (let index = 0; index < count; index++) {
    const a = point(index - 1);
    const b = point(index);
    const c = point(index + 1);
    const d = point(index + 2);
    for (let sample = 0; sample < samples; sample++) {
      const t = sample / samples;
      const interpolate = (key: 'x' | 'y'): number => 0.5 * ((2 * b[key])
        + (-a[key] + c[key]) * t + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t * t
        + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t * t * t);
      result.push({x: interpolate('x'), y: interpolate('y')});
    }
  }
  if (!closed) result.push(points[points.length - 1]);
  return result;
}

/** A beveled strip follows the underlying body rather than a flat chest plane. */
export function surfaceRibbon(scene: Scene, parent: TransformNode, name: string,
  path: readonly Point2[], project: Projection, material: Material,
  width: number, offset: number, bevel = 0.009): Mesh {
  const points = smoothPath(path, 14);
  const middle = path[Math.floor(path.length / 2)];
  const outward = project(middle.x, middle.y, offset + 0.001)
    .subtract(project(middle.x, middle.y, offset));
  return surfaceMesh(scene, parent, name, (u, v) => {
    const position = v * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(position));
    const t = position - index;
    const p = points[index];
    const q = points[index + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const length = Math.hypot(dx, dy) || 1;
    const across = (u - 0.5) * width;
    return project(p.x + dx * t - dy / length * across,
      p.y + dy * t + dx / length * across,
      offset + Math.sin(u * Math.PI) * bevel);
  }, material, 6, points.length - 1, false, false, outward);
}

/** A domed inset with a shaped perimeter, used for lenses and face plates. */
export function surfacePatch(scene: Scene, parent: TransformNode, name: string,
  outline: readonly Point2[], project: Projection, material: Material,
  offset: number, dome = 0.02): Mesh {
  const border = smoothPath(outline, 10, true);
  const center = outline.reduce((p, q) => ({x: p.x + q.x / outline.length,
    y: p.y + q.y / outline.length}), {x: 0, y: 0});
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const rings = 10;
  const columns = border.length;
  for (let ring = 0; ring <= rings; ring++) {
    const radius = Math.max(0.0001, ring / rings);
    for (let i = 0; i <= columns; i++) {
      const edge = border[i % columns];
      const x = center.x + (edge.x - center.x) * radius;
      const y = center.y + (edge.y - center.y) * radius;
      const p = project(x, y, offset + dome * (1 - radius * radius));
      positions.push(p.x, p.y, p.z);
      uvs.push(i / columns, radius);
      if (ring < rings && i < columns) {
        const a = ring * (columns + 1) + i;
        indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
      }
    }
  }
  orientIndices(positions, indices, project(center.x, center.y, offset + 0.001)
    .subtract(project(center.x, center.y, offset)));
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.parent = parent;
  mesh.material = material;
  return mesh;
}

export function facetedGem(scene: Scene, parent: TransformNode, name: string,
  outline: readonly Point2[], project: Projection, material: Material,
  offset: number, height: number): Mesh {
  const center = outline.reduce((p, q) => ({x: p.x + q.x / outline.length,
    y: p.y + q.y / outline.length}), {x: 0, y: 0});
  const positions: number[] = [];
  const indices: number[] = [];
  const addTriangle = (a: Vector3, b: Vector3, c: Vector3): void => {
    const index = positions.length / 3;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    indices.push(index, index + 2, index + 1);
  };
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const inset = (p: Point2): Vector3 => project(center.x + (p.x - center.x) * 0.60,
      center.y + (p.y - center.y) * 0.72, offset + height);
    const outerA = project(a.x, a.y, offset);
    const outerB = project(b.x, b.y, offset);
    const innerA = inset(a);
    const innerB = inset(b);
    addTriangle(outerA, outerB, innerB);
    addTriangle(outerA, innerB, innerA);
    addTriangle(innerA, innerB, project(center.x, center.y, offset + height * 1.04));
  }
  const data = new VertexData();
  const normals: number[] = [];
  orientIndices(positions, indices, project(center.x, center.y, offset + 0.001)
    .subtract(project(center.x, center.y, offset)));
  VertexData.ComputeNormals(positions, indices, normals);
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.parent = parent;
  mesh.material = material;
  return mesh;
}
