import {BaseTexture, Constants, Scene, Texture, TransformNode} from '@babylonjs/core';
import {loadStaticJson} from '../../assets/static-resources';
import {normalizeEffectVectorToRef} from '../effects/common/effect-native-space';
import type {EffectVec3} from '../effects/common/types';
import {originalSceneId} from '../../../../shared/maps/scene-environment';
import {isMobileDevice} from '../../platform/device';

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
  /** Borrowed direction, copied by the material before the next bind. */
  lightDirection(): EffectVec3;
}

const registered = new WeakMap<Scene, SceneActorToon>();

/** Desktop original maps and artwork variants share their source actor light. */
export function hasSceneActorToon(mapId: string): boolean {
  return !isMobileDevice() && originalSceneId(mapId) !== undefined;
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
    const resource = await loadStaticJson<SceneActorToonResource>('/data/maps/shared/actor-toon.json');
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
    const direction: EffectVec3 = [0, 0, 0];
    return {
      texture,
      active: () => !this.disposed && !actor.isDisposed(),
      lightDirection: () => {
        const position = actor.getAbsolutePosition();
        direction[0] = light[0] - position.x;
        direction[1] = light[1] - position.y;
        direction[2] = light[2] - position.z;
        normalizeEffectVectorToRef(direction, direction);
        return direction;
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
