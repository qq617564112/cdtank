import {AbstractEngine, SceneLoader} from '@babylonjs/core';
import {GLTFFileLoader} from '@babylonjs/loaders/glTF';
import {imageResourceUrl, loadImageResource, spriteImage} from './image-cache';

let installed = false;

/** Model UVs and repeating textures consume original-size images only when requested. */
export function installModelImageLoader(): void {
  if (installed) return;
  installed = true;
  SceneLoader.OnPluginActivatedObservable.add(plugin => {
    if (plugin instanceof GLTFFileLoader) {
      plugin.preprocessUrlAsync = async url => spriteImage(url)
        ? (await loadImageResource(url)).url : imageResourceUrl(url);
    }
  });
  const loadImage = AbstractEngine._FileToolsLoadImage;
  AbstractEngine._FileToolsLoadImage = (input, onLoad, onError, ...options) => {
    if (typeof input !== 'string' || !spriteImage(input)) {
      return loadImage(input, onLoad, onError, ...options);
    }
    void loadImageResource(input).then(resource => {
      loadImage(resource.url, onLoad, onError, ...options);
    }).catch(error => {onError(`模型贴图载入失败：${input}`, error);});
    return null;
  };
}
