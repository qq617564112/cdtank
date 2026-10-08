import {readFileSync} from 'node:fs';
import {webAssetPath} from './runtime/content-paths';
import {CollisionMesh, type Triangle, type Vertex} from './collision-mesh';
import {ANIMATION_IDENTITY, animationMatrix, loopAnimationTime, sampleAnimationVertices,
  type AnimationTransform} from '../../shared/movement/animation-sampling';

interface Accessor {bufferView: number; byteOffset?: number; componentType: number; count: number; type: string;}
interface BufferView {buffer: number; byteOffset?: number; byteLength: number; byteStride?: number;}
interface Primitive {attributes: {POSITION: number}; indices?: number; mode?: number; targets?: {POSITION?: number}[];}
interface ModelNode {
  mesh?: number; children?: number[]; matrix?: number[]; translation?: number[];
  rotation?: number[]; scale?: number[]; weights?: number[];
}
interface GltfMesh {primitives: Primitive[]; weights?: number[];}
interface GltfAnimation {
  samplers: {input: number; output: number; interpolation?: string}[];
  channels: {sampler: number; target: {node?: number; path: string}}[];
}
interface Gltf {
  accessors: Accessor[]; bufferViews: BufferView[]; meshes: GltfMesh[];
  nodes: ModelNode[]; scenes: {nodes: number[]}[]; scene?: number;
  animations?: GltfAnimation[];
}
interface CvdNode {
  parent?: number | null; vertices?: number[][]; frames?: number[][][]; times?: number[]; duration?: number;
  animation?: AnimationTransform; parts: {indices: number[]}[];
}
interface CvdLibrary {resources: {reference: string; resolution: string; nodes: CvdNode[]}[];}
interface GlbModel {data: Gltf; buffer: Buffer; triangles: readonly Triangle[];}
interface CvdModel {resource: CvdLibrary['resources'][number]; triangles: readonly Triangle[];}
interface AnimatedNode {
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

export const COLLISION_IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const models = new Map<string, readonly Triangle[]>();
const glbs = new Map<string, GlbModel>();
const libraries = new Map<string, CvdLibrary>();

/** GLB coordinates stay in native space; the browser's X reflection is a display transform. */
export function loadGlbTriangles(asset: string): readonly Triangle[] {
  return glbModel(asset).triangles;
}

/** Current node/morph state for one GLB, sampled at round-relative seconds. */
export function sampleGlbTriangles(asset: string, time: number, loop = true): readonly Triangle[] {
  const model = glbModel(asset);
  const animations = model.data.animations;
  if (!animations?.length) return model.triangles;
  const weights = new Map<number, number[]>();
  const transforms = new Map<number, AnimatedNode>();
  for (const animation of animations) {
    for (const {sampler, target} of animation.channels) {
      const nodeIndex = target.node;
      if (nodeIndex === undefined) continue;
      const source = animation.samplers[sampler];
      const times = accessorValues(model, source.input, 1).map(value => value[0]);
      if (!times.length) continue;
      const path = target.path;
      const local = loop ? loopAnimationTime(time, times[times.length - 1]) : time;
      if (path === 'weights') {
        if (weights.has(nodeIndex) || model.data.nodes[nodeIndex].mesh === undefined) continue;
        const count = model.data.meshes[model.data.nodes[nodeIndex].mesh!].primitives[0].targets?.length ?? 1;
        const flat = accessorValues(model, source.output, 1).map(value => value[0]);
        const values = times.map((_, at) => flat.slice(at * count, (at + 1) * count));
        weights.set(nodeIndex, sampleLinear(times, values, local));
        continue;
      }
      if (path !== 'translation' && path !== 'rotation' && path !== 'scale') continue;
      const transform = transforms.get(nodeIndex) ?? {};
      if (transform[path] !== undefined) continue;
      const components = path === 'rotation' ? 4 : 3;
      const values = accessorValues(model, source.output, components);
      const value = path === 'rotation'
        ? sampleRotation(times, values, local)
        : sampleLinear(times, values, local);
      transform[path] = value;
      transforms.set(nodeIndex, transform);
    }
  }
  if (!weights.size && !transforms.size) return model.triangles;
  const matrices = worldMatrices(model.data, transforms);
  const triangles: Triangle[] = [];
  model.data.nodes.forEach((node, index) => {
    if (node.mesh === undefined) return;
    const mesh = model.data.meshes[node.mesh];
    const nodeWeights = weights.get(index) ?? node.weights ?? mesh.weights ?? [];
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4) throw new Error(`渲染碰撞需要三角面：${asset}`);
      const positions = accessorValues(model, primitive.attributes.POSITION, 3).map(vertex => vertex.slice());
      primitive.targets?.forEach((target, at) => {
        if (target.POSITION === undefined || !nodeWeights[at]) return;
        const offsets = accessorValues(model, target.POSITION, 3);
        positions.forEach((point, vertex) => point.forEach((value, axis) => {
          point[axis] = value + offsets[vertex][axis] * nodeWeights[at];
        }));
      });
      const vertices = positions.map(vertex => transform(matrices[index], vertex));
      const indices = primitive.indices === undefined ? vertices.map((_, at) => at)
        : accessorValues(model, primitive.indices, 1).map(value => value[0]);
      for (let at = 0; at < indices.length; at += 3) triangles.push(
        [vertices[indices[at]], vertices[indices[at + 1]], vertices[indices[at + 2]]]);
    }
  });
  return triangles;
}

