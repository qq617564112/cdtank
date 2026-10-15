import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {allocate, copy, deduplicate, kernels, put, resetMemory} from './kernels.mjs';

/** Convert a publisher's packed source into geometry and texture views ready for upload. */
export function preprocessCvd(path, root) {
  const document = JSON.parse(readFileSync(path));
  if (document.geometryLayout === 1) return;
  const binaryPath = resolve(root, document.binary.slice(1));
  const binary = readFileSync(binaryPath);
  const chunks = [];
  let length = 0;
  const stats = {cvdModels: 1, cvdNodes: 0, cvdFrameVertices: 0,
    cvdUniqueFrameVertices: 0, cvdAnimatedNodes: 0, cvdSourceBytes: binary.length, cvdOutputBytes: 0};
  function append(data) {
    const offset = length;
    chunks.push(data);
    length += data.length;
    return offset;
  }
  for (const node of document.nodes) {
    const data = node.vertexData;
    if (data) {
      resetMemory();
      const {vertexCount: count, frameCount} = data;
      const input = put(binary.subarray(data.offset, data.offset + count * frameCount * 20));
      const unique = deduplicate(input, frameCount, count * 5);
      const positions = allocate(count * 12), uvs = allocate(count * 8), bounds = allocate(24);
      const width = Math.min(8192, count), height = Math.ceil(count * unique.count / width);
      const pixelCount = unique.count > 1 ? width * height : 0;
      const pixels = allocate(pixelCount * 16), vs = allocate(pixelCount * 4), ids = allocate(count * 4);
      // Last-row padding is part of the uploaded texture too.
      new Uint8Array(kernels.memory.buffer, pixels, pixelCount * 16).fill(0);
      new Uint8Array(kernels.memory.buffer, vs, pixelCount * 4).fill(0);
      kernels.packCvd(input, count, frameCount, unique.unique, unique.count, positions, uvs, bounds, pixels, vs, ids);
      const prepared = {vertexCount: count, frameCount, positionOffset: append(copy(positions, count * 12)),
        uvOffset: append(copy(uvs, count * 8)),
        minimum: [...new Float32Array(kernels.memory.buffer, bounds, 3)],
        maximum: [...new Float32Array(kernels.memory.buffer, bounds + 12, 3)]};
      if (data.colorOffset !== undefined) {
        prepared.colorOffset = append(binary.subarray(data.colorOffset, data.colorOffset + count * 16));
      }
      if (unique.count > 1) {
        prepared.frames = {width, height, pixelOffset: append(copy(pixels, pixelCount * 16)),
          vOffset: append(copy(vs, pixelCount * 4)), idOffset: append(copy(ids, count * 4)),
          indexOffset: append(copy(unique.mapping, frameCount * 4))};
        stats.cvdAnimatedNodes++;
      }
      node.vertexData = prepared;
      stats.cvdNodes++;
      stats.cvdFrameVertices += count * frameCount;
      stats.cvdUniqueFrameVertices += count * unique.count;
    }
    for (const kind of ['position', 'rotation', 'scale']) {
      const track = node.animation?.[kind];
      if (!track) continue;
      track.offset = append(binary.subarray(track.offset, track.offset + track.keyCount * track.stride * 4));
    }
  }
  document.geometryLayout = 1;
  writeFileSync(binaryPath, Buffer.concat(chunks));
  writeFileSync(path, JSON.stringify(document) + '\n');
  stats.cvdOutputBytes = length;
  return stats;
}
