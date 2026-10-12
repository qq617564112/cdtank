import {ArcRotateCamera, Color3, Color4, Constants, Engine, Scene, ShaderMaterial, Texture, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {TankView} from '../../apps/web/src/assets/tanks/tank-view';
import type {OwnedTankTextures} from '../../apps/shared/combat/role-owned-textures';

export interface TankTextureSample {
  M?: string;
  U?: string;
}

function loadSampleTexture(scene: Scene, asset: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const texture = new Texture(`/${asset}`, scene, false, false, Constants.TEXTURE_LINEAR_LINEAR,
      () => resolve(texture), (_message, error) => {
        texture.dispose();
        reject(error ?? new Error(`贴图载入失败：${asset}`));
      });
  });
}

const views: Readonly<Record<string, readonly [number, number]>> = {
  center: [Math.PI * 3 / 4, Math.PI / 3.2],
  top: [-Math.PI / 2, 0.01],
  left: [0, Math.PI / 2],
  right: [Math.PI, Math.PI / 2],
  front: [Math.PI / 2, Math.PI / 2],
  rear: [-Math.PI / 2, Math.PI / 2],
};

/** Render the game actor under uniform ambient light with a controlled animation clock. */
export class TankPreview {
  private readonly engine: Engine;
  private scene?: Scene;
  private camera?: ArcRotateCamera;
  private view?: TankView;
  private sampleTextures?: Readonly<Partial<Record<'M' | 'U', Texture>>>;
  private loading = false;
  private tankId?: number;
  private fittedRadius = 100;
  private fittedTarget = Vector3.Zero();
  private background = '#171c21';
  private command = 0;
  playing = true;
  speed = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {preserveDrawingBuffer: true}, false);
    this.engine.runRenderLoop(() => {
      if (!this.scene || this.loading) return;
      if (this.playing) this.advance(Math.min(this.engine.getDeltaTime() / 1000, 0.1) * this.speed);
      this.scene.render();
    });
    new ResizeObserver(() => this.engine.resize()).observe(canvas);
  }

  async load(tankId: number, textures: OwnedTankTextures, sample?: TankTextureSample): Promise<void> {
    const pose = this.tankId === tankId && this.camera ? {
      alpha: this.camera.alpha, beta: this.camera.beta,
      radius: this.camera.radius, target: this.camera.target.clone(),
    } : undefined;
    this.loading = true;
    this.view?.dispose();
    this.view = undefined;
    this.scene?.dispose();
    this.sampleTextures = undefined;
    try {
      const scene = this.scene = new Scene(this.engine);
      scene.ambientColor = Color3.White();
      scene.animationsEnabled = false;
      this.setBackground(this.background);
      const camera = this.camera = new ArcRotateCamera('audit-camera',
        views.center[0], views.center[1], 100, Vector3.Zero(), scene);
      camera.minZ = 0.1;
      camera.maxZ = 100000;
      camera.lowerBetaLimit = 0.01;
      camera.upperBetaLimit = Math.PI - 0.01;
      camera.attachControl(this.canvas, true);
      this.view = await TankView.loadPreview(scene, `audit-tank-${tankId}`, tankId, textures);
      scene.onBeforeRenderObservable.clear();
      await this.view.motion(this.command !== 0);
      if (sample) {
        const loaded: Partial<Record<'M' | 'U', Texture>> = {};
        await Promise.all((['M', 'U'] as const).map(async part => {
          const asset = sample[part];
          if (asset) loaded[part] = await loadSampleTexture(scene, asset);
        }));
        this.sampleTextures = loaded;
        this.applySampleTextures();
      }
      this.view.advanceAnimations(0);
      this.fitCamera();
      if (pose) {
        camera.alpha = pose.alpha;
        camera.beta = pose.beta;
        camera.radius = pose.radius;
        camera.target.copyFrom(pose.target);
      }
      scene.render();
      await scene.whenReadyAsync();
      this.tankId = tankId;
    } finally {
      this.loading = false;
    }
  }

  private fitCamera(): void {
    if (!this.view || !this.camera) return;
    const meshes = this.view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bounds.minimumWorld);
      max = Vector3.Maximize(max, bounds.maximumWorld);
    }
    this.fittedTarget = min.add(max).scale(0.5);
    this.fittedRadius = Math.max(max.subtract(min).length(), 1) * 1.5;
    this.camera.lowerRadiusLimit = this.fittedRadius / 15;
    this.camera.upperRadiusLimit = this.fittedRadius * 5;
    this.camera.wheelPrecision = 100 / this.fittedRadius;
    this.camera.panningSensibility = 10000 / this.fittedRadius;
    this.setView('center');
  }

  setView(name: string): void {
    if (!this.camera) return;
    const [alpha, beta] = views[name];
    this.camera.alpha = alpha;
    this.camera.beta = beta;
    this.camera.radius = this.fittedRadius;
    this.camera.target.copyFrom(this.fittedTarget);
  }

  setBackground(color: string): void {
    this.background = color;
    if (this.scene) {
      const value = Color3.FromHexString(color);
      this.scene.clearColor = new Color4(value.r, value.g, value.b, 1);
    }
  }

  async setMotion(command: number): Promise<void> {
    this.command = command;
    await this.view?.motion(command !== 0);
    this.applySampleTextures();
  }

  private applySampleTextures(): void {
    if (!this.view || !this.sampleTextures) return;
    for (const mesh of this.view.root.getChildMeshes()) {
      if (!(mesh.material instanceof ShaderMaterial) || !mesh.material.metadata?.originalMV3) continue;
      let node = mesh.parent;
      while (node) {
        const part = /-part-([MU])$/.exec(node.name)?.[1] as 'M' | 'U' | undefined;
        if (part) {
          const texture = this.sampleTextures[part];
          if (texture) mesh.material.setTexture('sourceTexture', texture);
          break;
        }
        node = node.parent;
      }
    }
  }

  advance(seconds: number): void {
    this.view?.trackMovementCommand(this.command);
    this.view?.advanceAnimations(seconds);
  }
}