export function hasGlbAnimation(asset: string): boolean {
  return !!glbModel(asset).data.animations?.length;
}

function sampleLinear(times: readonly number[], values: readonly number[][], time: number): number[] {
  let index = 0;
  while (index + 1 < times.length - 1 && times[index + 1] <= time) ++index;
  const next = Math.min(index + 1, values.length - 1);
  const start = times[index] ?? 0, end = times[next] ?? start;
  const fraction = end > start ? Math.min(1, Math.max(0, (time - start) / (end - start))) : 0;
  const first = values[index] ?? [], second = values[next] ?? first;
  return first.map((value, at) => (1 - fraction) * value + fraction * (second[at] ?? value));
}

function sampleRotation(times: readonly number[], values: readonly number[][], time: number): number[] {
  let index = 0;
  while (index + 1 < times.length - 1 && times[index + 1] <= time) ++index;
  const next = Math.min(index + 1, values.length - 1);
  const start = times[index] ?? 0, end = times[next] ?? start;
  const fraction = end > start ? Math.min(1, Math.max(0, (time - start) / (end - start))) : 0;
  const first = values[index] ?? values[next] ?? [0, 0, 0, 1];
  let second = values[next] ?? first;
  let dot = first.reduce((sum, value, at) => sum + value * second[at], 0);
  if (dot < 0) {
    dot = -dot;
    second = second.map(value => -value);
  }
  if (dot > .9995) {
    return first.map((value, at) => value + (second[at] - value) * fraction);
  }
  const angle = Math.acos(Math.min(1, dot));
  const sine = Math.sin(angle);
  const firstWeight = Math.sin((1 - fraction) * angle) / sine;
  const secondWeight = Math.sin(fraction * angle) / sine;
  return first.map((value, at) => firstWeight * value + secondWeight * second[at]);
}

function glbModel(asset: string): GlbModel {
  const cached = glbs.get(asset);
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
  const model: GlbModel = {data: gltf, buffer: binary, triangles: []};
  model.triangles = buildGlbTriangles(asset, model);
  glbs.set(asset, model);
  return model;
}

function buildGlbTriangles(asset: string, model: GlbModel): readonly Triangle[] {
  const triangles: Triangle[] = [];
  const matrices = worldMatrices(model.data);
  model.data.nodes.forEach((node, index) => {
    if (node.mesh === undefined) return;
    const mesh = model.data.meshes[node.mesh];
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4) throw new Error(`渲染碰撞需要三角面：${asset}`);
      const positions = accessorValues(model, primitive.attributes.POSITION, 3);
      const weights = node.weights ?? mesh.weights ?? [];
      primitive.targets?.forEach((target, at) => {
        if (!weights[at] || target.POSITION === undefined) return;
        const offsets = accessorValues(model, target.POSITION, 3);
        positions.forEach((point, vertex) => point.forEach((value, axis) => {
          point[axis] = value + offsets[vertex][axis] * weights[at];
        }));
      });
      const vertices = positions.map(vertex => transform(matrices[index], vertex));
      const indices = primitive.indices === undefined ? vertices.map((_, at) => at)
        : accessorValues(model, primitive.indices, 1).map(value => value[0]);
      for (let at = 0; at < indices.length; at += 3) triangles.push(
        [vertices[indices[at]], vertices[indices[at + 1]], vertices[indices[at + 2]]]);
    }
  });
  return triangles;
}

function worldMatrices(data: Gltf, transforms?: ReadonlyMap<number, AnimatedNode>): number[][] {
  const matrices: number[][] = [];
  const visit = (index: number, parent: number[]): void => {
    const node = data.nodes[index];
    const transform = transforms?.get(index);
    const local = node.matrix ?? compose(transform?.translation ?? node.translation ?? [0, 0, 0],
      transform?.rotation ?? node.rotation ?? [0, 0, 0, 1],
      transform?.scale ?? node.scale ?? [1, 1, 1]);
    matrices[index] = multiply(parent, local);
    node.children?.forEach(child => {visit(child, matrices[index]);});
  };
  data.scenes[data.scene ?? 0].nodes.forEach(index => {visit(index, COLLISION_IDENTITY);});
  return matrices;
}

