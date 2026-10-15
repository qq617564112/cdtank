import type {WebGPUEngine} from '@babylonjs/core';

/** Submit newly loaded mipmaps before scene draws can invalidate their submission. */
export function installWebGpuTextureUploads(engine: WebGPUEngine): void {
  let pending = false;
  const createTexture = engine.createTexture.bind(engine);
  engine.createTexture = (...args: Parameters<WebGPUEngine['createTexture']>) => {
    const texture = createTexture(...args);
    // InternalTexture restoration calls createTexture without creating a Texture.
    if (texture.generateMipMaps) {
      if (texture.isReady) pending = true;
      else texture.onLoadedObservable.addOnce(() => {pending = true;});
    }
    return texture;
  };
  engine.onBeginFrameObservable.add(() => {
    if (!pending) return;
    pending = false;
    // Babylon batches initial mipmaps in its upload encoder. Flush while the
    // render encoder is still empty, separately from this frame's scene draws.
    engine.flushFramebuffer();
  });
}
