import {InstancedMesh, Mesh} from '@babylonjs/core';

let installed = false;

function releaseInstancedRenderPasses(mesh: Mesh): void {
  for (const id in mesh._instanceDataStorage.renderPasses) mesh._releaseRenderPassId(Number(id));
  const passes = mesh._userInstancedBuffersStorage?.renderPasses;
  if (passes) {
    for (const id in passes) mesh._releaseRenderPassId(Number(id));
  }
}

/** Keep Babylon 9.29's per-pass instance buffers sized and owned by their mesh. */
export function installWebGpuInstancedBuffers(): void {
  if (installed) return;
  installed = true;
  const processInstancedBuffers = Mesh.prototype._processInstancedBuffers;
  Mesh.prototype._processInstancedBuffers = function(this: Mesh, visibleInstances, renderSelf): void {
    const storage = this._userInstancedBuffersStorage;
    const buffers = storage?.renderPasses?.[this.getEngine().currentRenderPassId];
    if (buffers) {
      for (const kind in storage.strides) {
        const buffer = buffers[kind];
        // Another pass may have grown the shared array since this VBO was created.
        if (buffer && (buffer.getBuffer()?.capacity ?? 0) < storage.data[kind].byteLength) {
          buffer.dispose();
          buffers[kind] = null;
          this._invalidateInstanceVertexArrayObject();
        }
      }
    }
    // Native processing fills instance values and recreates any missing VBOs.
    processInstancedBuffers.call(this, visibleInstances, renderSelf);
  };

  const disposeInstances = Mesh.prototype._disposeInstanceSpecificData;
  Mesh.prototype._disposeInstanceSpecificData = function(this: Mesh): void {
    // Native disposal omits per-pass custom attributes and previous matrices.
    releaseInstancedRenderPasses(this);
    disposeInstances.call(this);
  };
  const rebuild = Mesh.prototype._rebuild;
  Mesh.prototype._rebuild = function(this: Mesh, dispose = false): void {
    // A buffer from the old device can have the right capacity but still be invalid.
    releaseInstancedRenderPasses(this);
    rebuild.call(this, dispose);
  };

  const releaseInstancePass = InstancedMesh.prototype._releaseRenderPassId;
  InstancedMesh.prototype._releaseRenderPassId = function(this: InstancedMesh, id: number): void {
    // AssetContainer sources need not be in scene.meshes, which native pass
    // release visits. Their visible instances keep the source reachable here.
    const source = this.sourceMesh;
    source._releaseRenderPassId(id);
    for (const subMesh of source.subMeshes) subMesh._removeDrawWrapper(id);
    releaseInstancePass.call(this, id);
  };
}