function accessorValues(model: GlbModel, index: number, components: number): number[][] {
  const source = model.data.accessors[index], view = model.data.bufferViews[source.bufferView];
  if (view.buffer !== 0) throw new Error('渲染模型需要内嵌几何');
  const readers: Record<number, {size: number; read: (offset: number) => number}> = {
    5121: {size: 1, read: offset => model.buffer.readUInt8(offset)},
    5123: {size: 2, read: offset => model.buffer.readUInt16LE(offset)},
    5125: {size: 4, read: offset => model.buffer.readUInt32LE(offset)},
    5126: {size: 4, read: offset => model.buffer.readFloatLE(offset)},
  };
  const reader = readers[source.componentType];
  if (!reader || source.type !== (components === 3 ? 'VEC3' : components === 1 ? 'SCALAR' : components === 2 ? 'VEC2' : 'VEC4')) {
    throw new Error('不支持的渲染几何格式');
  }
  const stride = view.byteStride ?? components * reader.size;
  const base = (view.byteOffset ?? 0) + (source.byteOffset ?? 0);
  return Array.from({length: source.count}, (_, at) => Array.from({length: components},
    (_, axis) => reader.read(base + at * stride + axis * reader.size)));
}

/** The same CVD node hierarchy and vertex frame used by the renderer at time zero. */
export function loadCvdTriangles(asset: string, reference: string): readonly Triangle[] {
  return cvdModel(asset, reference).triangles;
}

/** Current CVD node hierarchy, transform tracks and vertex frames at round-relative seconds. */
export function sampleCvdTriangles(asset: string, reference: string, time: number): readonly Triangle[] {
  const model = cvdModel(asset, reference);
  const matrices: number[][] = [], triangles: Triangle[] = [];
  model.resource.nodes.forEach((node, index) => {
    const local = Math.fround(loopAnimationTime(Math.fround(Math.max(0, time)), node.duration ?? 0));
    const localMatrix = node.animation ? animationMatrix(node.animation, local) : COLLISION_IDENTITY;
    matrices[index] = multiply(node.parent == null ? COLLISION_IDENTITY : matrices[node.parent], localMatrix, true);
    const vertices = (node.animation && node.frames && node.times
      ? sampleAnimationVertices({frames: node.frames, times: node.times}, local)
      : node.vertices ?? []).map(vertex => transform(matrices[index], vertex));
    for (const part of node.parts) for (let at = 0; at < part.indices.length; at += 3) {
      triangles.push([vertices[part.indices[at]], vertices[part.indices[at + 1]], vertices[part.indices[at + 2]]]);
    }
  });
  return triangles;
}

function cvdModel(asset: string, reference: string): CvdModel {
  const key = `${asset}:${reference}`;
  let library = libraries.get(asset);
  if (!library) {
    library = JSON.parse(readFileSync(webAssetPath(asset), 'utf8')) as CvdLibrary;
    libraries.set(asset, library);
  }
  const resource = library.resources.find(value => value.reference === reference);
  if (!resource || resource.resolution !== 'published') throw new Error(`缺少场景渲染几何：${reference}`);
  const cached = models.get(key);
  if (cached) return {resource, triangles: cached};
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
  return {resource, triangles};
}

export function placedCollisionMesh(triangles: readonly Triangle[], matrix: number[], position: number[]): CollisionMesh {
  const world = [...matrix];
  [world[12], world[13], world[14]] = position;
  return new CollisionMesh(triangles.map((triangle): Triangle =>
    [transform(world, triangle[0]), transform(world, triangle[1]), transform(world, triangle[2])]));
}

function transform(matrix: readonly number[], vertex: Vertex): number[] {
  return [0, 1, 2].map(axis => matrix[axis] * vertex[0] + matrix[4 + axis] * vertex[1]
    + matrix[8 + axis] * vertex[2] + matrix[12 + axis]);
}

function multiply(left: readonly number[], right: readonly number[], rounded = false): number[] {
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

function quaternionMatrix([x, y, z, w]: readonly number[], rounded = false): number[] {
  const f = rounded ? Math.fround : (value: number): number => value;
  const yy = f(2 * y * y), zz = f(2 * z * z), xz = f(2 * x * z);
  const xw = f(2 * x * w), yz = f(2 * y * z), yw = f(2 * y * w);
  const xy = 2 * x * y, xx = 2 * x * x, zw = 2 * z * w;
  return [f(1 - yy - zz), f(zw + xy), f(xz - yw), 0, f(xy - zw), f(1 - xx - zz), f(yz + xw), 0,
    f(yw + xz), f(yz - xw), f(1 - xx - yy), 0, 0, 0, 0, 1];
}

function cvdInitialMatrix(animation: AnimationTransform): number[] {
  return animationMatrix(animation, 0);
}
