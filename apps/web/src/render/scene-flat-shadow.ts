import {
  SCENE_SHADOW_VERTEX_DECLARATION, SCENE_SHADOW_VERTEX_APPLY,
  SCENE_SHADOW_LIGHT_UNIFORM_DECLARATION, SCENE_SHADOW_FRAGMENT_DECLARATION,
} from './scene-shadow-light';

const VARYINGS = `varying vec3 propShadowCoordinates;
varying float propShadowIncidence;
varying vec2 propShadowSlope;`;

/** Static POL faces carry one shading normal parallel to their geometric plane. */
export const SCENE_FLAT_SHADOW_VERTEX_DECLARATION = `${SCENE_SHADOW_VERTEX_DECLARATION}
#ifndef SCENE_SHADOWS_DISABLED
${SCENE_SHADOW_LIGHT_UNIFORM_DECLARATION}
${VARYINGS}
#endif`;

/** finalWorld includes the native instance transform, including reflected scale. */
export const SCENE_FLAT_SHADOW_VERTEX_APPLY = `${SCENE_SHADOW_VERTEX_APPLY}
#ifndef SCENE_SHADOWS_DISABLED
  mat3 worldAxes = mat3(finalWorld);
  mat3 worldCofactors = mat3(cross(worldAxes[1], worldAxes[2]), cross(worldAxes[2], worldAxes[0]), cross(worldAxes[0], worldAxes[1]));
  vec3 geometricNormal = normalize(worldCofactors * normal);
  if (dot(geometricNormal, worldNormal) < 0.0) geometricNormal = -geometricNormal;
  propShadowIncidence = max(dot(geometricNormal, -sceneShadowDirection.xyz), 0.0);
  vec3 offset = 0.35 * sqrt(max(0.0, 1.0 - propShadowIncidence * propShadowIncidence)) * geometricNormal;
  vec3 clip = (sceneShadowMatrix * vec4(worldPosition.xyz + offset, 1.0)).xyz;
  propShadowCoordinates = vec3(clip.xy * 0.5 + 0.5, sceneShadowDepth.x * clip.z + sceneShadowDepth.y);
  mat3 projectedAxes = mat3(sceneShadowMatrix);
  vec3 scales = vec3(0.5, 0.5, sceneShadowDepth.x);
  projectedAxes[0] *= scales;
  projectedAxes[1] *= scales;
  projectedAxes[2] *= scales;
  mat3 cofactors = mat3(cross(projectedAxes[1], projectedAxes[2]), cross(projectedAxes[2], projectedAxes[0]), cross(projectedAxes[0], projectedAxes[1]));
  vec3 projectedNormal = cofactors * geometricNormal;
  propShadowSlope = propShadowIncidence >= 0.001 ? -projectedNormal.xy / projectedNormal.z : vec2(0.0);
#endif`;

export const SCENE_FLAT_SHADOW_FRAGMENT_DECLARATION = `${SCENE_SHADOW_FRAGMENT_DECLARATION}
#ifndef SCENE_SHADOWS_DISABLED
${VARYINGS}
#endif`;

/** Lighting keeps the original shading normal; only geometric projection moves. */
export const SCENE_FLAT_SHADOW_FRAGMENT_BEGIN = `
#ifndef SCENE_SHADOWS_DISABLED
  vec3 sceneShadowNormal = sceneShadowWorldNormal;
  float sceneShadowIncidence = propShadowIncidence;
  vec3 sceneShadowCoordinatesAtPixel = propShadowCoordinates;
  vec2 sceneShadowSlope = propShadowSlope;
#endif`;
