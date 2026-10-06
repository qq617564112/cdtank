import {Scene, Texture} from '@babylonjs/core';
import {EffectModelRenderer, type EffectModelLibrary} from '../../render/effects/models/effect-model-renderer';
import type {EffectModelGraphicsState} from '../../render/effects/models/effect-model-material';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';

/** Original c9 geometry played once, then held at its final pose during fade. */
export class SceneBreachVisual {
  private renderer?: EffectModelRenderer;
  private graphics?: EffectModelGraphicsState;
  private readonly textures = new Map<string, Texture>();
  private disposed = false;
  private duration = 0;
  private elapsed = 0;

  get durationSeconds(): number {return this.duration;}

  constructor(private readonly scene: Scene, private readonly placementId: string,
              private readonly matrix: EffectNativeMatrix, readonly model: string,
              private readonly libraryAsset: string) {}

  async load(): Promise<void> {
    const response = await fetch(this.libraryAsset);
    if (!response.ok) throw new Error('原物件破损资源载入失败');
    const library = await response.json() as EffectModelLibrary;
    if (this.disposed || this.scene.isDisposed) return;
    const reference = `Data/scnobj/${this.model}/c9.CVD`;
    const resource = library.resources.find(value => value.reference === reference);
    if (!resource) throw new Error(`缺少原破损模型：${reference}`);
    this.duration = Math.max(0, ...resource.nodes.map(node => node.duration ?? 0));
    const paths = [...new Set(resource.nodes.flatMap(node => node.parts.flatMap(part => part.asset ? [part.asset] : [])))];
    await Promise.all(paths.map(asset => new Promise<void>((resolve, reject) => {
      const texture = new Texture(`/${asset}`, this.scene, true, false,
        Texture.BILINEAR_SAMPLINGMODE, resolve, message => reject(new Error(message)));
      texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.anisotropicFilteringLevel = 1;
      this.textures.set(asset, texture);
    })));
    if (this.disposed || this.scene.isDisposed) return;
    this.graphics = {...library.graphics, ambient: this.scene.ambientColor.asArray()};
    this.renderer = new EffectModelRenderer(this.scene, resource,
      {...library, graphics: this.graphics}, this.textures, () => 0, -1, resource.reference);
    this.renderer.setRate(0);
    this.renderer.setTime(0);
    this.renderer.update();
    this.renderer.draw({matrix: this.matrix, blend: 1, alpha: 1, priority: -1});
    this.renderer.draw(undefined);
    await Promise.all(this.renderer.meshes.map(mesh =>
      mesh.material!.forceCompilationAsync(mesh)));
  }

  seek(seconds: number): void {
    this.elapsed = Math.min(seconds, this.duration);
    this.renderer?.setTime(this.elapsed);
    this.renderer?.update();
  }

  reset(): void {
    this.elapsed = 0;
    this.renderer?.setRate(0);
    this.renderer?.setTime(0);
    this.renderer?.update();
    this.renderer?.draw(undefined);
  }

  advance(deltaSeconds: number, alpha: number, visible: boolean): void {
    if (this.disposed || !this.renderer) return;
    if (!visible) {this.renderer.draw(undefined); return;}
    this.elapsed = Math.min(this.duration, this.elapsed + Math.fround(deltaSeconds));
    this.renderer.setTime(this.elapsed);
    this.renderer.update();
    this.graphics!.ambient = this.scene.ambientColor.asArray();
    this.renderer.draw({matrix: this.matrix, blend: 1, alpha: Math.max(0, alpha), priority: -1});
    for (const mesh of this.renderer.meshes) {
      mesh.name = `placement-${this.placementId}/broken-cvd-${mesh.metadata.sourceModelNode}`;
      mesh.metadata = {...mesh.metadata, sourcePlacementId: this.placementId, sourceBreachBroken: true};
    }
  }

  dispose(): void {
    this.disposed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.textures.forEach(texture => {texture.dispose();});
    this.textures.clear();
  }
}
