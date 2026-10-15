import {AbstractEngine, SceneLoader} from '@babylonjs/core';
import {GLTFFileLoader} from '@babylonjs/loaders/glTF';
import {imageResourceKey, loadImageResourceBlob} from './image-cache';

let installed = false;

/** Model UVs and repeating textures read cached images without page-owned source URLs. */
export function installModelImageLoader(): void {
  if (installed) return;
  installed = true;
  SceneLoader.OnPluginActivatedObservable.add(plugin => {
    if (plugin instanceof GLTFFileLoader) {
      const preprocess = plugin.preprocessUrlAsync;
      const images = new Map<string, Promise<string>>();
      const urls: string[] = [];
      let disposed = false;
      // glTF retains the image bytes for texture restoration after its URI reads finish.
      plugin.onDisposeObservable.addOnce(() => {
        disposed = true;
        for (const url of urls) URL.revokeObjectURL(url);
        urls.length = 0;
        images.clear();
      });
      plugin.preprocessUrlAsync = async (url, rootUrl) => {
        const image = await preprocess.call(plugin, url, rootUrl);
        if (disposed) throw new Error('模型图片载入已取消');
        if (image.startsWith('data:') || image.startsWith('blob:')) return image;
        const key = imageResourceKey(image);
        const existing = images.get(key);
        if (existing) return existing;
        const loading = loadImageResourceBlob(image).then(blob => {
          if (disposed) throw new Error('模型图片载入已取消');
          const source = URL.createObjectURL(blob);
          urls.push(source);
          return source;
        });
        images.set(key, loading);
        return loading;
      };
    }
  });
  const loadImage = AbstractEngine._FileToolsLoadImage;
  AbstractEngine._FileToolsLoadImage = (input, onLoad, onError, ...options) => {
    if (typeof input !== 'string' || input.startsWith('data:') || input.startsWith('blob:')) {
      return loadImage(input, onLoad, onError, ...options);
    }
    // Preserve the texture's published URL; restore reads it through the same disk cache.
    void loadImageResourceBlob(input).then(blob => {
      loadImage(blob, onLoad, onError, ...options);
    }).catch(error => onError(error instanceof Error ? error.message : String(error), error));
    return null;
  };
}
