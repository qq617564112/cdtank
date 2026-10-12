import {AbstractEngine, SceneLoader} from '@babylonjs/core';
import {GLTFFileLoader} from '@babylonjs/loaders/glTF';
import {imageResourceUrl} from './image-cache';

let installed = false;

/** Model UVs and repeating textures use the prepared individual images. */
export function installModelImageLoader(): void {
  if (installed) return;
  installed = true;
  SceneLoader.OnPluginActivatedObservable.add(plugin => {
    if (plugin instanceof GLTFFileLoader) {
      plugin.preprocessUrlAsync = async url => imageResourceUrl(url);
    }
  });
  const loadImage = AbstractEngine._FileToolsLoadImage;
  AbstractEngine._FileToolsLoadImage = (input, onLoad, onError, ...options) => {
    return loadImage(typeof input === 'string' ? imageResourceUrl(input) : input, onLoad, onError, ...options);
  };
}
