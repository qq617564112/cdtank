import {originalSceneId} from '../../../shared/maps/scene-environment';

export interface SceneShadowLightProfile {
  readonly kind: 'day' | 'night' | 'indoor' | 'sunset';
  /** World-space direction in which the light travels. */
  readonly direction: readonly [number, number, number];
  readonly colour: readonly [number, number, number];
  readonly intensity: number;
  /** Retain the baked artwork's brightness on unlit faces. */
  readonly ambient: number;
  readonly shadowStrength: number;
  readonly softness: number;
}

const DAY: SceneShadowLightProfile = {
  kind: 'day', direction: [0.4, -1, 0.3], colour: [1, 0.98, 0.93],
  intensity: 1, ambient: 0.96, shadowStrength: 0.32, softness: 1.5,
};
const NIGHT: SceneShadowLightProfile = {
  kind: 'night', direction: [0.35, -1, 0.25], colour: [0.72, 0.8, 1],
  intensity: 0.26, ambient: 0.48, shadowStrength: 0.18, softness: 2.5,
};
const INDOOR: SceneShadowLightProfile = {
  kind: 'indoor', direction: [0.035, -1, 0.025], colour: [1, 0.92, 0.8],
  intensity: 0.7, ambient: 0.98, shadowStrength: 0.26, softness: 2,
};
const SUNSET: SceneShadowLightProfile = {
  kind: 'sunset', direction: [1, -0.55, 0.65], colour: [1, 0.79, 0.57],
  intensity: 0.8, ambient: 0.97, shadowStrength: 0.32, softness: 2,
};

/** Sky artwork identifies the night maps; the three factory maps are enclosed. */
export function sceneShadowLightProfile(mapId: string): SceneShadowLightProfile {
  switch (originalSceneId(mapId) ?? mapId) {
    case '0008': case '0011': case '0013': case '0020': return NIGHT;
    case '0009': case '0015': case '0018': return INDOOR;
    case '0010': return SUNSET;
    default: return DAY;
  }
}
