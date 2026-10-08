import {Scene, ShaderMaterial, Texture} from '@babylonjs/core';
import type {AbstractMesh} from '@babylonjs/core';
import {loadStaticJson} from '../static-resources';
import {EffectModelRenderer, type EffectModelLibrary} from '../../render/effects/models/effect-model-renderer';
import {orderSceneModels} from '../../render/scene-model-order';
import type {HookPlacement} from './scene-hook';

interface WaterFallLibrary extends EffectModelLibrary {
  mapId: string; sourcePlacementId: string; model: string; className: string;
  frames: string[]; frameSeconds: number;
}

/** Source POL vertex colors and transparent GBF pass with the five water frames. */
export class SceneWaterFall {
  private renderer?: EffectModelRenderer;
  private library?: WaterFallLibrary;
  private readonly textures: Texture[] = [];
  private readonly matrix: number[];
  private disposed = false;
  private elapsed = 0;

  constructor(private readonly scene: Scene, private readonly placement: HookPlacement) {
    this.matrix = [...placement.matrix];
    [this.matrix[12], this.matrix[13], this.matrix[14]] = placement.position;
  }

  async load(path: string): Promise<void> {
    try {
      const library = await loadStaticJson<WaterFallLibrary>(`/${path}`);
      if (this.disposed || this.scene.isDisposed) return;
      if (library.mapId !== '0016' || library.sourcePlacementId !== this.placement.id ||
        library.model !== this.placement.model || library.className !== this.placement.className) {
        throw new Error('WaterFall放置与资源身份不符');
      }
      this.library = library;
      for (const asset of library.frames) {
        const texture = await this.loadFrame(asset);
        if (this.disposed || this.scene.isDisposed) {texture.dispose(); return;}
        this.textures.push(texture);
      }
      const resource = library.resources[0];
      this.renderer = new EffectModelRenderer(this.scene, resource, library,
        new Map([[library.frames[0], this.textures[0]]]), () => 0, -1, resource.reference);
      this.renderer.draw(this.placement.enabled ? {matrix: this.matrix, alpha: 1, blend: 0, priority: 0} : undefined);
      this.renderer.meshes.forEach(mesh => {
        mesh.metadata = {...mesh.metadata, sourcePlacementId: this.placement.id,
          sourceClass: this.placement.className, sourceWaterFall: true};
      });
      orderSceneModels(this.scene, this.renderer.meshes.map(mesh => ({mesh, priority: 0})));
      this.setAnimationTime(0);
    } catch (error) {this.dispose(); throw error;}
  }

  advance(deltaSeconds: number): void {this.setAnimationTime(this.elapsed + deltaSeconds);}

  setAnimationTime(seconds: number): void {
    if (this.disposed || !this.library || !this.renderer) return;
    this.elapsed = Math.max(0, seconds);
    const frame = Math.floor(this.elapsed / this.library.frameSeconds) % this.textures.length;
    for (const mesh of this.renderer.meshes) {
      if (mesh.material instanceof ShaderMaterial) mesh.material.setTexture('modelTexture', this.textures[frame]);
    }
  }

  get meshes(): readonly AbstractMesh[] {return this.renderer?.meshes ?? [];}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.textures.splice(0).forEach(texture => {texture.dispose();});
  }

  private loadFrame(asset: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const texture = new Texture(`/${asset}`, this.scene, true, false,
        Texture.BILINEAR_SAMPLINGMODE, () => {resolve(texture);},
        (message, error) => {texture.dispose(); reject(error ?? new Error(message));});
      texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.anisotropicFilteringLevel = 1;
    });
  }
}
