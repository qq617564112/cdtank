import {prepareGameContent} from '../../content';
import {battleArtworkUrl} from '../battle-artwork';
import type {PetDefinition} from '../../../../shared/content/types';
import {AssetContainer, Constants, Scene, Texture, TransformNode} from '@babylonjs/core';
import {createMv3AnimationSampler, loadMv3Model, mv3ModelExtras} from '../tanks/mv3-animation-sampler';
import {applyMv3Materials} from '../../render/materials/mv3-material';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {EffectActorActionClock} from '../tanks/effect-actor-clock';
import '@babylonjs/loaders/glTF';

/** Original46add4 loads data/pet/%.3d/%.3d.ini; its default action is n1. */
export class PetView {
  private readonly clock: EffectActorActionClock;
  private readonly actionIdentifiers: number[] = [];
  private readonly observer;
  private sampleAnimation?: (milliseconds: number) => void;
  private disposed = false;

  private constructor(readonly petId: number, readonly assets: AssetContainer,
    readonly root: TransformNode, private readonly scene: Scene, duration: number,
    definition: PetDefinition, private readonly texture?: Texture) {
    this.clock = new EffectActorActionClock(duration, [], false, definition.resources.animationSpeed / (4800 / 1000), 53);
    const metadata = {petId, action: definition.resources.action, time: 0};
    this.sampleAnimation = createMv3AnimationSampler(assets);
    this.observer = scene.onBeforeRenderObservable.add(() => {
      this.clock.advanceToRef(effectModelEngineDelta(scene.getEngine().getDeltaTime() / 1000), this.actionIdentifiers);
      const time = this.clock.time % this.clock.duration;
      this.sampleAnimation?.(time);
      metadata.time = time;
      root.metadata = metadata;
    });
  }

  static async load(scene: Scene, petId: number): Promise<PetView> {
    const definition = (await prepareGameContent()).pets.get(petId);
    if (!definition) throw new Error('宠物模型定义缺失');
    const modelUrl = new URL(battleArtworkUrl(`/${definition.resources.model}`, scene), location.href);
    // The preview supplies its own texture and original MV3 material.
    const assets = await loadMv3Model(modelUrl.href, scene, {pluginOptions: {gltf: {skipMaterials: true}}});
    if (scene.isDisposed) {assets.dispose(); throw new Error('宠物预览已关闭');}
    const root = new TransformNode(`pet-preview-${petId}`, scene);
    let texture: Texture | undefined;
    try {
      const duration = mv3ModelExtras(assets)?.mv3Duration;
      if (duration === undefined || !Number.isFinite(duration) || duration <= 0) throw new Error('宠物动作时长缺失');
      const texturePath = definition.resources.textures[0];
      if (texturePath) {
        texture = await new Promise<Texture>((resolve, reject) => {
          const value = new Texture(battleArtworkUrl(`/${texturePath}`, scene), scene, true, false, Constants.TEXTURE_LINEAR_LINEAR,
            () => resolve(value), (_message, error) => {value.dispose(); reject(error ?? new Error('宠物贴图载入失败'));});
        });
      }
      if (scene.isDisposed) throw new Error('宠物预览已关闭');
      assets.addAllToScene();
      for (const node of assets.rootNodes) node.parent = root;
      applyMv3Materials(scene, assets, texture);
      applyCartoonOutlines(assets.meshes);
      return new PetView(petId, assets, root, scene, duration, definition, texture);
    } catch (error) {
      texture?.dispose(); assets.dispose(); root.dispose();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.sampleAnimation = undefined;
    this.assets.dispose(); this.texture?.dispose(); this.root.dispose();
  }
}
