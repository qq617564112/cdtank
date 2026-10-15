import {Logger, WebGPUEngine} from '@babylonjs/core';
import {cacheRenderPassBindings} from './webgpu-render-pass-bindings';
import {installWebGpuUniformUploads} from './webgpu-uniform-uploads';

/** Compose screen layers and restore resources owned by the current WebGPU device. */
export class ResourceWebGpuEngine extends WebGPUEngine {
  private readonly cachedRenderPasses = new WeakSet<GPURenderPassEncoder>();
  private disposeUniformUploads?: () => void;
  private screenPassDepthEnabled = true;
  private screenRenderEncoder?: GPUCommandEncoder;

  /** The fullscreen post-process and screen quads do not consume screen depth. */
  setScreenPassDepthEnabled(enabled: boolean): void {
    this.screenPassDepthEnabled = enabled;
    if (!enabled) this.prepareScreenRenderEncoder();
  }

  override beginFrame(): void {
    if (!this.screenPassDepthEnabled) this.prepareScreenRenderEncoder();
    super.beginFrame();
  }

  private prepareScreenRenderEncoder(): void {
    const encoder = this._renderEncoder;
    if (encoder === this.screenRenderEncoder) return;
    this.screenRenderEncoder = encoder;
    const beginRenderPass = encoder.beginRenderPass;
    encoder.beginRenderPass = descriptor => beginRenderPass.call(encoder,
      !this.screenPassDepthEnabled && descriptor.label?.endsWith('- MainRenderPass')
        ? {...descriptor, depthStencilAttachment: undefined} : descriptor);
  }

  override _setDepthTextureFormat(wrapper: Parameters<WebGPUEngine['_setDepthTextureFormat']>[0]): void {
    super._setDepthTextureFormat(!this.screenPassDepthEnabled
      && wrapper.renderPassDescriptor?.label?.endsWith('- MainRenderPass')
      ? {...wrapper, depthTextureFormat: undefined} : wrapper);
  }

  override async initAsync(...options: Parameters<WebGPUEngine['initAsync']>): Promise<void> {
    this.disposeUniformUploads?.();
    this.disposeUniformUploads = undefined;
    this.screenPassDepthEnabled = true;
    this.screenRenderEncoder = undefined;
    await super.initAsync(...options);
    this.disposeUniformUploads = installWebGpuUniformUploads(this);
  }

  override dispose(): void {
    this.disposeUniformUploads?.();
    this.disposeUniformUploads = undefined;
    super.dispose();
  }

  override _getCurrentRenderPass(): GPURenderPassEncoder {
    const pass = super._getCurrentRenderPass();
    if (!this.cachedRenderPasses.has(pass)) {
      cacheRenderPassBindings(pass);
      this.cachedRenderPasses.add(pass);
    }
    return pass;
  }

  override restoreDefaultFramebuffer(unbindOnly?: boolean): void {
    if (this._currentRenderTarget) {
      super.restoreDefaultFramebuffer(unbindOnly);
      return;
    }
    // Consecutive screen layers share the same attachments. Keep their native
    // draws in one pass; endFrame resolves MSAA and submits the finished image.
    if (this._cachedViewport) this.setViewport(this._cachedViewport);
    this.wipeCaches();
  }

  protected override _restoreEngineAfterContextLost(initEngine: () => void): void {
    const {depthTest, depthFunc, depthMask} = this._depthCullingState;
    const stencilTest = this._stencilState.stencilTest;
    const initialize = async (): Promise<void> => {
      await initEngine();
      if (this.isDisposed) return;
      // Native restoration preserves these states around initialization.
      this._depthCullingState.depthTest = depthTest;
      this._depthCullingState.depthFunc = depthFunc;
      this._depthCullingState.depthMask = depthMask;
      this._stencilState.stencilTest = stencilTest;
      super._restoreEngineAfterContextLost(() => {});
    };
    void initialize().catch(error => {
      Logger.Error(`WebGPU 设备恢复失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }

  protected override _rebuildBuffers(): void {
    // WebGPU's native implementation rebuilds UBOs/storage buffers but omits
    // scene vertex/index buffers and post-process geometry.
    for (const scene of this.scenes) {
      scene.resetCachedMaterial();
      scene._rebuildGeometries();
    }
    for (const scene of this._virtualScenes) {
      scene.resetCachedMaterial();
      scene._rebuildGeometries();
    }
    super._rebuildBuffers();
  }
}
