import {Scene, Texture} from '@babylonjs/core';
import {EffectModelRenderer, EffectModelLibrary} from '../../render/effects/models/effect-model-renderer';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';

/** Original CVD tracks and vertices placed in native scene coordinates. */
export class SceneCvdAnimation {
  private renderer?: EffectModelRenderer;
  private readonly textures = new Map<string, Texture>();
  private disposed = false;
  private delta = 0;

  constructor(private readonly scene: Scene, private readonly placementId: string,
              private readonly matrix: EffectNativeMatrix) {}

  async load(path: string, reference: string): Promise<void> {
    const response = await fetch(`/${path}`);
    if (!response.ok) throw new Error('原场景动画资源载入失败');
    const library = await response.json() as EffectModelLibrary;
    if (this.disposed || this.scene.isDisposed) return;
    const resource = library.resources.find(value => value.reference === reference);
    if (!resource) throw new Error(`缺少原场景动画：${reference}`);
    const paths = [...new Set(resource.nodes.flatMap(node => node.parts.flatMap(part => part.asset ? [part.asset] : [])))];
    await Promise.all(paths.map(asset => new Promise<void>((resolve, reject) => {
      const texture = new Texture(`/${asset}`, this.scene, true, false,
        Texture.BILINEAR_SAMPLINGMODE, resolve, message => reject(new Error(message)));
      texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.anisotropicFilteringLevel = 1;
      this.textures.set(asset, texture);
    })));
    if (this.disposed || this.scene.isDisposed) return;
    this.renderer = new EffectModelRenderer(this.scene, resource, library, this.textures,
      () => this.delta, -1, reference);
    this.advance(0);
  }

  advance(deltaSeconds: number): void {
    if (this.disposed || !this.renderer) return;
    this.delta = effectModelEngineDelta(deltaSeconds);
    this.renderer.update();
    this.renderer.draw({matrix: this.matrix, blend: 0, alpha: 1, priority: 0});
    for (const mesh of this.renderer.meshes) {
      const sourceModel = mesh.metadata.sourceSceneModel ?? mesh.metadata.sourceModel;
      const sourceModelNode = mesh.metadata.sourceSceneModelNode ?? mesh.metadata.sourceModelNode;
      mesh.name = `placement-${this.placementId}/cvd-${sourceModelNode}`;
      mesh.metadata = {sourceSceneModel: sourceModel, sourceSceneModelNode: sourceModelNode,
        sourcePlacementId: this.placementId};
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
