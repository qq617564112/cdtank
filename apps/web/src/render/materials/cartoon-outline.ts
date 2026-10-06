import {AbstractMesh, Color3, InstancedMesh, Mesh, Observer, Scene, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/core/Rendering/outlineRenderer';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../../interface/settings/display-preferences';

/** cartoon.gbf silhouette: position + normal * Ink, black RGB. */
export const CARTOON_INK = 0.65;

interface OutlineRegistration {
  scene: Scene;
  meshObserver: Observer<Mesh>;
  sceneObserver: Observer<Scene>;
}

const registrations = new Map<Mesh, OutlineRegistration>();
let unsubscribePreferences: (() => void) | undefined;

function removeRegistration(mesh: Mesh): void {
  const registration = registrations.get(mesh);
  if (!registration) return;
  mesh.onDisposeObservable.remove(registration.meshObserver);
  registration.scene.onDisposeObservable.remove(registration.sceneObserver);
  registrations.delete(mesh);
  if (!registrations.size && unsubscribePreferences) {
    unsubscribePreferences();
    unsubscribePreferences = undefined;
  }
}

function removeScene(scene: Scene): void {
  for (const [mesh, registration] of [...registrations]) {
    if (registration.scene === scene) removeRegistration(mesh);
  }
}

function applyOutlinePreference(mesh: Mesh): void {
  mesh.outlineWidth = CARTOON_INK;
  mesh.outlineColor = Color3.Black();
  mesh.renderOutline = getDisplayPreferences().silhouette;
}

function updateOutlines(): void {
  for (const mesh of registrations.keys()) applyOutlinePreference(mesh);
}

function registerOutlineSource(mesh: Mesh): void {
  if (registrations.has(mesh)) {
    applyOutlinePreference(mesh);
    return;
  }
  const scene = mesh.getScene();
  const registration: OutlineRegistration = {
    scene,
    meshObserver: mesh.onDisposeObservable.add(() => removeRegistration(mesh)),
    sceneObserver: scene.onDisposeObservable.add(() => removeScene(scene)),
  };
  registrations.set(mesh, registration);
  if (!unsubscribePreferences) unsubscribePreferences = subscribeDisplayPreferences(updateOutlines);
  applyOutlinePreference(mesh);
}

export function applyCartoonOutlines(meshes: readonly AbstractMesh[]): void {
  for (const mesh of meshes) {
    const source = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
    if (!(source instanceof Mesh) || !source.isVerticesDataPresent(VertexBuffer.NormalKind)) continue;
    // Cutout cards already carry their silhouette in texture alpha. Expanding
    // their rectangular geometry would turn foliage and shop signs into slabs.
    if (source.material?.needAlphaBlendingForMesh(source)) continue;
    if (source.material?.needAlphaTestingForMesh(source)) {
      const positions = source.getVerticesData(VertexBuffer.PositionKind);
      const normals = source.getVerticesData(VertexBuffer.NormalKind);
      if (!positions || !normals || positions.length < 3) continue;
      const distance = positions[0] * normals[0] + positions[1] * normals[1] + positions[2] * normals[2];
      let planar = true;
      for (let index = 3; index < positions.length; index += 3) {
        if (Math.abs(positions[index] * normals[0] + positions[index + 1] * normals[1]
          + positions[index + 2] * normals[2] - distance) > 0.001) {
          planar = false;
          break;
        }
      }
      if (planar) continue;
    }
    registerOutlineSource(source);
  }
}
