interface VertexBinding {
  buffer: GPUBuffer | null | undefined;
  offset: number;
  size: number | undefined;
}

/** Reuse unchanged bindings within one native render pass. */
export function cacheRenderPassBindings(pass: GPURenderPassEncoder): void {
  let pipeline: GPURenderPipeline | undefined;
  const vertices: VertexBinding[] = [];
  const setPipeline = pass.setPipeline;
  const setVertexBuffer = pass.setVertexBuffer;
  const executeBundles = pass.executeBundles;

  pass.setPipeline = next => {
    if (next === pipeline) return;
    setPipeline.call(pass, next);
    pipeline = next;
  };
  pass.setVertexBuffer = (slot, buffer, offset = 0, size) => {
    const previous = vertices[slot];
    if (previous && previous.buffer === buffer && previous.offset === offset && previous.size === size) return;
    setVertexBuffer.call(pass, slot, buffer, offset, size);
    if (previous) {
      previous.buffer = buffer;
      previous.offset = offset;
      previous.size = size;
    } else {
      vertices[slot] = {buffer, offset, size};
    }
  };
  pass.executeBundles = bundles => {
    // WebGPU clears pipeline and vertex bindings when executing bundles.
    pipeline = undefined;
    vertices.length = 0;
    executeBundles.call(pass, bundles);
  };
}
