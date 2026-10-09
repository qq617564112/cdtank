import type {AbstractMesh, Scene} from '@babylonjs/core';

/** Preloaded inactive actions do not need material readiness or LOD evaluation. */
export function selectEnabledMeshCandidates(scene: Scene): void {
  const candidates: {data: AbstractMesh[]; length: number} = {data: [], length: 0};
  scene.getActiveMeshCandidates = () => {
    let count = 0;
    for (const mesh of scene.meshes) {
      if (mesh.isEnabled()) candidates.data[count++] = mesh;
    }
    candidates.data.length = count;
    candidates.length = count;
    return candidates;
  };
}
