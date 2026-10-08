import {FIELD_ROAD_HD} from './field-road-hd';

export type SceneFogMode = 0 | 1 | 2 | 3;

export interface SceneEnvironmentLight {
  readonly position: readonly [number, number, number];
  readonly attenuation: readonly [number, number, number];
  readonly diffuse: readonly [number, number, number];
}

export interface SceneEnvironment {
  readonly mapId: string;
  readonly ambient: readonly [number, number, number];
  readonly emissive: number;
  readonly fogEnabled: boolean;
  readonly fogMode: SceneFogMode;
  readonly fogColor: readonly [number, number, number];
  readonly fogParams: readonly [number, number, number, number];
  readonly fogDensity: number;
  readonly lights: readonly SceneEnvironmentLight[];
  readonly resolution: 'original-client' | 'custom';
}

/** CDTank 447c27–447c4a writes white RGBA directly to GfxManager+1a8. */
export const ORIGINAL_SCENE_AMBIENT: readonly [number, number, number] = [1, 1, 1];
export const ORIGINAL_SCENE_EMISSIVE = 0;

/** Original scene identity also used by the Field Road artwork variant. */
export function originalSceneId(mapId: string): string | undefined {
  if (mapId === FIELD_ROAD_HD.sceneId) return FIELD_ROAD_HD.sourceSceneId;
  return /^(000[1-9]|001[0-9]|002[0-5])$/.test(mapId) ? mapId : undefined;
}

/**
 * All 25 primary scn INIs disable fog; all 25 CTLs contain a zero count.
 * Actor toon uses the separate default [0,200,0]/0.bmp provider, rather
 * than an additive scene light. POL colours come from packed vertex RGBA.
 */
export function sceneEnvironmentFor(mapId: string): SceneEnvironment {
  const sourceId = originalSceneId(mapId);
  return {
    mapId,
    ambient: ORIGINAL_SCENE_AMBIENT,
    emissive: ORIGINAL_SCENE_EMISSIVE,
    fogEnabled: false,
    fogMode: 0,
    fogColor: [0, 0, 0],
    fogParams: [0, 0, 0, 0],
    fogDensity: sourceId === '0016' ? Math.fround(0.12) : 0,
    lights: [],
    resolution: sourceId ? 'original-client' : 'custom',
  };
}
