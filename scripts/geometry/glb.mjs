import {readFileSync, writeFileSync} from 'node:fs';
import {allocate, deduplicate, kernels, put, resetMemory, smoothNormals} from './kernels.mjs';

export const GEOMETRY_EXTENSION = 'CDTANK_precomputed_geometry';
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** Preserve image payloads and original accessor numbering; append derived streams. */
export function preprocessGlb(path) {
  const source = readFileSync(path);
  const chunks = [];
  for (let offset = 12; offset < source.length;) {
    const length = source.readUInt32LE(offset), kind = source.readUInt32LE(offset + 4);
    chunks.push({kind, data: source.subarray(offset + 8, offset + 8 + length)});
    offset += 8 + length;
  }
  const document = JSON.parse(chunks.find(chunk => chunk.kind === JSON_CHUNK).data);
  if (document.asset.extras?.cdtankGeometry === 1) return;
  const binary = chunks.find(chunk => chunk.kind === BIN_CHUNK).data;
  const streams = [binary];
  let byteLength = binary.length;
  const stats = {models: 1, outlineVertices: 0, morphTargets: 0, uniqueMorphTargets: 0,
    staticMorphPrimitives: 0, sourceBytes: source.length, outputBytes: 0};
  function accessorBytes(index) {
    const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
    if (accessor.componentType !== 5126 || view.byteStride || accessor.sparse) {
      throw new Error(`Expected dense float32 geometry: ${path} accessor ${index}`);
    }
    const words = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}[accessor.type];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return binary.subarray(start, start + accessor.count * words * 4);
  }
  function appendAccessor(data, count) {
    const view = document.bufferViews.length;
    document.bufferViews.push({buffer: 0, byteOffset: byteLength, byteLength: data.length, target: 34962});
    streams.push(data);
    byteLength += data.length;
    document.accessors.push({bufferView: view, componentType: 5126, count, type: 'VEC3'});
    return document.accessors.length - 1;
  }
  const staticMeshes = new Set();
  const zero = index => {
    const accessor = document.accessors[index];
    return accessor.componentType === 5126 && accessor.type === 'VEC3'
      && accessor.min?.length === 3 && accessor.max?.length === 3
      && accessor.min.every(value => value === 0) && accessor.max.every(value => value === 0);
  };
  if (document.extras?.mv3Duration !== undefined) {
    for (const [index, mesh] of (document.meshes ?? []).entries()) {
      if (!mesh.primitives.every(primitive => primitive.targets?.length
        && primitive.targets.every(target => Object.keys(target).length === 2
          && target.POSITION !== undefined && target.NORMAL !== undefined
          && zero(target.POSITION) && zero(target.NORMAL)))) continue;
      staticMeshes.add(index);
      for (const primitive of mesh.primitives) {delete primitive.targets; stats.staticMorphPrimitives++;}
      delete mesh.weights;
    }
    for (const node of document.nodes ?? []) if (staticMeshes.has(node.mesh)) delete node.weights;
    for (const animation of document.animations ?? []) {
      animation.channels = animation.channels.filter(channel => channel.target.path !== 'weights'
        || !staticMeshes.has(document.nodes[channel.target.node].mesh));
    }
  }
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const attributes = primitive.attributes;
      if (attributes.POSITION === undefined || attributes.NORMAL === undefined) continue;
      resetMemory();
      const positions = put(accessorBytes(attributes.POSITION));
      const normals = put(accessorBytes(attributes.NORMAL));
      const count = document.accessors[attributes.POSITION].count;
      const extension = {planar: !!kernels.isPlanar(positions, normals, count)};
      if (!primitive.targets?.length) {
        extension.outlineNormal = appendAccessor(smoothNormals(positions, normals, count), count);
        stats.outlineVertices += count;
      } else if (document.extras?.mv3Duration !== undefined
        && primitive.targets.every(target => target.POSITION !== undefined && target.NORMAL !== undefined)) {
        // glTF adds each float32 delta to its base before storing absolute poses.
        const words = count * 3, frameWords = words * 2;
        const poses = allocate(primitive.targets.length * frameWords * 4);
        for (const [index, target] of primitive.targets.entries()) {
          const positionDelta = put(accessorBytes(target.POSITION));
          const normalDelta = put(accessorBytes(target.NORMAL));
          kernels.absolutePose(positions, positionDelta, poses + index * frameWords * 4, words);
          kernels.absolutePose(normals, normalDelta, poses + (index * frameWords + words) * 4, words);
        }
        const result = deduplicate(poses, primitive.targets.length, frameWords);
        extension.morphLayers = [...new Uint32Array(kernels.memory.buffer, result.mapping, primitive.targets.length)];
        stats.morphTargets += primitive.targets.length;
        stats.uniqueMorphTargets += result.count;
      }
      if (Object.keys(extension).length) {
        (primitive.extensions ??= {})[GEOMETRY_EXTENSION] = extension;
      }
    }
  }
  if (document.meshes?.some(mesh => mesh.primitives.some(primitive => primitive.extensions?.[GEOMETRY_EXTENSION]))) {
    const used = document.extensionsUsed ??= [];
    if (!used.includes(GEOMETRY_EXTENSION)) used.push(GEOMETRY_EXTENSION);
  }
  (document.asset.extras ??= {}).cdtankGeometry = 1;
  document.buffers[0].byteLength = byteLength;
  const json = Buffer.from(JSON.stringify(document));
  const jsonPadding = Buffer.alloc((-json.length & 3), 0x20);
  for (const chunk of chunks) {
    if (chunk.kind === JSON_CHUNK) chunk.data = Buffer.concat([json, jsonPadding]);
    if (chunk.kind === BIN_CHUNK) chunk.data = Buffer.concat(streams);
  }
  const body = chunks.flatMap(chunk => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(chunk.data.length);
    header.writeUInt32LE(chunk.kind, 4);
    return [header, chunk.data];
  });
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.reduce((sum, data) => sum + data.length, 0), 8);
  const output = Buffer.concat([header, ...body]);
  writeFileSync(path, output);
  stats.outputBytes = output.length;
  return stats;
}
