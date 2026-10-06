import {readFileSync} from 'node:fs';
import {webAssetPath} from './runtime/content-paths';
import {CollisionMesh, type Triangle, type Vertex} from './collision-mesh';

interface Accessor {bufferView: number; byteOffset?: number; componentType: number; count: number; type: string;}
interface BufferView {buffer: number; byteOffset?: number; byteLength: number; byteStride?: number;}
interface Primitive {attributes: {POSITION: number}; indices?: number; mode?: number; targets?: {POSITION?: number}[];}
interface ModelNode {
  mesh?: number; children?: number[]; matrix?: number[]; translation?: number[];
  rotation?: number[]; scale?: number[]; weights?: number[];
}
interface Gltf {
  accessors: Accessor[]; bufferViews: BufferView[]; meshes: {primitives: Primitive[]; weights?: number[]}[];
  nodes: ModelNode[]; scenes: {nodes: number[]}[]; scene?: number;
}
interface CvdTrack {mode: number; keys: number[][];}
interface CvdNode {
  parent?: number | null; vertices?: number[][]; frames?: number[][][];
  animation?: {position: CvdTrack; rotation: CvdTrack; scale: CvdTrack; value: number};
  parts: {indices: number[]}[];
}
interface CvdLibrary {resources: {reference: string; resolution: string; nodes: CvdNode[]}[];}

export const COLLISION_IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const models = new Map<string, readonly Triangle[]>();
const libraries = new Map<string, CvdLibrary>();

/** GLB coordinates stay in native space; the browser's X reflection is a display transform. */
export function loadGlbTriangles(asset: string): readonly Triangle[] {
  const cached = models.get(asset);
  if (cached) return cached;
  const file = readFileSync(webAssetPath(asset));
  if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2) throw new Error(`无效渲染模型：${asset}`);
  let gltf: Gltf | undefined, binary: Buffer | undefined;
  for (let offset = 12; offset < file.length;) {
    const length = file.readUInt32LE(offset), kind = file.readUInt32LE(offset + 4);
    const chunk = file.subarray(offset + 8, offset + 8 + length);
    if (kind === 0x4e4f534a) gltf = JSON.parse(chunk.toString('utf8')) as Gltf;
    if (kind === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  if (!gltf || !binary) throw new Error(`渲染模型缺少几何数据：${asset}`);
  const data = gltf, buffer = binary;
  const accessor = (index: number, components: number): number[][] => {
    const source = data.accessors[index], view = data.bufferViews[source.bufferView];
    if (view.buffer !== 0) throw new Error(`渲染模型需要内嵌几何：${asset}`);
    const readers: Record<number, {size: number; read: (offset: number) => number}> = {
      5121: {size: 1, read: offset => buffer.readUInt8(offset)},
      5123: {size: 2, read: offset => buffer.readUInt16LE(offset)},
      5125: {size: 4, read: offset => buffer.readUInt32LE(offset)},
      5126: {size: 4, read: offset => buffer.readFloatLE(offset)},
    };
    const reader = readers[source.componentType];
    if (!reader || source.type !== (components === 3 ? 'VEC3' : 'SCALAR')) throw new Error(`不支持的渲染几何格式：${asset}`);
    const stride = view.byteStride ?? components * reader.size;
    const base = (view.byteOffset ?? 0) + (source.byteOffset ?? 0);
    return Array.from({length: source.count}, (_, at) => Array.from({length: components},
      (_, axis) => reader.read(base + at * stride + axis * reader.size)));
  };
  const triangles: Triangle[] = [];
  const visit = (index: number, parent: number[]): void => {
    const node = data.nodes[index];
    const local = node.matrix ?? compose(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1]);
    const world = multiply(parent, local);
    if (node.mesh !== undefined) {
      const mesh = data.meshes[node.mesh];
      for (const primitive of mesh.primitives) {
        if ((primitive.mode ?? 4) !== 4) throw new Error(`渲染碰撞需要三角面：${asset}`);
        const positions = accessor(primitive.attributes.POSITION, 3);
        const weights = node.weights ?? mesh.weights ?? [];
        primitive.targets?.forEach((target, at) => {
          if (!weights[at] || target.POSITION === undefined) return;
          const offsets = accessor(target.POSITION, 3);
          positions.forEach((point, vertex) => point.forEach((value, axis) => {
            point[axis] = value + offsets[vertex][axis] * weights[at];
          }));
        });
        const vertices = positions.map(vertex => transform(world, vertex));
        const indices = primitive.indices === undefined ? vertices.map((_, at) => at)
          : accessor(primitive.indices, 1).map(value => value[0]);
        for (let at = 0; at < indices.length; at += 3) triangles.push(
          [vertices[indices[at]], vertices[indices[at + 1]], vertices[indices[at + 2]]]);
      }
    }
    node.children?.forEach(child => {visit(child, world);});
  };
  data.scenes[data.scene ?? 0].nodes.forEach(index => {visit(index, COLLISION_IDENTITY);});
  models.set(asset, triangles);
  return triangles;
}

