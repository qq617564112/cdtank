import {battleArtworkUrl} from '../battle-artwork';
import {withResourceTimeout} from '../static-resources';
import {loadEffectModelLibrary} from '../../render/effects/models/effect-model-resources';
import {Scene, Texture} from '@babylonjs/core';
import {EffectModelRenderer} from '../../render/effects/models/effect-model-renderer';
import type {EffectModelDraw} from '../../render/effects/models/effect-model-draw';
import type {EffectModelGraphicsState} from '../../render/effects/models/effect-model-material';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {multiplyEffectMatrices} from '../../render/effects/common/effect-render-transform';
import {sceneShadowLight} from '../../render/scene-shadow-light';

// LoadCVDFile (0x100118b9) rotates the container root by -90° around X.
// File nodes are Z-up; this root maps [x, y, z] to scene [x, z, -y].
const CVD_SCENE_ROOT: EffectNativeMatrix = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

/** Original c9 geometry played once, then held at its final pose during fade. */
export class SceneBreachVisual {
  private renderer?: EffectModelRenderer;
  private graphics?: EffectModelGraphicsState;
  private readonly textures = new Map<string, Texture>();
  private disposed = false;
  private duration = 0;
  private elapsed = 0;
  private readonly drawState: EffectModelDraw;

  get durationSeconds(): number {return this.duration;}

  constructor(private readonly scene: Scene, private readonly placementId: string,
              matrix: EffectNativeMatrix, readonly model: string,
              private readonly libraryAsset: string,
              private readonly reference?: string) {
    this.drawState = {matrix: multiplyEffectMatrices(matrix, CVD_SCENE_ROOT),
      blend: 1, alpha: 1, priority: -1};
  }

  async load(): Promise<void> {
    const reference = this.reference ?? `Data/scnobj/${this.model}/c9.CVD`;
    const library = await loadEffectModelLibrary(this.libraryAsset, this.scene, new Set([reference]));
    if (this.disposed || this.scene.isDisposed) return;
    const resource = library.resources.find(value => value.reference === reference);
    if (!resource) throw new Error(`缺少原破损模型：${reference}`);
    this.duration = Math.max(0, ...resource.nodes.map(node => node.duration ?? 0));
    const paths = [...new Set(resource.nodes.flatMap(node => node.parts.flatMap(part => part.asset ? [part.asset] : [])))];
    await Promise.all(paths.map(asset => {
      const url = battleArtworkUrl(`/${asset}`, this.scene);
      return withResourceTimeout(new Promise<void>((resolve, reject) => {
        const texture = new Texture(url, this.scene, true, false,
          Texture.BILINEAR_SAMPLINGMODE, resolve,
          message => reject(new Error(`破损模型贴图载入失败：${url}（${message}）`)));
        texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
        texture.anisotropicFilteringLevel = 1;
        this.textures.set(asset, texture);
      }), url);
    }));
    if (this.disposed || this.scene.isDisposed) return;
    this.graphics = {...library.graphics, ambient: this.scene.ambientColor.asArray()};
    this.renderer = new EffectModelRenderer(this.scene, resource,
      {...library, graphics: this.graphics}, this.textures, () => 0, -1, resource.reference);
    this.renderer.setRate(0);
    this.renderer.setTime(0);
    this.renderer.update();
    this.drawState.alpha = 1;
    this.renderer.draw(this.drawState);
    this.renderer.draw(undefined);
    const meshes = this.renderer.meshes;
    for (const mesh of meshes) {
      mesh.name = `placement-${this.placementId}/broken-cvd-${mesh.metadata.sourceModelNode}`;
      mesh.metadata = {...mesh.metadata, sourcePlacementId: this.placementId, sourceBreachBroken: true};
    }
    await Promise.all(meshes.map(mesh => withResourceTimeout(
      mesh.material!.forceCompilationAsync(mesh), `破损模型材质：${reference} / ${mesh.name}`)));
    if (this.disposed || this.scene.isDisposed) return;
    await sceneShadowLight(this.scene)?.prepareMeshes(meshes);
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
    const ambient = this.graphics!.ambient as number[];
    ambient[0] = this.scene.ambientColor.r;
    ambient[1] = this.scene.ambientColor.g;
    ambient[2] = this.scene.ambientColor.b;
    this.drawState.alpha = Math.max(0, alpha);
    this.renderer.draw(this.drawState);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.textures.forEach(texture => {texture.dispose();});
    this.textures.clear();
  }
}
