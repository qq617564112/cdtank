import {AbstractMesh, Color3, InstancedMesh, Mesh, Node, Observer, Scene, VertexBuffer} from '@babylonjs/core';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../../interface/settings/display-preferences';
import {prepareCartoonOutlineMesh} from './cartoon-outline-renderer';

/** cartoon.gbf silhouette: position + normal * Ink, black RGB. */
export const CARTOON_INK = 0.65;

interface OutlineRegistration {
  scene: Scene;
  meshObserver: Observer<Node>;
  cloneObserver?: Observer<Node>;
}
interface OutlineSceneRegistration {observer: Observer<Scene>; meshCount: number;}

const registrations = new Map<Mesh, OutlineRegistration>();
const sceneRegistrations = new Map<Scene, OutlineSceneRegistration>();
let unsubscribePreferences: (() => void) | undefined;

function removeRegistration(mesh: Mesh): void {
  const registration = registrations.get(mesh);
  if (!registration) return;
  mesh.onDisposeObservable.remove(registration.meshObserver);
  const sceneRegistration = sceneRegistrations.get(registration.scene)!;
  if (--sceneRegistration.meshCount === 0) {
    registration.scene.onDisposeObservable.remove(sceneRegistration.observer);
    sceneRegistrations.delete(registration.scene);
  }
  if (registration.cloneObserver) mesh.onClonedObservable.remove(registration.cloneObserver);
  registrations.delete(mesh);
  if (!registrations.size && unsubscribePreferences) {
    unsubscribePreferences();
    unsubscribePreferences = undefined;
  }
}

function removeScene(scene: Scene): void {
  for (const mesh of registrations.keys()) {
    if (mesh.getScene() === scene) removeRegistration(mesh);
  }
}

function applyOutlinePreference(mesh: Mesh): void {
  mesh.outlineWidth = CARTOON_INK;
  mesh.outlineColor = Color3.Black();
  mesh.renderOutline = getDisplayPreferences().silhouette && !mesh.material?.needAlphaBlendingForMesh(mesh);
}

function updateOutlines(): void {
  for (const mesh of registrations.keys()) applyOutlinePreference(mesh);
}

function eligibleSource(mesh: Mesh): boolean {
  if (!(mesh instanceof Mesh) || mesh instanceof InstancedMesh
    || !mesh.isVerticesDataPresent(VertexBuffer.NormalKind)) return false;
  if (mesh.material?.needAlphaBlendingForMesh(mesh)) return false;
  if (mesh.material?.needAlphaTestingForMesh(mesh) && mesh._internalMetadata?.cdtankOutlinePlanar) return false;
  return true;
}

function registerOutlineSource(mesh: Mesh): void {
  if (registrations.has(mesh)) {
    applyOutlinePreference(mesh);
    return;
  }
  const scene = mesh.getScene();
  prepareCartoonOutlineMesh(mesh);
  const registration: OutlineRegistration = {
    scene,
    meshObserver: mesh.onDisposeObservable.add(() => removeRegistration(mesh)),
  };
  let sceneRegistration = sceneRegistrations.get(scene);
  if (!sceneRegistration) {
    sceneRegistration = {observer: scene.onDisposeObservable.add(() => removeScene(scene)), meshCount: 0};
    sceneRegistrations.set(scene, sceneRegistration);
  }
  sceneRegistration.meshCount++;
  registration.cloneObserver = mesh.onClonedObservable.add(clone => {
    if (clone instanceof Mesh && eligibleSource(clone)) registerOutlineSource(clone);
  });
  registrations.set(mesh, registration);
  if (!unsubscribePreferences) unsubscribePreferences = subscribeDisplayPreferences(updateOutlines);
  applyOutlinePreference(mesh);
}

export function applyCartoonOutlines(meshes: readonly AbstractMesh[]): void {
  for (const mesh of meshes) {
    const source = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
    if (!(source instanceof Mesh) || (!registrations.has(source) && !eligibleSource(source))) continue;
    registerOutlineSource(source);
  }
}
