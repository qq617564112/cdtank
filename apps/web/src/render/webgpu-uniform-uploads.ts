import type {WebGPUEngine} from '@babylonjs/core';

interface UniformPage {
  readonly buffer: GPUBuffer;
  readonly bytes: Uint8Array;
  readonly free: {offset: number; size: number}[];
  used: number;
  allocations: number;
}

interface UniformAllocation {
  readonly page: UniformPage;
  readonly offset: number;
  readonly capacity: number;
  readonly destroy: GPUBuffer['destroy'];
}

/** Snapshot independent uniforms into aligned page ranges before native submissions. */
export function installWebGpuUniformUploads(engine: WebGPUEngine): () => void {
  const device = engine._device;
  const queue = device.queue;
  const manager = engine._bufferManager;
  const createRawBuffer = manager.createRawBuffer;
  const setRawData = manager.setRawData;
  const createBindGroup = device.createBindGroup;
  const submit = queue.submit;
  const allocations = new Map<GPUBuffer, UniformAllocation>();
  const pages = new Set<UniformPage>();
  const dirty = new Set<UniformPage>();
  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const uniformUsage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;

  function release(buffer: GPUBuffer, allocation: UniformAllocation): void {
    allocations.delete(buffer);
    buffer.destroy = allocation.destroy;
    allocation.destroy.call(buffer);
    const page = allocation.page;
    if (--page.allocations === 0) {
      dirty.delete(page);
      pages.delete(page);
      page.buffer.destroy();
      return;
    }
    const ranges = page.free;
    let index = 0;
    while (index < ranges.length && ranges[index].offset < allocation.offset) index++;
    ranges.splice(index, 0, {offset: allocation.offset, size: allocation.capacity});
    // Adjacent released slots form one range for subsequent native allocations.
    if (index > 0 && ranges[index - 1].offset + ranges[index - 1].size === ranges[index].offset) {
      ranges[index - 1].size += ranges[index].size;
      ranges.splice(index--, 1);
    }
    if (index + 1 < ranges.length && ranges[index].offset + ranges[index].size === ranges[index + 1].offset) {
      ranges[index].size += ranges[index + 1].size;
      ranges.splice(index + 1, 1);
    }
  }

  manager.createRawBuffer = (source, flags, mappedAtCreation, label) => {
    const buffer = createRawBuffer.call(manager, source, flags, mappedAtCreation, label);
    if (flags !== uniformUsage || mappedAtCreation) return buffer;
    const capacity = Math.ceil(buffer.size / alignment) * alignment;
    let page: UniformPage | undefined;
    let index = -1;
    for (const candidate of pages) {
      index = candidate.free.findIndex(range => range.size >= capacity);
      if (index >= 0) {page = candidate; break;}
    }
    if (!page) {
      const size = Math.max(64 * 1024, capacity);
      page = {buffer: device.createBuffer({label: 'Battle uniform page', size, usage: uniformUsage}),
        bytes: new Uint8Array(size), free: [{offset: 0, size}], used: 0, allocations: 0};
      pages.add(page);
      index = 0;
    }
    const range = page.free[index];
    const offset = range.offset;
    range.offset += capacity;
    range.size -= capacity;
    if (!range.size) page.free.splice(index, 1);
    page.used = Math.max(page.used, offset + capacity);
    page.allocations++;
    // Reused native buffers begin with zero data, including partial first uploads.
    page.bytes.fill(0, offset, offset + capacity);
    dirty.add(page);
    const allocation = {page, offset, capacity, destroy: buffer.destroy};
    allocations.set(buffer, allocation);
    buffer.destroy = () => {release(buffer, allocation);};
    return buffer;
  };

  manager.setRawData = (buffer, offset, source, sourceOffset, size) => {
    const allocation = allocations.get(buffer);
    if (!allocation) {
      setRawData.call(manager, buffer, offset, source, sourceOffset, size);
      return;
    }
    if (!size) return;
    const {page} = allocation;
    page.bytes.set(new Uint8Array(source.buffer, source.byteOffset + sourceOffset, size), allocation.offset + offset);
    dirty.add(page);
  };

  device.createBindGroup = descriptor => createBindGroup.call(device, {
    ...descriptor,
    entries: Array.from(descriptor.entries, entry => {
      const resource = entry.resource;
      const allocation = 'buffer' in resource ? allocations.get(resource.buffer) : undefined;
      if (!allocation || !('buffer' in resource)) return entry;
      return {...entry, resource: {buffer: allocation.page.buffer,
        offset: allocation.offset + (resource.offset ?? 0),
        size: resource.size ?? resource.buffer.size - (resource.offset ?? 0)}};
    }),
  });

  queue.submit = commands => {
    if (!dirty.size) {submit.call(queue, commands); return;}
    let size = 0;
    for (const page of dirty) size += page.used;
    const staging = device.createBuffer({label: 'Battle uniform snapshots', size,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC, mappedAtCreation: true});
    try {
      const bytes = new Uint8Array(staging.getMappedRange());
      let offset = 0;
      for (const page of dirty) {bytes.set(page.bytes.subarray(0, page.used), offset); offset += page.used;}
      staging.unmap();
      const encoder = device.createCommandEncoder({label: 'Battle uniform copies'});
      offset = 0;
      for (const page of dirty) {
        encoder.copyBufferToBuffer(staging, offset, page.buffer, 0, page.used);
        offset += page.used;
      }
      // Preserve the native order of texture/readback and frame submissions.
      submit.call(queue, [encoder.finish(), ...commands]);
    } finally {
      staging.destroy();
      dirty.clear();
    }
  };

  return () => {
    manager.createRawBuffer = createRawBuffer;
    manager.setRawData = setRawData;
    device.createBindGroup = createBindGroup;
    queue.submit = submit;
    for (const [buffer, allocation] of allocations) buffer.destroy = allocation.destroy;
    allocations.clear();
    for (const page of pages) page.buffer.destroy();
    pages.clear();
    dirty.clear();
  };
}
