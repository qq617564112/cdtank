import {readFileSync} from 'node:fs';

const {instance} = await WebAssembly.instantiate(readFileSync(new URL('./kernels.wasm', import.meta.url)),
  {env: {hypot: Math.hypot}});
export const kernels = instance.exports;
let cursor = 65536;

export function resetMemory() {cursor = 65536;}

export function allocate(bytes) {
  const pointer = cursor;
  cursor = Math.ceil((cursor + bytes) / 8) * 8;
  const missing = cursor - kernels.memory.buffer.byteLength;
  if (missing > 0) kernels.memory.grow(Math.ceil(missing / 65536));
  return pointer;
}

export function put(bytes) {
  const pointer = allocate(bytes.byteLength);
  new Uint8Array(kernels.memory.buffer, pointer, bytes.byteLength).set(bytes);
  return pointer;
}

export function copy(pointer, bytes) {
  return Buffer.from(new Uint8Array(kernels.memory.buffer, pointer, bytes));
}

export function deduplicate(pointer, frames, words) {
  const mapping = allocate(frames * 4), unique = allocate(frames * 4);
  const slots = 2 ** Math.ceil(Math.log2(Math.max(2, frames * 2)));
  const table = allocate(slots * 4);
  const count = kernels.deduplicateFrames(pointer, frames, words, mapping, unique, table, slots);
  return {mapping, unique, count};
}

export function smoothNormals(positions, normals, count) {
  const output = allocate(count * 12), groups = allocate(count * 4), sums = allocate(count * 24);
  const slots = 2 ** Math.ceil(Math.log2(Math.max(2, count * 2)));
  const table = allocate(slots * 4);
  kernels.outlineNormals(positions, normals, count, output, groups, sums, table, slots);
  return copy(output, count * 12);
}
