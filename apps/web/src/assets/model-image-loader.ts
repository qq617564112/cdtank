import {AbstractEngine, SceneLoader} from '@babylonjs/core';
import {GLTFFileLoader} from '@babylonjs/loaders/glTF';
import {imageResourceUrl, loadImageResource} from './image-cache';

let installed = false;

/** Model UVs and repeating textures use the prepared individual images. */
export function installModelImageLoader(): void {
  if (installed) return;
  installed = true;
  SceneLoader.OnPluginActivatedObservable.add(plugin => {
    if (plugin instanceof GLTFFileLoader) {
      plugin.preprocessUrlAsync = async url => {
        await loadImageResource(url);
        return imageResourceUrl(url);
      };
    }
  });
  const loadImage = AbstractEngine._FileToolsLoadImage;
  AbstractEngine._FileToolsLoadImage = (input, onLoad, onError, ...options) => {
    if (typeof input !== 'string') return loadImage(input, onLoad, onError, ...options);
    void loadImageResource(input).then(() => {
      loadImage(imageResourceUrl(input), onLoad, onError, ...options);
    }).catch(error => onError(error instanceof Error ? error.message : String(error), error));
    return null;
  };
}
