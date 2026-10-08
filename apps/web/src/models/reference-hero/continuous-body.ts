import {Color3, Mesh, MultiMaterial, Scene, SubMesh, Vector3, VertexData} from '@babylonjs/core';
import type {TransformNode} from '@babylonjs/core';
import {decodeImage} from '../../assets/image-resources';
import type {Projection} from './geometry';
import {smoothstep} from './geometry';
import {solidMaterial} from './materials';
import {REFERENCE_PROFILE} from './reference-profile';

interface CrossSection {
  readonly center: number;
  readonly depth: number;
  readonly radius: number;
  readonly contour: number;
}

export interface ContinuousBody {
  readonly mesh: Mesh;
  readonly front: Projection;
  readonly back: Projection;
  readonly side: (side: number) => Projection;
}

const SIZE = 1024;
const STEP = 0.00625;
const FINGER_LENGTHS = [0.082, 0.100, 0.089, 0.066];
const TETRAHEDRA = [[0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6],
  [0, 7, 4, 6], [0, 4, 5, 6], [0, 5, 1, 6]];
const EDGES = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]];
const TRIANGLES = [[], [0, 3, 2], [0, 1, 4], [1, 4, 2, 2, 4, 3],
  [1, 2, 5], [0, 3, 5, 0, 5, 1], [0, 2, 5, 0, 5, 4], [5, 4, 3],
  [3, 4, 5], [4, 5, 0, 5, 2, 0], [1, 5, 0, 5, 3, 0], [5, 2, 1],
  [3, 4, 2, 2, 4, 1], [4, 1, 0], [2, 3, 0], []];

function interpolate(points: readonly number[][], at: number): number {
  let index = 0;
  while (index < points.length - 2 && at > points[index + 1][0]) index++;
  const a = points[index];
  const b = points[index + 1];
  const t = Math.max(0, Math.min(1, (at - a[0]) / (b[0] - a[0])));
  return a[1] + (b[1] - a[1]) * t;
}

const BODY_RADIUS = [[0.9, 0.16], [1.15, 0.165], [1.3, 0.188], [1.4, 0.218],
  [1.52, 0.24], [1.60, 0.20], [1.63, 0.08], [1.66, 0.077], [1.75, 0.117],
  [1.82, 0.133], [1.86, 0.113], [1.92, 0.087], [1.97, 0.045], [2, 0.006]];
const LEG_RADIUS = [[0, 0.074], [0.1, 0.048], [0.2, 0.049], [0.3, 0.062],
  [0.4, 0.073], [0.5, 0.068], [0.6, 0.075], [0.7, 0.09], [0.85, 0.104], [1.0, 0.10]];
const ARM_RADIUS = [[0.2, 0.080], [0.30, 0.076], [0.38, 0.05], [0.47, 0.044],
  [0.55, 0.050], [0.66, 0.044], [0.76, 0.027], [0.81, 0.024], [0.89, 0.019]];

