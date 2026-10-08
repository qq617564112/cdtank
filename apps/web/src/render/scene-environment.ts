import {Color3, Scene, ShaderMaterial, Vector3} from '@babylonjs/core';
import {ORIGINAL_SCENE_AMBIENT, type SceneEnvironment} from '../../../shared/maps/scene-environment';

/**
 * Shared narrow shader helper for the original scene environment.
 *
 * The original actor selector (`0x1000d570`) folds the fog flag
 * (`+0x590` = 1/2/3 -> `geom_f1`/`geom_F2`/`geom_f3`) and the selected light
 * records (`+0xe4`/`+0xe8` -> `geom_1L`/`geom_2L`) into the GBF choice. This
 * helper keeps one shader per material and supplies the same registers at
 * bind time instead of copying every GBF combination.
 */

export interface SceneShaderEnvironment {
  readonly fogEnabled: number;
  readonly fogMode: number;
  readonly fogColor: readonly [number, number, number];
  readonly fogParams: readonly [number, number, number];
  readonly lights: readonly {
    readonly position: readonly [number, number, number];
    readonly attenuation: readonly [number, number, number];
    readonly diffuse: readonly [number, number, number];
  }[];
}

/** Uniform names every environment-aware material must declare. */
export const SCENE_ENVIRONMENT_UNIFORMS = [
  'sceneFogEnabled', 'sceneFogMode', 'sceneFogColor', 'sceneFogParams',
  'cameraPosition',
  'sceneLightCount', 'sceneLight0Pos', 'sceneLight0Atten', 'sceneLight0Diffuse',
  'sceneLight1Pos', 'sceneLight1Atten', 'sceneLight1Diffuse',
];

/**
 * Vertex-stage declaration; compute `sceneLitColor` and `sceneFogFactor`.
 * The world matrix is intentionally not declared here: shaders that include
 * Babylon's `instancesDeclaration` already receive it, and the others declare
 * their own to avoid a duplicate uniform error.
 */
export const SCENE_ENVIRONMENT_VERTEX_DECLARATION = `precision highp float;
uniform float sceneFogEnabled;
uniform float sceneFogMode;
uniform vec3 sceneFogColor;
uniform vec3 sceneFogParams;
uniform vec3 cameraPosition;
uniform int sceneLightCount;
uniform vec3 sceneLight0Pos;
uniform vec3 sceneLight0Atten;
uniform vec3 sceneLight0Diffuse;
uniform vec3 sceneLight1Pos;
uniform vec3 sceneLight1Atten;
uniform vec3 sceneLight1Diffuse;
varying float sceneFogFactor;
varying vec3 sceneLitColor;
vec3 sceneLight(vec3 ambient, vec3 worldPosition, vec3 worldNormal) {
  vec3 lit = ambient;
  for (int i = 0; i < 2; i++) {
    if (i >= sceneLightCount) break;
    vec3 position = i == 0 ? sceneLight0Pos : sceneLight1Pos;
    vec3 atten = i == 0 ? sceneLight0Atten : sceneLight1Atten;
    vec3 diffuse = i == 0 ? sceneLight0Diffuse : sceneLight1Diffuse;
    vec3 direct = position - worldPosition;
    float distance = length(direct);
    vec3 factor = vec3(1.0, distance, distance * distance);
    float falloff = 1.0 / max(dot(factor, atten), 0.0001);
    lit += falloff * max(dot(worldNormal, direct / max(distance, 0.0001)), 0.0) * diffuse;
  }
  return lit;
}
float sceneFog(vec3 worldPosition) {
  if (sceneFogEnabled < 0.5) return 1.0;
  if (sceneFogMode > 2.5) {
    return clamp((worldPosition.y + sceneFogParams.x) / sceneFogParams.y, 0.0, 1.0);
  }
  if (sceneFogMode > 1.5) {
    float distance = length(cameraPosition - worldPosition);
    return clamp((sceneFogParams.y - distance) / max(sceneFogParams.y - sceneFogParams.x, 0.0001), 0.0, 1.0);
  }
  return clamp(dot(sceneFogParams, worldPosition) + 1.0, 0.0, 1.0);
}`;

