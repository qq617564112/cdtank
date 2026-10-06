import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webAssetPath} from './runtime/content-paths';
import {NavigationGrid, SourceNavigationLayer} from './navigation';

export interface Point {
  x: number;
  y: number;
  z: number;
}
interface SourceBox {
  id: string;
  matrix: number[];
  dimensions: number[];
}
interface SourceSpawn {
  position: number[];
  heading: number;
  slot: number;
}
interface SourceField {
  id: string;
  terrainTriangles: number[][][];
  collisionBoxes: SourceBox[];
  respawnGroups: SourceSpawn[][];
  navigationLayers: SourceNavigationLayer[];
}
interface GroundTriangle {
  vertices: number[][];
  denominator: number;
  minimumY: number;
  maximumY: number;
  edge1: number[];
  edge2: number[];
}
export interface SpawnPoint extends Point {
  yaw: number;
}
export interface SurfaceHit {
  fraction: number;
  boxId: string;
}

const CELL_SIZE = 128;
const sources: SourceField[] = JSON.parse(readFileSync(resolve(
  process.env.BATTLEFIELDS ?? webAssetPath('battlefields.json')), 'utf8'));
const fields = new Map<number, Battlefield>();

/** Original coordinates in source units; rendering reflects X at the client. */
export class Battlefield {
  private readonly ground = new Map<string, GroundTriangle[]>();
  private readonly boxCells = new Map<string, number[]>();
  private boxRadiusX = 0;
  private boxRadiusZ = 0;
  readonly spawns: SpawnPoint[];
  readonly boxes: SourceBox[];
  readonly navigation: NavigationGrid;
  private readonly dynamicBoxes = new Map<string, SourceBox>();
  navigationRevision = 0;

