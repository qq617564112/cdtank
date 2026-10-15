import type {WebGPUDataBuffer} from '@babylonjs/core/Meshes/WebGPU/webgpuDataBuffer';
import {Geometry, type WebGPUEngine} from '@babylonjs/core';

let installed = false;

function hasCurrentDeviceBuffers(geometry: Geometry, deviceId: number): boolean {
  const buffers = geometry.getVertexBuffers();
  if (!buffers) return false;
  let hasVertices = false;
  for (const kind in buffers) {
    hasVertices = true;
    // Match the wrapper native Geometry._rebuild uses, including aligned data.
    const buffer = buffers[kind].getWrapperBuffer().getBuffer() as WebGPUDataBuffer | null;
    if (buffer?.engineId !== deviceId) return false;
  }
  if (!hasVertices) return false;
  const indices = geometry.getIndexBuffer() as WebGPUDataBuffer | null;
  return !geometry.getIndices()?.length || indices?.engineId === deviceId;
}

/** Rebuild shared scene/container geometry once per WebGPU device. */
export function installWebGpuGeometryRebuild(): void {
  if (installed) return;
  installed = true;
  const rebuild = Geometry.prototype._rebuild;
  Geometry.prototype._rebuild = function(this: Geometry): void {
    const engine = this.getEngine();
    if (engine.isWebGPU && hasCurrentDeviceBuffers(this, (engine as WebGPUEngine).uniqueId)) return;
    rebuild.call(this);
  };
}
