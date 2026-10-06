import {ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import {TankView} from '../../assets/tanks/tank-view';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import {advanceHomePreviewOrbit, HOME_PREVIEW_CLIP_PLANES} from './home-preview-orbit';

/** Recovered tank components in the original home-page model viewport. */
export class HomeTankPreview {
  readonly element = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly message = document.createElement('output');
  private engine?: Engine;
  private scene?: Scene;
  private camera?: ArcRotateCamera;
  private view?: TankView;
  private revision = 0;
  private desired?: string;
  private frames = 0;
  private readonly orbit = {pitch: 0, yaw: 0, orbitYaw: 0};

  constructor() {
    this.element.className = 'home-tank-preview'; this.element.dataset.rolePreview = '';
    this.canvas.setAttribute('aria-label', '拥有战车模型预览');
    this.message.setAttribute('aria-live', 'polite');
    this.element.append(this.canvas, this.message);
    new ResizeObserver(() => this.resize()).observe(this.element);
    window.addEventListener('resize', () => requestAnimationFrame(() => this.resize()));
  }

  private resize(): void {
    const box = this.element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) this.engine?.setSize(Math.round(box.width), Math.round(box.height));
  }

  async show(tankId: number, instanceId: number, textures?: OwnedTankTextures): Promise<void> {
    this.element.dataset.instanceId = String(instanceId);
    const identity = JSON.stringify([tankId, instanceId, textures]);
    if (identity === this.desired) return;
    const revision = ++this.revision; this.desired = identity;
    this.element.dataset.tankTextures = JSON.stringify(textures ?? null);
    this.view?.dispose(); this.view = undefined;
    this.element.dataset.status = 'loading'; this.element.dataset.tankId = String(tankId);
    delete this.element.dataset.renderedTankId;
    this.element.dataset.meshes = '0'; this.message.value = '载入战车模型…';
    try {
      if (!this.engine) {
        this.engine = new Engine(this.canvas, true, {alpha: true}, true);
        this.scene = new Scene(this.engine); this.scene.clearColor = new Color4(0, 0, 0, 0);
        this.scene.ambientColor = Color3.White();
        this.camera = new ArcRotateCamera('home-camera', -Math.PI / 2.5, Math.PI / 3, 100, Vector3.Zero(), this.scene);
        this.camera.minZ = HOME_PREVIEW_CLIP_PLANES.near;
        this.camera.maxZ = HOME_PREVIEW_CLIP_PLANES.far;
        this.camera.attachControl(this.canvas, true);
        new HemisphericLight('home-light', new Vector3(0, 1, 0), this.scene).intensity = 1.2;
        this.engine.runRenderLoop(() => {
          const previous = this.orbit.orbitYaw;
          advanceHomePreviewOrbit(this.orbit);
          // Reflect native X into the converted model coordinates; positive native
          // Y orbit advances Babylon alpha in the same direction after reflection.
          if (this.camera) this.camera.alpha += this.orbit.orbitYaw - previous;
          this.element.dataset.orbitYaw = String(this.orbit.orbitYaw);
          this.scene?.render(); this.element.dataset.frames = String(++this.frames);
          if (this.view) this.element.dataset.renderedTankId = String(this.view.tankId);
        });
      }
      this.resize();
      const scene = this.scene!;
      const view = await TankView.loadPreview(scene, `home-tank-${instanceId}`, tankId, textures);
      if (revision !== this.revision) {view.dispose(); return;}
      this.view = view;
      const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
      let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, box.minimumWorld); max = Vector3.Maximize(max, box.maximumWorld);
      }
      if (!meshes.length) throw new Error('战车模型没有可显示的网格');
      this.camera!.target = min.add(max).scale(0.5);
      this.camera!.radius = Math.max(max.subtract(min).length(), 1) * 1.4;
      this.camera!.lowerRadiusLimit = this.camera!.radius / 2;
      this.camera!.upperRadiusLimit = this.camera!.radius * 3;
      this.element.dataset.meshes = String(meshes.length); this.element.dataset.status = 'ready';
      this.message.value = '';
    } catch (error) {
      if (revision !== this.revision) return;
      this.view?.dispose(); this.view = undefined; this.desired = undefined;
      console.error('拥有战车预览模型载入失败', error);
      this.element.dataset.status = 'error'; this.message.value = '模型载入失败，请刷新页面重试。';
    }
  }

  clear(): void {
    ++this.revision; this.desired = undefined;
    this.view?.dispose(); this.view = undefined;
    this.scene?.dispose(); this.scene = undefined;
    this.engine?.dispose(); this.engine = undefined; this.camera = undefined;
    this.element.dataset.status = 'empty'; this.element.dataset.meshes = '0';
    delete this.element.dataset.tankId; delete this.element.dataset.instanceId;
    delete this.element.dataset.renderedTankId; delete this.element.dataset.tankTextures;
    this.message.value = '';
  }
}