  /** Rebuilt dynamic OBB/12-unit occupancy, isolated from source BOX/NAV data. */
  setDynamicBox(box: SourceBox | undefined, id: string): void {
    if (!box) {
      if (!this.dynamicBoxes.delete(id)) return;
      this.navigation.setBlocker(id);
    } else {
      this.dynamicBoxes.set(id, box);
      const cells = new Set<number>();
      const grid = this.navigation.source;
      const extent = Math.hypot(...box.dimensions) / 2;
      const minX = Math.max(0, Math.floor((box.matrix[12] - extent - grid.minimum[0]) / 12));
      const maxX = Math.min(grid.width - 1, Math.ceil((box.matrix[12] + extent - grid.minimum[0]) / 12));
      const minZ = Math.max(0, Math.floor((box.matrix[14] - extent - grid.minimum[2]) / 12));
      const maxZ = Math.min(grid.height - 1, Math.ceil((box.matrix[14] + extent - grid.minimum[2]) / 12));
      for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
        const point = {x: grid.minimum[0] + x * 12 + 6, y: box.matrix[13],
          z: grid.minimum[2] + z * 12 + 6};
        if (segmentBox(point, point, box, 0) !== undefined) cells.add(z * grid.width + x);
      }
      this.navigation.setBlocker(id, cells);
    }
    this.navigationRevision++;
  }

  constructor(readonly source: SourceField) {
    this.boxes = source.collisionBoxes;
    this.navigation = new NavigationGrid(source.navigationLayers[0]);
    this.boxes.forEach((box, index) => {
      // Invert the same local-space basis used by segmentBox, including its
      // source rounding. Index bounds do not replace the exact narrow phase.
      const m = box.matrix;
      const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
      const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
      const x = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det];
      const z = [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
      const extent = (axis: number[]) => axis.reduce((sum, value, at) => sum + Math.abs(value) * box.dimensions[at] / 2, 0);
      const extentX = extent(x), extentZ = extent(z);
      this.boxRadiusX = Math.max(this.boxRadiusX, x.reduce((sum, value) => sum + Math.abs(value), 0));
      this.boxRadiusZ = Math.max(this.boxRadiusZ, z.reduce((sum, value) => sum + Math.abs(value), 0));
      // Padding retains boundary contacts under floating-point transforms.
      const minX = Math.floor((m[12] - extentX - .001) / CELL_SIZE);
      const maxX = Math.floor((m[12] + extentX + .001) / CELL_SIZE);
      const minZ = Math.floor((m[14] - extentZ - .001) / CELL_SIZE);
      const maxZ = Math.floor((m[14] + extentZ + .001) / CELL_SIZE);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const key = `${cx},${cz}`;
          const list = this.boxCells.get(key) ?? [];
          list.push(index);
          this.boxCells.set(key, list);
        }
      }
    });
    for (const vertices of source.terrainTriangles) {
      const [a, b, c] = vertices;
      const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const triangle = {vertices, denominator,
        minimumY: Math.min(a[1], b[1], c[1]), maximumY: Math.max(a[1], b[1], c[1]),
        edge1: b.map((value, axis) => value - a[axis]),
        edge2: c.map((value, axis) => value - a[axis])};
      const minX = Math.floor(Math.min(a[0], b[0], c[0]) / CELL_SIZE);
      const maxX = Math.floor(Math.max(a[0], b[0], c[0]) / CELL_SIZE);
      const minZ = Math.floor(Math.min(a[2], b[2], c[2]) / CELL_SIZE);
      const maxZ = Math.floor(Math.max(a[2], b[2], c[2]) / CELL_SIZE);
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${z}`;
          const list = this.ground.get(key) ?? [];
          list.push(triangle);
          this.ground.set(key, list);
        }
      }
    }
    // Group purpose and heading units remain under recovery. Use grounded source
    // positions, retaining both raw arrays in the content export.
    const groups = source.respawnGroups.map(group => group.filter(spawn => {
      const [x, y, z] = spawn.position;
      if (x === 0 && y === 0 && z === 0) {
        return false;
      }
      const cell = this.navigation.sample(x, z);
      const height = cell?.valid ? cell.height : undefined;
      return height !== undefined && Math.abs(height - y) < 5;
    }));
    const selected = groups[0].length >= 2 ? groups[0] : groups[1];
    this.spawns = selected.map(spawn => ({x: spawn.position[0], y: spawn.position[1],
      z: spawn.position[2], yaw: spawn.heading * Math.PI / 180}));
  }

  heightAt(x: number, z: number, nearY: number): number | undefined {
    const candidates = this.ground.get(`${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`) ?? [];
    let closest: number | undefined;
    for (const {vertices: [a, b, c], denominator} of candidates) {
      // Vertical faces participate in projectiles, but have no ground height.
      if (Math.abs(denominator) < 0.00001) {
        continue;
      }
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
      const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
      if (u < -0.000001 || v < -0.000001 || u + v > 1.000001) {
        continue;
      }
      const height = u * a[1] + v * b[1] + (1 - u - v) * c[1];
      if (closest === undefined || Math.abs(height - nearY) < Math.abs(closest - nearY)) {
        closest = height;
      }
    }
    return closest;
  }

  firstBoxHit(start: Point, end: Point, radius: number): SurfaceHit | undefined {
    let closest: SurfaceHit | undefined;
    const candidates = new Set<number>();
    const minX = Math.floor((Math.min(start.x, end.x) - radius * this.boxRadiusX) / CELL_SIZE);
    const maxX = Math.floor((Math.max(start.x, end.x) + radius * this.boxRadiusX) / CELL_SIZE);
    const minZ = Math.floor((Math.min(start.z, end.z) - radius * this.boxRadiusZ) / CELL_SIZE);
    const maxZ = Math.floor((Math.max(start.z, end.z) + radius * this.boxRadiusZ) / CELL_SIZE);
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (const index of this.boxCells.get(`${x},${z}`) ?? []) candidates.add(index);
      }
    }
    // Source order decides ties between overlapping boxes.
    for (const index of [...candidates].sort((a, b) => a - b)) {
      const box = this.boxes[index];
      const fraction = segmentBox(start, end, box, radius);
      if (fraction !== undefined && (!closest || fraction < closest.fraction)) {
        closest = {fraction, boxId: box.id};
      }
    }
    for (const box of this.dynamicBoxes.values()) {
      const fraction = segmentBox(start, end, box, radius);
      if (fraction !== undefined && (!closest || fraction < closest.fraction)) {
        closest = {fraction, boxId: box.id};
      }
    }
    return closest;
  }

  firstSurfaceHit(start: Point, end: Point, radius: number): SurfaceHit | undefined {
    let closest = this.firstBoxHit(start, end, radius);
    const candidates = new Set<GroundTriangle>();
    const minimumY = Math.min(start.y, end.y), maximumY = Math.max(start.y, end.y);
    const minX = Math.floor(Math.min(start.x, end.x) / CELL_SIZE);
    const maxX = Math.floor(Math.max(start.x, end.x) / CELL_SIZE);
    const minZ = Math.floor(Math.min(start.z, end.z) / CELL_SIZE);
    const maxZ = Math.floor(Math.max(start.z, end.z) / CELL_SIZE);
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (!crossesGroundCell(start, end, x, z)) continue;
        for (const triangle of this.ground.get(`${x},${z}`) ?? []) {
          if (maximumY < triangle.minimumY || minimumY > triangle.maximumY) continue;
          candidates.add(triangle);
        }
      }
    }
    for (const triangle of candidates) {
      const fraction = segmentTriangle(start, end, triangle);
      if (fraction !== undefined && (!closest || fraction < closest.fraction)) {
        closest = {fraction, boxId: 'terrain'};
      }
    }
    return closest;
  }

  move(start: Point, end: Point, radius: number): Point {
    const invalid = this.navigation.firstInvalidFraction(start, end);
    const limit = invalid === undefined ? 1 : Math.max(0, invalid - 0.001);
    const candidate = {x: start.x + (end.x - start.x) * limit,
      z: start.z + (end.z - start.z) * limit};
    const cell = this.navigation.sample(candidate.x, candidate.z);
    const height = cell?.valid ? cell.height : undefined;
    if (height === undefined || Math.abs(height - start.y) > radius) {
      return start;
    }
    const destination = {...candidate, y: height};
    const hit = this.firstBoxHit({...start, y: start.y + radius},
      {...destination, y: destination.y + radius}, radius);
    if (!hit) {
      return destination;
    }
    const fraction = Math.max(0, hit.fraction - 0.001);
    const x = start.x + (destination.x - start.x) * fraction;
    const z = start.z + (destination.z - start.z) * fraction;
    return {x, y: this.navigation.sample(x, z)!.height, z};
  }

  spawn(index: number): SpawnPoint {
    if (!this.spawns.length) {
      throw new Error(`地图${this.source.id}的出生点仍待还原`);
    }
    return this.spawns[index % this.spawns.length];
  }
}

function crossesGroundCell(start: Point, end: Point, x: number, z: number): boolean {
  let entry = 0, exit = 1;
  for (const [a, b, minimum] of [[start.x, end.x, x * CELL_SIZE], [start.z, end.z, z * CELL_SIZE]]) {
    const delta = b - a;
    if (delta === 0) {
      if (a < minimum || a > minimum + CELL_SIZE) return false;
    } else {
      const first = (minimum - a) / delta, second = (minimum + CELL_SIZE - a) / delta;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (entry > exit + 1e-12) return false;
    }
  }
  return true;
}

function segmentTriangle(start: Point, end: Point, triangle: GroundTriangle): number | undefined {
  const {vertices: [a], edge1, edge2} = triangle;
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const px = dy * edge2[2] - dz * edge2[1];
  const py = dz * edge2[0] - dx * edge2[2];
  const pz = dx * edge2[1] - dy * edge2[0];
  const determinant = edge1[0] * px + edge1[1] * py + edge1[2] * pz;
  if (Math.abs(determinant) < 1e-10) {
    return undefined;
  }
  const ox = start.x - a[0], oy = start.y - a[1], oz = start.z - a[2];
  const u = (ox * px + oy * py + oz * pz) / determinant;
  if (u < 0 || u > 1) {
    return undefined;
  }
  const qx = oy * edge1[2] - oz * edge1[1];
  const qy = oz * edge1[0] - ox * edge1[2];
  const qz = ox * edge1[1] - oy * edge1[0];
  const v = (dx * qx + dy * qy + dz * qz) / determinant;
  if (v < 0 || u + v > 1) {
    return undefined;
  }
  const fraction = (edge2[0] * qx + edge2[1] * qy + edge2[2] * qz) / determinant;
  return fraction > 0.000001 && fraction <= 1 ? fraction : undefined;
}

// Source matrices are orthonormal row-vector transforms. Transpose the linear
// part to enter box space; zero-width source boxes remain collidable planes.
export function segmentBox(start: Point, end: Point, box: SourceBox, radius: number): number | undefined {
  const m = box.matrix;
  const local = (point: Point): number[] => [0, 1, 2].map(axis =>
    (point.x - m[12]) * m[axis * 4] + (point.y - m[13]) * m[axis * 4 + 1]
      + (point.z - m[14]) * m[axis * 4 + 2]);
  const a = local(start);
  const b = local(end);
  let entry = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const half = box.dimensions[axis] / 2 + radius;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(a[axis]) > half) {
        return undefined;
      }
      continue;
    }
    const first = (-half - a[axis]) / delta;
    const second = (half - a[axis]) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) {
      return undefined;
    }
  }
  return entry;
}

export function getBattlefield(mapId: number): Battlefield {
  let field = fields.get(mapId);
  if (!field) {
    const source = sources.find(value => Number(value.id) === mapId);
    if (!source) {
      throw new Error(`地图${mapId}的场景数据不存在`);
    }
    field = new Battlefield(source);
    fields.set(mapId, field);
  }
  return field;
}

/** Room-owned mutable occupancy; cached test/source maps never receive damage state. */
export function createRoomBattlefield(mapId: number): Battlefield {
  const source = sources.find(value => Number(value.id) === mapId);
  if (!source) throw new Error(`地图${mapId}的场景数据不存在`);
  return new Battlefield(source);
}

export function segmentSphere(start: Point, end: Point, center: Point, radius: number): number | undefined {
  const direction = [end.x - start.x, end.y - start.y, end.z - start.z];
  const offset = [start.x - center.x, start.y - center.y, start.z - center.z];
  const a = direction.reduce((sum, value) => sum + value * value, 0);
  const b = 2 * direction.reduce((sum, value, index) => sum + value * offset[index], 0);
  const c = offset.reduce((sum, value) => sum + value * value, 0) - radius * radius;
  if (c <= 0) {
    return 0;
  }
  const discriminant = b * b - 4 * a * c;
  if (!a || discriminant < 0) {
    return undefined;
  }
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return fraction >= 0 && fraction <= 1 ? fraction : undefined;
}
