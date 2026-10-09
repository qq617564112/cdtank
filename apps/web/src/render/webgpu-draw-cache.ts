import type {AbstractMesh, Material, Mesh} from '@babylonjs/core';
import type {WebGPUDrawContext} from '@babylonjs/core/Engines/WebGPU/webgpuDrawContext';

/** Cached bundles encode the index range and pipeline state of a draw. */
export function invalidateMeshDrawBundles(mesh: AbstractMesh): void {
  for (const subMesh of mesh.subMeshes) {
    for (const wrapper of subMesh._drawWrappers) {
      const context = wrapper?.drawContext as WebGPUDrawContext | undefined;
      if (context) context.fastBundle = undefined;
    }
  }
}

export function setDynamicMeshIndexCount(mesh: Mesh, count: number): void {
  const subMesh = mesh.subMeshes[0];
  if (subMesh.indexCount === count) return;
  subMesh.indexCount = count;
  invalidateMeshDrawBundles(mesh);
}

export function invalidateMaterialDrawBundles(material: Material): void {
  for (const mesh of material.getBindedMeshes()) {
    invalidateMeshDrawBundles(mesh);
  }
}
