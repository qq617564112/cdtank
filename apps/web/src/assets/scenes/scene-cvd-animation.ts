import {battleArtworkUrl} from '../battle-artwork';
import {loadEffectModelLibrary} from '../../render/effects/models/effect-model-resources';
import {Scene, Texture} from '@babylonjs/core';
import {EffectModelRenderer} from '../../render/effects/models/effect-model-renderer';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import type {EffectModelDraw} from '../../render/effects/models/effect-model-draw';

/** Original CVD tracks and vertices placed in native scene coordinates. */
export class SceneCvdAnimation {
  private renderer?: EffectModelRenderer;
  private readonly textures = new Map<string, Texture>();
  private disposed = false;
  private delta = 0;
  private time = 0;
  private readonly drawState: EffectModelDraw;

  constructor(private readonly scene: Scene, private readonly placementId: string,
              matrix: EffectNativeMatrix) {
    this.drawState = {matrix, blend: 0, alpha: 1, priority: 0};
  }

  async load(path: string, reference: string): Promise<void> {
    const library = await loadEffectModelLibrary(`/${path}`, this.scene, new Set([reference]));
    if (this.disposed || this.scene.isDisposed) return;
    const resource = library.resources.find(value => value.reference === reference);
    if (!resource) throw new Error(`缺少原场景动画：${reference}`);
    const paths = [...new Set(resource.nodes.flatMap(node => node.parts.flatMap(part => part.asset ? [part.asset] : [])))];
    await Promise.all(paths.map(asset => new Promise<void>((resolve, reject) => {
      const texture = new Texture(battleArtworkUrl(`/${asset}`, this.scene), this.scene, true, false,
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
    this.time += this.delta;
    this.renderer.update();
    this.renderer.draw(this.drawState);
    for (const mesh of this.renderer.meshes) {
      if (mesh.metadata.sourcePlacementId === this.placementId) continue;
      const sourceModel = mesh.metadata.sourceSceneModel ?? mesh.metadata.sourceModel;
      const sourceModelNode = mesh.metadata.sourceSceneModelNode ?? mesh.metadata.sourceModelNode;
      mesh.name = `placement-${this.placementId}/cvd-${sourceModelNode}`;
      mesh.metadata = {...mesh.metadata, sourceSceneModel: sourceModel, sourceSceneModelNode: sourceModelNode,
        sourcePlacementId: this.placementId};
    }
  }

  setAnimationTime(time: number): void {
    if (this.disposed || !this.renderer) return;
    this.time = Math.max(0, time);
    this.delta = 0;
    this.renderer.setTime(this.time);
    this.advance(0);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.textures.forEach(texture => {texture.dispose();});
    this.textures.clear();
  }
}
