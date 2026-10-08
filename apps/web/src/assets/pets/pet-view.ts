import {prepareGameContent} from '../../content';
import type {PetDefinition} from '../../../../shared/content/types';
import {AssetContainer, Constants, LoadAssetContainerAsync, Scene, Texture, TransformNode} from '@babylonjs/core';
import {applyMv3Materials} from '../../render/materials/mv3-material';
import {applyCartoonOutlines} from '../../render/materials/cartoon-outline';
import {effectModelEngineDelta} from '../../render/effects/models/effect-model-animation';
import {EffectActorActionClock} from '../tanks/effect-actor-clock';
import '@babylonjs/loaders/glTF';

/** Original46add4 loads data/pet/%.3d/%.3d.ini; its default action is n1. */
export class PetView {
  private readonly clock: EffectActorActionClock;
  private readonly observer;
  private disposed = false;

  private constructor(readonly petId: number, readonly assets: AssetContainer,
    readonly root: TransformNode, private readonly scene: Scene, duration: number,
    definition: PetDefinition, private readonly texture?: Texture) {
    this.clock = new EffectActorActionClock(duration, [], false, definition.resources.animationSpeed / (4800 / 1000), 53);
    for (const group of assets.animationGroups) {group.start(true, definition.resources.animationSpeed); group.pause();}
    this.observer = scene.onBeforeRenderObservable.add(() => {
      this.clock.advance(effectModelEngineDelta(scene.getEngine().getDeltaTime() / 1000));
      const time = this.clock.time % this.clock.duration;
      for (const group of assets.animationGroups) {
        const fps = group.targetedAnimations[0]?.animation.framePerSecond;
        if (fps !== undefined) group.goToFrame(time / 1000 * fps);
      }
      root.metadata = {petId, action: definition.resources.action, time};
    });
  }

  static async load(scene: Scene, petId: number): Promise<PetView> {
    const definition = (await prepareGameContent()).pets.get(petId);
    if (!definition) throw new Error('宠物模型定义缺失');
    const response = await fetch(`/${definition.resources.model}`);
    if (!response.ok) throw new Error('宠物模型资源载入失败');
    const bytes = await response.arrayBuffer();
    const length = new DataView(bytes).getUint32(12, true);
    const document = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length)));
    const duration: number = document.extras.mv3Duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('宠物动作时长缺失');
    const rootUrl = response.url.slice(0, response.url.lastIndexOf('/') + 1);
    const assets = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {rootUrl, pluginExtension: '.glb'});
    if (scene.isDisposed) {assets.dispose(); throw new Error('宠物预览已关闭');}
    const root = new TransformNode(`pet-preview-${petId}`, scene);
    let texture: Texture | undefined;
    try {
      const texturePath = definition.resources.textures[0];
      if (texturePath) {
        texture = await new Promise<Texture>((resolve, reject) => {
          const value = new Texture(`/${texturePath}`, scene, true, false, Constants.TEXTURE_LINEAR_LINEAR,
            () => resolve(value), (_message, error) => {value.dispose(); reject(error ?? new Error('宠物贴图载入失败'));});
        });
      }
      if (scene.isDisposed) throw new Error('宠物预览已关闭');
      assets.addAllToScene();
      for (const node of assets.rootNodes) node.parent = root;
      assets.materials.push(...applyMv3Materials(scene, assets.meshes, texture));
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
    this.assets.dispose(); this.texture?.dispose(); this.root.dispose();
  }
}