async function readColors(): Promise<Uint8ClampedArray> {
  const image = await decodeImage(new URL('./reference-colors.png', import.meta.url).href);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * 3;
  canvas.height = SIZE;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

/** Reconstruct the silhouette as one rounded volume, including shoulder and hip junctions. */
export async function createContinuousBody(scene: Scene, root: TransformNode): Promise<ContinuousBody> {
  const [distanceBuffer, pixels] = await Promise.all([
    fetch(new URL('./silhouette-distance.bin', import.meta.url).href).then(response => {
      if (!response.ok) throw new Error('角色轮廓资源加载失败');
      return response.arrayBuffer();
    }), readColors(),
  ]);
  const silhouette = new Int16Array(distanceBuffer);
  function contour(x: number, y: number): number {
    const u = Math.max(0, Math.min(SIZE - 1.001, (x + 1) * (SIZE - 1) / 2));
    const v = Math.max(0, Math.min(SIZE - 1.001, (2 - y) * (SIZE - 1) / 2));
    const column = Math.floor(u);
    const row = Math.floor(v);
    const a = row * SIZE + column;
    const fx = u - column;
    const fy = v - row;
    return ((silhouette[a] * (1 - fx) + silhouette[a + 1] * fx) * (1 - fy)
      + (silhouette[a + SIZE] * (1 - fx) + silhouette[a + SIZE + 1] * fx) * fy) / 10000;
  }

  function section(x: number, y: number): CrossSection {
    const index = Math.min(REFERENCE_PROFILE.length - 2, Math.max(0, Math.floor(y / 0.025)));
    const a = REFERENCE_PROFILE[index];
    const b = REFERENCE_PROFILE[index + 1];
    const t = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
    const front = a.front + (b.front - a.front) * t;
    const back = a.back + (b.back - a.back) * t;
    let center = (front + back) / 2;
    let depth = Math.max(0.007, (back - front) / 2);
    let radius = y < 0.9 ? interpolate(LEG_RADIUS, y) : interpolate(BODY_RADIUS, y);
    if (y < 0.1) radius = Math.min(radius, Math.max(0.008, y * 0.6));
    if (y > 1.40 && y < 1.63) {
      const arm = smoothstep(0.20, 0.35, Math.abs(x));
      const armRadius = interpolate(ARM_RADIUS, Math.abs(x));
      radius = radius * (1 - arm) + armRadius * arm;
      depth = depth * (1 - arm) + armRadius * 0.95 * arm;
      center *= 1 - arm;
    }
    return {center, depth, radius, contour: contour(x, y)};
  }

  function density(x: number, y: number, z: number, s = section(x, y)): number {
    const q = Math.max(0, 1 + s.contour / s.radius);
    let distance = s.depth * (Math.sqrt(q * q + ((z - s.center) / s.depth) ** 2) - 1);
    distance = Math.max(distance, -y, y - 2, Math.abs(x) - 0.883);
    if (Math.abs(x) > 0.848 && y > 1.44 && y < 1.535) {
      for (let finger = 0; finger < 4; finger++) {
        const end = 0.873 + FINGER_LENGTHS[finger];
        const along = Math.max(0.865, Math.min(end, Math.abs(x)));
        const dz = z - (-0.030 + finger * 0.019);
        const fingerDistance = Math.hypot(Math.abs(x) - along, y - 1.492, dz) - 0.008;
        distance = Math.min(distance, fingerDistance);
      }
    }
    return distance;
  }

  const nx = 329;
  const ny = 329;
  const nz = 85;
  const rowStride = nx;
  const layerStride = nx * ny;
  const total = layerStride * nz;
  const minX = -1.025;
  const minY = -0.025;
  const minZ = -0.2625;
  const values = new Float32Array(total);
  const sections: CrossSection[] = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) sections.push(section(minX + ix * STEP, minY + iy * STEP));
  }
  for (let iz = 0; iz < nz; iz++) {
    const z = minZ + iz * STEP;
    for (let iy = 0; iy < ny; iy++) {
      const y = minY + iy * STEP;
      for (let ix = 0; ix < nx; ix++) {
        const xy = iy * rowStride + ix;
        values[iz * layerStride + xy] = density(minX + ix * STEP, y, z, sections[xy]);
      }
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertexByEdge = new Map<number, number>();
  const cornerOffsets = [0, 1, nx + 1, nx, layerStride, layerStride + 1,
    layerStride + nx + 1, layerStride + nx];

  function projectedColor(x: number, y: number, z: number,
    normal: Vector3): Color3 {
    const weights = [Math.max(0, -normal.z) ** 6, Math.max(0, normal.z) ** 6,
      Math.abs(normal.x) ** 6 * (Math.abs(x) > 0.34 && y > 1.4 ? 0 : 1)];
    let sum = weights.reduce((a, b) => a + b, 0);
    if (sum < 0.00001) {
      weights[0] = 1;
      sum = 1;
    }
    const rgb = [0, 0, 0];
    for (let view = 0; view < 3; view++) {
      if (weights[view] === 0) continue;
      const u = Math.max(0, Math.min(SIZE - 1, (view === 2 ? z / 0.5 + 0.5 : x / 2 + 0.5) * (SIZE - 1)));
      const v = Math.max(0, Math.min(SIZE - 1, (1 - y / 2) * (SIZE - 1)));
      const offset = (Math.round(v) * SIZE * 3 + view * SIZE + Math.round(u)) * 4;
      for (let channel = 0; channel < 3; channel++) {
        rgb[channel] += pixels[offset + channel] * weights[view] / sum / 255;
      }
    }
    if (Math.abs(x) > 0.808) return Color3.FromHexString('#aaaab2').toLinearSpace();
    return new Color3(rgb[0], rgb[1], rgb[2]).toLinearSpace();
  }

  function vertex(a: number, b: number): number {
    if (a > b) [a, b] = [b, a];
    const key = a * total + b;
    const existing = vertexByEdge.get(key);
    if (existing !== undefined) return existing;
    const t = values[a] / (values[a] - values[b]);
    const coordinate = (id: number): Vector3 => new Vector3(minX + id % nx * STEP,
      minY + Math.floor(id / nx) % ny * STEP, minZ + Math.floor(id / layerStride) * STEP);
    const p = Vector3.Lerp(coordinate(a), coordinate(b), t);
    const gradient = (id: number): Vector3 => new Vector3(values[id + 1] - values[id - 1],
      values[id + rowStride] - values[id - rowStride], values[id + layerStride] - values[id - layerStride]);
    const n = Vector3.Lerp(gradient(a), gradient(b), t).normalize();
    const c = projectedColor(p.x, p.y, p.z, n);
    const index = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    colors.push(c.r, c.g, c.b, 1);
    uvs.push((p.x + 1) / 2, p.y / 2);
    vertexByEdge.set(key, index);
    return index;
  }

  function triangle(a: number, b: number, c: number): void {
    const pa = Vector3.FromArray(positions, a * 3);
    const pb = Vector3.FromArray(positions, b * 3);
    const pc = Vector3.FromArray(positions, c * 3);
    const normal = Vector3.Cross(pa.subtract(pb), pc.subtract(pb));
    if (Vector3.Dot(normal, Vector3.FromArray(normals, a * 3)) < 0) [b, c] = [c, b];
    indices.push(a, b, c);
  }

  for (let iz = 0; iz < nz - 1; iz++) {
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const base = iz * layerStride + iy * rowStride + ix;
        let inside = 0;
        for (const offset of cornerOffsets) if (values[base + offset] < 0) inside++;
        if (inside === 0 || inside === 8) continue;
        const corners = cornerOffsets.map(offset => base + offset);
        for (const tetra of TETRAHEDRA) {
          const ids = tetra.map(index => corners[index]);
          let mask = 0;
          for (let index = 0; index < 4; index++) if (values[ids[index]] < 0) mask |= 1 << index;
          const edges = TRIANGLES[mask];
          for (let index = 0; index < edges.length; index += 3) {
            const vertices = edges.slice(index, index + 3).map(edge => vertex(ids[EDGES[edge][0]], ids[EDGES[edge][1]]));
            triangle(vertices[0], vertices[1], vertices[2]);
          }
        }
      }
    }
  }

  const material = new MultiMaterial('reference-suit-finishes', scene);
  material.subMaterials = [
    solidMaterial(scene, 'satin-silver', '#ffffff', 0.18, 0.65),
    solidMaterial(scene, 'red-suit', '#ffffff', 0.02, 0.72),
    solidMaterial(scene, 'blue-suit', '#ffffff', 0.02, 0.72),
    solidMaterial(scene, 'gold-inlay', '#ffffff', 0.34, 0.58),
  ];
  const groups: number[][] = [[], [], [], []];
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index] * 4;
    const r = colors[a];
    const g = colors[a + 1];
    const b = colors[a + 2];
    const group = r > g * 1.6 && r > b * 1.5 ? 1 : b > r * 1.6 && b > g * 1.15 ? 2
      : r > b * 1.4 && g > b * 1.25 ? 3 : 0;
    groups[group].push(indices[index], indices[index + 1], indices[index + 2]);
  }
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.colors = colors;
  data.uvs = uvs;
  data.indices = groups.flat();
  const mesh = new Mesh('continuous-reference-body', scene);
  data.applyToMesh(mesh);
  mesh.parent = root;
  mesh.material = material;
  mesh.releaseSubMeshes();
  let indexStart = 0;
  for (let group = 0; group < groups.length; group++) {
    new SubMesh(group, 0, positions.length / 3, indexStart, groups[group].length, mesh);
    indexStart += groups[group].length;
  }

  const project = (front: boolean): Projection => (x, y, offset) => {
    const s = section(x, y);
    const q = Math.max(0, Math.min(1, 1 + s.contour / s.radius));
    const depth = s.depth * Math.sqrt(1 - q * q);
    return new Vector3(x, y, s.center + (front ? -depth - offset : depth + offset));
  };
  const side = (sign: number): Projection => (z, y, offset) => {
    let inside = 0;
    let outside = 0.16;
    for (let iteration = 0; iteration < 20; iteration++) {
      const x = (inside + outside) / 2;
      if (density(x, y, z) <= 0) inside = x;
      else outside = x;
    }
    return new Vector3(sign * (inside + offset), y, z);
  };
  return {mesh, front: project(true), back: project(false), side};
}
