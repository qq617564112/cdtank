interface Point {x: number; y: number; z: number;}
export type Vertex = readonly number[];
export type Triangle = readonly [Vertex, Vertex, Vertex];
interface Bounds {minimum: number[]; maximum: number[];}
interface IndexedTriangle extends Bounds {vertices: Triangle; normal: number[];}
const CELL_SIZE = 128;
const EPSILON = 1e-8;

const subtract = (a: Vertex, b: Vertex): number[] => a.map((value, axis) => value - b[axis]);
const dot = (a: Vertex, b: Vertex): number => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a: Vertex, b: Vertex): number[] =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const coordinates = (point: Point): number[] => [point.x, point.y, point.z];

/** World-space render triangles; bounds and cells only select narrow-phase candidates. */
export class CollisionMesh implements Bounds {
  readonly minimum = [Infinity, Infinity, Infinity];
  readonly maximum = [-Infinity, -Infinity, -Infinity];
  private readonly cells = new Map<string, IndexedTriangle[]>();
  readonly triangles: readonly IndexedTriangle[];

  constructor(vertices: readonly Triangle[]) {
    this.triangles = vertices.flatMap(triangle => {
      const normal = cross(subtract(triangle[1], triangle[0]), subtract(triangle[2], triangle[0]));
      const length = Math.hypot(...normal);
      if (length < EPSILON) return [];
      const minimum = [0, 1, 2].map(axis => Math.min(...triangle.map(vertex => vertex[axis])));
      const maximum = [0, 1, 2].map(axis => Math.max(...triangle.map(vertex => vertex[axis])));
      minimum.forEach((value, axis) => {this.minimum[axis] = Math.min(this.minimum[axis], value);});
      maximum.forEach((value, axis) => {this.maximum[axis] = Math.max(this.maximum[axis], value);});
      const indexed = {vertices: triangle, minimum, maximum, normal: normal.map(value => value / length)};
      for (let x = Math.floor(minimum[0] / CELL_SIZE); x <= Math.floor(maximum[0] / CELL_SIZE); x++) {
        for (let z = Math.floor(minimum[2] / CELL_SIZE); z <= Math.floor(maximum[2] / CELL_SIZE); z++) {
          const key = `${x},${z}`;
          const list = this.cells.get(key) ?? [];
          list.push(indexed);
          this.cells.set(key, list);
        }
      }
      return [indexed];
    });
  }

  firstHit(start: Point, end: Point, radius: number): number | undefined {
    const a = coordinates(start), b = coordinates(end), delta = subtract(b, a);
    const minimum = a.map((value, axis) => Math.min(value, b[axis]) - radius);
    const maximum = a.map((value, axis) => Math.max(value, b[axis]) + radius);
    let closest: number | undefined;
    for (const triangle of this.candidates(minimum, maximum, a, b, radius)) {
      const fraction = sweepTriangle(a, delta, triangle, radius);
      if (fraction !== undefined && (closest === undefined || fraction < closest)) closest = fraction;
    }
    return closest;
  }

  /** Height-independent contact query against the projected render footprint. */
  firstFootprintHit(start: Point, end: Point): number | undefined {
    const a = [start.x, start.z], delta = [end.x - start.x, end.z - start.z];
    let closest: number | undefined;
    for (const {vertices} of this.triangles) {
      const polygon = vertices.map(vertex => [vertex[0], vertex[2]]);
      const area = cross2(subtract(polygon[1], polygon[0]), subtract(polygon[2], polygon[0]));
      let entry = 0, exit = 1;
      if (Math.abs(area) > EPSILON) {
        for (let index = 0; index < 3; index++) {
          const edge = subtract(polygon[(index + 1) % 3], polygon[index]);
          const origin = cross2(edge, subtract(a, polygon[index])) * Math.sign(area);
          const direction = cross2(edge, delta) * Math.sign(area);
          if (Math.abs(direction) < EPSILON) {
            if (origin < -EPSILON) {entry = Infinity; break;}
          } else if (direction > 0) entry = Math.max(entry, -origin / direction);
          else exit = Math.min(exit, -origin / direction);
        }
      } else {
        // Vertical planes project to edges, which still block horizontal contact.
        entry = Infinity;
        for (let index = 0; index < 3; index++) {
          const edge = subtract(polygon[(index + 1) % 3], polygon[index]);
          const offset = subtract(polygon[index], a);
          const determinant = cross2(delta, edge);
          if (Math.abs(determinant) < EPSILON) continue;
          const t = cross2(offset, edge) / determinant, u = cross2(offset, delta) / determinant;
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1) entry = Math.min(entry, t);
        }
      }
      if (entry <= exit && (closest === undefined || entry < closest)) closest = entry;
    }
    return closest;
  }

  private candidates(minimum: number[], maximum: number[], start: Vertex, end: Vertex, radius: number): Set<IndexedTriangle> {
    const result = new Set<IndexedTriangle>();
    if (minimum.some((value, axis) => value > this.maximum[axis] || maximum[axis] < this.minimum[axis])) return result;
    const minX = Math.floor(Math.max(minimum[0], this.minimum[0]) / CELL_SIZE);
    const maxX = Math.floor(Math.min(maximum[0], this.maximum[0]) / CELL_SIZE);
    const minZ = Math.floor(Math.max(minimum[2], this.minimum[2]) / CELL_SIZE);
    const maxZ = Math.floor(Math.min(maximum[2], this.maximum[2]) / CELL_SIZE);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (!crossesCell(start, end, x, z, radius)) continue;
      for (const triangle of this.cells.get(`${x},${z}`) ?? []) {
        if (!minimum.some((value, axis) => value > triangle.maximum[axis] || maximum[axis] < triangle.minimum[axis])) {
          result.add(triangle);
        }
      }
    }
    return result;
  }
}

