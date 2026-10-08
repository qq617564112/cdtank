import {AbstractMesh, Scene, SubMesh, Vector3} from '@babylonjs/core';

export interface SceneOrderEntry {
  readonly mesh: AbstractMesh;
  readonly priority: number;
}

/** Native priorities descend; Babylon's transparent alpha indices ascend. */
export function setSceneModelPriority(mesh: AbstractMesh, priority: number): void {
  mesh.metadata = {...mesh.metadata, sceneModelPriority: priority};
  mesh.alphaIndex = -priority;
  mesh.renderingGroupId = 0;
}

/** Shared priority bands preserve opaque near-first and transparent far-first camera sorting. */
export function orderSceneModels(scene: Scene, entries: readonly SceneOrderEntry[]): void {
  for (const entry of entries) {
    setSceneModelPriority(entry.mesh, entry.priority);
  }
  const opaqueOrder = (left: SubMesh, right: SubMesh): number => {
    const priority = (right.getMesh().metadata?.sceneModelPriority ?? 0)
      - (left.getMesh().metadata?.sceneModelPriority ?? 0);
    if (priority) return priority;
    const camera = scene.activeCamera?.globalPosition;
    if (!camera) return 0;
    return Vector3.DistanceSquared(left.getBoundingInfo().boundingSphere.centerWorld, camera)
      - Vector3.DistanceSquared(right.getBoundingInfo().boundingSphere.centerWorld, camera);
  };
  scene.setRenderingOrder(0, opaqueOrder, opaqueOrder);
}
