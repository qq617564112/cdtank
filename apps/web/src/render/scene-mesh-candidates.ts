import type {AbstractMesh, Observer, Scene} from '@babylonjs/core';

/** Preloaded inactive actions do not need material readiness or LOD evaluation. */
export function selectEnabledMeshCandidates(scene: Scene): void {
  const candidates: {data: AbstractMesh[]; length: number} = {data: [], length: 0};
  const observers = new Map<AbstractMesh, Observer<boolean>>();
  let dirty = true;
  const invalidate = (): void => {dirty = true;};
  const observe = (mesh: AbstractMesh): void => {
    observers.set(mesh, mesh.onEffectiveEnabledStateChangedObservable.add(invalidate));
    dirty = true;
  };
  for (const mesh of scene.meshes) observe(mesh);
  scene.onNewMeshAddedObservable.add(observe);
  scene.onMeshRemovedObservable.add(mesh => {
    const observer = observers.get(mesh);
    if (observer) mesh.onEffectiveEnabledStateChangedObservable.remove(observer);
    observers.delete(mesh);
    dirty = true;
  });
  scene.onDisposeObservable.addOnce(() => {
    for (const [mesh, observer] of observers) mesh.onEffectiveEnabledStateChangedObservable.remove(observer);
    observers.clear();
    candidates.data.length = candidates.length = 0;
  });
  scene.getActiveMeshCandidates = () => {
    if (!dirty) return candidates;
    let count = 0;
    for (const mesh of scene.meshes) {
      if (mesh.isEnabled()) candidates.data[count++] = mesh;
    }
    candidates.data.length = count;
    candidates.length = count;
    dirty = false;
    return candidates;
  };
}