/** Clip a render face against the six cell-prism planes, retaining thin faces. */
export function triangleIntersectsBounds(vertices: Triangle, minimum: number[], maximum: number[]): boolean {
  let polygon = vertices.map(vertex => [...vertex]);
  for (let axis = 0; axis < 3 && polygon.length; axis++) {
    for (const [boundary, sign] of [[minimum[axis], 1], [maximum[axis], -1]]) {
      const clipped: number[][] = [];
      for (let index = 0; index < polygon.length; index++) {
        const a = polygon[index], b = polygon[(index + 1) % polygon.length];
        const da = (a[axis] - boundary) * sign, db = (b[axis] - boundary) * sign;
        if (da >= -EPSILON) clipped.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const fraction = da / (da - db);
          clipped.push(a.map((value, at) => value + (b[at] - value) * fraction));
        }
      }
      polygon = clipped;
    }
  }
  return polygon.length > 0;
}

function cross2(a: Vertex, b: Vertex): number {return a[0] * b[1] - a[1] * b[0];}

function crossesCell(start: Vertex, end: Vertex, x: number, z: number, radius: number): boolean {
  let entry = 0, exit = 1;
  for (const [axis, cell] of [[0, x], [2, z]]) {
    const minimum = cell * CELL_SIZE - radius, maximum = (cell + 1) * CELL_SIZE + radius;
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < EPSILON) {
      if (start[axis] < minimum || start[axis] > maximum) return false;
    } else {
      const first = (minimum - start[axis]) / delta, second = (maximum - start[axis]) / delta;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (entry > exit) return false;
    }
  }
  return true;
}

function inside(point: Vertex, triangle: IndexedTriangle): boolean {
  const {vertices, normal} = triangle;
  return vertices.every((a, index) => dot(cross(subtract(vertices[(index + 1) % 3], a), subtract(point, a)), normal) >= -EPSILON);
}

/** Sweep a sphere against both face sides, finite edge cylinders and vertex spheres. */
function sweepTriangle(start: Vertex, delta: Vertex, triangle: IndexedTriangle, radius: number): number | undefined {
  const {vertices, normal} = triangle;
  let closest: number | undefined;
  const accept = (fraction: number): void => {
    if (fraction >= 0 && fraction <= 1 && (closest === undefined || fraction < closest)) closest = fraction;
  };
  const offset = subtract(start, vertices[0]), distance = dot(offset, normal), speed = dot(delta, normal);
  const projected = start.map((value, axis) => value - distance * normal[axis]);
  if (Math.abs(distance) <= radius + EPSILON && inside(projected, triangle)) accept(0);
  if (Math.abs(speed) > EPSILON) {
    for (const side of [-radius, radius]) {
      const fraction = (side - distance) / speed;
      const point = start.map((value, axis) => value + delta[axis] * fraction - normal[axis] * side);
      if (inside(point, triangle)) accept(fraction);
    }
  }
  for (let index = 0; index < 3; index++) {
    const a = vertices[index], edge = subtract(vertices[(index + 1) % 3], a), length = dot(edge, edge);
    const origin = subtract(start, a);
    for (const fraction of roots(dot(delta, delta), 2 * dot(origin, delta), dot(origin, origin) - radius * radius)) accept(fraction);
    if (length < EPSILON) continue;
    const along = dot(origin, edge) / length, rate = dot(delta, edge) / length;
    const perpendicular = origin.map((value, axis) => value - along * edge[axis]);
    const velocity = delta.map((value, axis) => value - rate * edge[axis]);
    for (const fraction of roots(dot(velocity, velocity), 2 * dot(perpendicular, velocity),
      dot(perpendicular, perpendicular) - radius * radius)) {
      const projection = along + rate * fraction;
      if (projection >= 0 && projection <= 1) accept(fraction);
    }
  }
  return closest;
}

function roots(a: number, b: number, c: number): number[] {
  if (c <= EPSILON) return [0];
  if (a < EPSILON) return [];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -EPSILON) return [];
  const sqrt = Math.sqrt(Math.max(0, discriminant));
  return [(-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a)];
}