/** Fragment-stage declaration and fog blend toward the original fog color. */
export const SCENE_ENVIRONMENT_FRAGMENT_DECLARATION = `precision highp float;
uniform float sceneFogEnabled;
uniform vec3 sceneFogColor;
varying float sceneFogFactor;
`;

export const SCENE_ENVIRONMENT_FRAGMENT_APPLY =
  '  if (sceneFogEnabled > 0.5) gl_FragColor.rgb = mix(sceneFogColor, gl_FragColor.rgb, sceneFogFactor);';

/**
 * Scene-scoped resolved environment. WeakMap keeps it tied to the live scene
 * so a later scene never inherits the previous map's fog or lights.
 */
const sceneEnvironments = new WeakMap<Scene, SceneShaderEnvironment>();

/** Drop the registered environment; the next map registers its own. */
export function resetSceneShaderEnvironment(scene: Scene): void {
  sceneEnvironments.delete(scene);
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.ambientColor = Color3.FromArray(ORIGINAL_SCENE_AMBIENT);
}

/** Bind a material to the current scene environment if the scene has one. */
export function bindSceneEnvironmentIfPresent(material: ShaderMaterial,
  scene: Scene): boolean {
  const update = (): void => {
    const environment = sceneEnvironments.get(scene);
    if (environment) bindSceneShaderEnvironment(material, environment);
    else {
      material.setFloat('sceneFogEnabled', 0);
      material.setInt('sceneLightCount', 0);
    }
  };
  update();
  material.onBindObservable.add(update);
  return sceneEnvironments.has(scene);
}

/** Narrow value the shader helper needs; the shared config is one producer. */
export function sceneShaderEnvironment(environment: SceneEnvironment): SceneShaderEnvironment {
  return {
    fogEnabled: environment.fogEnabled ? 1 : 0,
    fogMode: environment.fogMode,
    fogColor: environment.fogColor,
    fogParams: [environment.fogParams[0], environment.fogParams[1], environment.fogParams[2]],
    lights: environment.lights,
  };
}

/** Bind the helper's registers; called from each material's bind observer. */
export function bindSceneShaderEnvironment(material: ShaderMaterial,
  environment: SceneShaderEnvironment): void {
  material.setFloat('sceneFogEnabled', environment.fogEnabled);
  material.setFloat('sceneFogMode', environment.fogMode);
  material.setVector3('sceneFogColor', new Vector3(environment.fogColor[0],
    environment.fogColor[1], environment.fogColor[2]));
  material.setVector3('sceneFogParams', new Vector3(environment.fogParams[0],
    environment.fogParams[1], environment.fogParams[2]));
  material.setInt('sceneLightCount', environment.lights.length);
  for (let index = 0; index < 2; index++) {
    const light = environment.lights[index];
    if (!light) continue;
    material.setVector3(`sceneLight${index}Pos`, new Vector3(-light.position[0],
      light.position[1], light.position[2]));
    material.setVector3(`sceneLight${index}Atten`, new Vector3(light.attenuation[0],
      light.attenuation[1], light.attenuation[2]));
    material.setVector3(`sceneLight${index}Diffuse`, new Vector3(light.diffuse[0],
      light.diffuse[1], light.diffuse[2]));
  }
}

/**
 * Bind the scene-level Babylon fog/ambient so standard materials and the
 * custom helper agree. Custom shaders additionally read the registered
 * helper uniforms through `bindSceneEnvironmentIfPresent`.
 */
export function applySceneEnvironment(scene: Scene, environment: SceneEnvironment): void {
  scene.ambientColor = new Color3(environment.ambient[0], environment.ambient[1],
    environment.ambient[2]);
  scene.fogColor = Color3.FromArray(environment.fogColor);
  scene.fogStart = environment.fogParams[0];
  scene.fogEnd = environment.fogParams[1];
  scene.fogDensity = environment.fogDensity;
  if (environment.fogEnabled) {
    scene.fogMode = Scene.FOGMODE_LINEAR;
  } else {
    scene.fogMode = Scene.FOGMODE_NONE;
  }
  sceneEnvironments.set(scene, sceneShaderEnvironment(environment));
}