/** The same CVD node hierarchy and vertex frame used by the renderer at time zero. */
export function loadCvdTriangles(asset: string, reference: string): readonly Triangle[] {
  const key = `${asset}:${reference}`;
  const cached = models.get(key);
  if (cached) return cached;
  let library = libraries.get(asset);
  if (!library) {
    library = JSON.parse(readFileSync(webAssetPath(asset), 'utf8')) as CvdLibrary;
    libraries.set(asset, library);
  }
  const resource = library.resources.find(value => value.reference === reference);
  if (!resource || resource.resolution !== 'published') throw new Error(`缺少场景渲染几何：${reference}`);
  const matrices: number[][] = [], triangles: Triangle[] = [];
  resource.nodes.forEach((node, index) => {
    const local = node.animation ? cvdInitialMatrix(node.animation) : COLLISION_IDENTITY;
    matrices[index] = multiply(node.parent == null ? COLLISION_IDENTITY : matrices[node.parent], local, true);
    const vertices = (node.animation ? node.frames![0].map(vertex => vertex.slice(5, 8)) : node.vertices ?? [])
      .map(vertex => transform(matrices[index], vertex));
    for (const part of node.parts) for (let at = 0; at < part.indices.length; at += 3) {
      triangles.push([vertices[part.indices[at]], vertices[part.indices[at + 1]], vertices[part.indices[at + 2]]]);
    }
  });
  models.set(key, triangles);
  return triangles;
}

export function placedCollisionMesh(triangles: readonly Triangle[], matrix: number[], position: number[]): CollisionMesh {
  const world = [...matrix];
  [world[12], world[13], world[14]] = position;
  return new CollisionMesh(triangles.map((triangle): Triangle =>
    [transform(world, triangle[0]), transform(world, triangle[1]), transform(world, triangle[2])]));
}

function transform(matrix: number[], vertex: Vertex): number[] {
  return [0, 1, 2].map(axis => matrix[axis] * vertex[0] + matrix[4 + axis] * vertex[1]
    + matrix[8 + axis] * vertex[2] + matrix[12 + axis]);
}

function multiply(left: number[], right: number[], rounded = false): number[] {
  const result = new Array<number>(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    const value = ((left[row] * right[column * 4] + left[row + 4] * right[column * 4 + 1])
      + left[row + 8] * right[column * 4 + 2]) + left[row + 12] * right[column * 4 + 3];
    result[column * 4 + row] = rounded ? Math.fround(value) : value;
  }
  return result;
}

function compose(position: number[], rotation: number[], scale: number[]): number[] {
  const result = quaternionMatrix(rotation);
  scale.forEach((value, axis) => {for (let row = 0; row < 3; row++) result[axis * 4 + row] *= value;});
  [result[12], result[13], result[14]] = position;
  return result;
}

function quaternionMatrix([x, y, z, w]: number[], rounded = false): number[] {
  const f = rounded ? Math.fround : (value: number): number => value;
  const yy = f(2 * y * y), zz = f(2 * z * z), xz = f(2 * x * z);
  const xw = f(2 * x * w), yz = f(2 * y * z), yw = f(2 * y * w);
  const xy = 2 * x * y, xx = 2 * x * x, zw = 2 * z * w;
  return [f(1 - yy - zz), f(zw + xy), f(xz - yw), 0, f(xy - zw), f(1 - xx - zz), f(yz + xw), 0,
    f(yw + xz), f(yz - xw), f(1 - xx - yy), 0, 0, 0, 0, 1];
}

function cvdInitialMatrix(animation: NonNullable<CvdNode['animation']>): number[] {
  const initial = (track: CvdTrack): number[] => {
    if (track.mode !== 3) throw new Error(`不支持的场景动画轨道：${track.mode}`);
    return track.keys[0];
  };
  const position = initial(animation.position).slice(2, 5), rotation = initial(animation.rotation).slice(2, 6);
  const scale = initial(animation.scale), orientation = scale.slice(5, 9);
  const uniform = Buffer.alloc(4);
  uniform.writeUInt32LE(animation.value);
  const amount = uniform.readFloatLE();
  const scaling = (values: number[]): number[] => [values[0], 0, 0, 0, 0, values[1], 0, 0, 0, 0, values[2], 0, 0, 0, 0, 1];
  let matrix = [...COLLISION_IDENTITY];
  [matrix[12], matrix[13], matrix[14]] = position;
  matrix = multiply(matrix, scaling([amount, amount, amount]), true);
  matrix = multiply(matrix, quaternionMatrix([rotation[0], rotation[1], rotation[2], -rotation[3]], true), true);
  matrix = multiply(matrix, quaternionMatrix([orientation[0], orientation[1], orientation[2], -orientation[3]], true), true);
  matrix = multiply(matrix, scaling(scale.slice(2, 5)), true);
  return multiply(matrix, quaternionMatrix(orientation, true), true);
}
