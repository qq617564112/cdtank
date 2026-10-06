import {Camera, Color4, FreeCamera, RenderTargetTexture, Scene, Vector3} from '@babylonjs/core';
import type {AbstractMesh} from '@babylonjs/core';
import {hudMinimapBounds} from '../interface/battle/hud-minimap-bounds';

const TEXTURE_SIZE = 768;

/** Captures the original scene from above, using the marker projection's bounds. */
export class BattleMinimap {
  private cancel?: () => void;

  constructor(private readonly scene: Scene) {
    scene.onDisposeObservable.addOnce(() => {this.clear();});
  }

  capture(mapId: number, meshes: readonly AbstractMesh[]): Promise<string | undefined> {
    this.clear();
    const bounds = hudMinimapBounds(mapId);
    if (!bounds) return Promise.resolve(undefined);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const span = bounds.maxX - bounds.minX;
    let highest = 0;
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      if (mesh.isEnabled()) highest = Math.max(highest, mesh.getBoundingInfo().boundingBox.maximumWorld.y);
    }
    const camera = new FreeCamera(`minimap-${mapId}`, new Vector3(-centerX, highest + span, centerZ), this.scene);
    camera.upVector = new Vector3(0, 0, 1);
    camera.rotation.set(Math.PI / 2, 0, 0);
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = camera.orthoBottom = -span / 2;
    camera.orthoRight = camera.orthoTop = span / 2;
    camera.minZ = 1;
    camera.maxZ = highest + span * 3;
    const texture = new RenderTargetTexture(`minimap-${mapId}`, TEXTURE_SIZE, this.scene, false);
    texture.activeCamera = camera;
    texture.renderList = [...meshes];
    texture.renderParticles = false;
    texture.renderSprites = false;
    texture.clearColor = new Color4(.08, .1, .12, 1);
    texture.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    return new Promise((resolve, reject) => {
      let finished = false;
      const release = (): void => {
        finished = true;
        const index = this.scene.customRenderTargets.indexOf(texture);
        if (index >= 0) this.scene.customRenderTargets.splice(index, 1);
        texture.dispose();
        camera.dispose();
        if (this.cancel === cancel) this.cancel = undefined;
      };
      const cancel = (): void => {release(); resolve(undefined);};
      this.cancel = cancel;
      texture.onAfterUnbindObservable.addOnce(() => {
        const readback = texture.readPixels();
        if (!readback) {
          release();
          reject(new Error('小地图俯视纹理读取失败'));
          return;
        }
        void readback.then(pixels => {
          if (finished) return;
          const source = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
          const image = new ImageData(TEXTURE_SIZE, TEXTURE_SIZE);
          // GPU rows start at the bottom. Reflecting X restores original world
          // coordinates after Babylon's glTF conversion, so +X is right/+Z up.
          for (let y = 0; y < TEXTURE_SIZE; y++) {
            for (let x = 0; x < TEXTURE_SIZE; x++) {
              const from = ((TEXTURE_SIZE - 1 - y) * TEXTURE_SIZE + TEXTURE_SIZE - 1 - x) * 4;
              const to = (y * TEXTURE_SIZE + x) * 4;
              image.data[to] = source[from];
              image.data[to + 1] = source[from + 1];
              image.data[to + 2] = source[from + 2];
              image.data[to + 3] = source[from + 3];
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = TEXTURE_SIZE;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('小地图画布创建失败');
          context.putImageData(image, 0, 0);
          const imageUrl = canvas.toDataURL('image/png');
          release();
          resolve(imageUrl);
        }).catch(error => {
          if (finished) return;
          release();
          reject(error);
        });
      });
      this.scene.customRenderTargets.push(texture);
    });
  }

  clear(): void {this.cancel?.();}
}
