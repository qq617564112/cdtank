import {AssetContainer, type Observer, type Scene} from '@babylonjs/core';
import type {GLTFFileLoader, IGLTFLoader, IGLTFLoaderData} from '@babylonjs/loaders/glTF';

const sceneObservers = new WeakMap<AssetContainer, Observer<Scene>>();

function releaseSceneObserver(container: AssetContainer): void {
  const observer = sceneObservers.get(container);
  if (!observer) return;
  sceneObservers.delete(container);
  container.scene.onDisposeObservable.remove(observer);
}

function disposeModelContainer(this: AssetContainer): void {
  releaseSceneObserver(this);
  // A scene can close before the native loader fills the container's arrays.
  // A later dispose must still release those newly returned assets.
  AssetContainer.prototype.dispose.call(this);
  this.rootNodes.length = 0;
}

/** Own the native container's registration without changing its asset collection. */
export function installModelContainerDisposal(plugin: GLTFFileLoader): void {
  const getLoader = Reflect.get(plugin, '_getLoader') as (data: IGLTFLoaderData) => IGLTFLoader;
  Reflect.set(plugin, '_getLoader', (data: IGLTFLoaderData): IGLTFLoader => {
    Reflect.set(plugin, '_getLoader', getLoader);
    const loader = getLoader.call(plugin, data);
    const importMesh = loader.importMeshAsync;
    loader.importMeshAsync = (names, scene, container, document, rootUrl, onProgress, fileName) => {
      loader.importMeshAsync = importMesh;
      if (container) {
        // Babylon constructs this container immediately before the import handoff.
        sceneObservers.set(container, scene.onDisposeObservable.observers.at(-1)!);
        container.dispose = disposeModelContainer;
      }
      const loading = importMesh.call(loader, names, scene, container, document, rootUrl, onProgress, fileName);
      if (!container) return loading;
      return loading.catch(error => {
        container.dispose();
        throw error;
      });
    };
    return loader;
  });
}
