import {BaseTexture, Constants, Scene, Texture, TransformNode} from '@babylonjs/core';
import {loadStaticJson} from '../../assets/static-resources';
import {normalizeEffectVector} from '../effects/common/effect-native-space';
import type {EffectVec3} from '../effects/common/types';
import {originalSceneId} from '../../../../shared/maps/scene-environment';

interface SceneActorToonResource {
  texture: string;
  lightPosition: [number, number, number];
  maps: {id: string; candidateCount: number}[];
  resolution: string;
}

/** Scene-owned original actor toon light and texture registers. */
export interface SceneActorToonBinding {
  readonly texture: BaseTexture;
  active(): boolean;
  lightDirection(): EffectVec3;
}

const registered = new WeakMap<Scene, SceneActorToon>();

/** Original maps and artwork variants share their source actor light. */
export function hasSceneActorToon(mapId: string): boolean {
  return originalSceneId(mapId) !== undefined;
}

function validPosition(value: readonly number[] | undefined): value is [number, number, number] {
  return Boolean(value?.length === 3 && value.every(Number.isFinite));
}

function loadTexture(scene: Scene, asset: string): Promise<Texture> {
  return new Promise<Texture>((resolve, reject) => {
    const texture = new Texture(`/${asset}`, scene, false, false, Texture.NEAREST_SAMPLINGMODE,
      () => {
        texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
        texture.wrapU = texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
        resolve(texture);
      },
      (_message, error) => {
        texture.dispose();
        reject(error ?? new Error(`原角色卡通贴图载入失败：${asset}`));
      });
  });
}

export class SceneActorToon {
  private texture?: Texture;
  private lightPosition?: [number, number, number];
  private disposed = false;

  constructor(private readonly scene: Scene, private readonly mapId: string) {}

  async load(): Promise<void> {
    const resource = await loadStaticJson<SceneActorToonResource>('/scene-actor-toon.json');
    if (this.disposed) return;
    const map = resource.maps?.find(entry => entry.id === originalSceneId(this.mapId));
    if (resource.resolution !== 'original' || !resource.texture || !map
      || map.candidateCount !== 0 || !validPosition(resource.lightPosition)) {
      throw new Error(`原角色卡通资源缺失：${this.mapId}`);
    }
    const texture = await loadTexture(this.scene, resource.texture);
    if (this.disposed) {
      texture.dispose();
      return;
    }
    this.texture = texture;
    this.lightPosition = [...resource.lightPosition];
  }

  binding(actor: TransformNode): SceneActorToonBinding | undefined {
    const texture = this.texture;
    const lightPosition = this.lightPosition;
    if (this.disposed || !texture || !lightPosition) return undefined;
    const light = [
      -lightPosition[0], lightPosition[1], lightPosition[2],
    ] as const;
    return {
      texture,
      active: () => !this.disposed && !actor.isDisposed(),
      lightDirection: () => {
        const position = actor.getAbsolutePosition();
        return normalizeEffectVector([
          light[0] - position.x,
          light[1] - position.y,
          light[2] - position.z,
        ]);
      },
    };
  }

  register(): void {
    registered.set(this.scene, this);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (registered.get(this.scene) === this) registered.delete(this.scene);
    this.texture?.dispose();
    this.texture = undefined;
    this.lightPosition = undefined;
  }
}

export function registerSceneActorToon(owner: SceneActorToon): void {
  owner.register();
}

export function sceneActorToonBinding(scene: Scene, actor: TransformNode): SceneActorToonBinding | undefined {
  return registered.get(scene)?.binding(actor);
}
