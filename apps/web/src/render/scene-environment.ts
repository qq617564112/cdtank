import {Color3, Scene, ShaderMaterial, UniformBuffer} from '@babylonjs/core';
import {ORIGINAL_SCENE_AMBIENT, type SceneEnvironment} from '../../../shared/maps/scene-environment';

/**
 * Shared narrow shader helper for the original scene environment.
 *
 * The original actor selector (`0x1000d570`) folds the fog flag
 * (`+0x590` = 1/2/3 -> `geom_f1`/`geom_F2`/`geom_f3`) and the selected light
 * records (`+0xe4`/`+0xe8` -> `geom_1L`/`geom_2L`) into the GBF choice. This
 * helper keeps one shader per material and shares the scene registers in
 * one uniform buffer.
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

/** Camera values are supplied by Babylon for the current render pass. */
export const SCENE_ENVIRONMENT_UNIFORMS = ['cameraPosition'];

const ENVIRONMENT_FIELDS = ['sourceFogSettings', 'sourceFogColor', 'sourceFogParams',
  'sourceLight0Position', 'sourceLight0Attenuation', 'sourceLight0Diffuse',
  'sourceLight1Position', 'sourceLight1Attenuation', 'sourceLight1Diffuse'];

const ENVIRONMENT_DECLARATION = `
uniform SourceEnvironment {
  vec4 sourceFogSettings;
  vec4 sourceFogColor;
  vec4 sourceFogParams;
  vec4 sourceLight0Position;
  vec4 sourceLight0Attenuation;
  vec4 sourceLight0Diffuse;
  vec4 sourceLight1Position;
  vec4 sourceLight1Attenuation;
  vec4 sourceLight1Diffuse;
};
#define sceneFogEnabled sourceFogSettings.x
#define sceneFogMode sourceFogSettings.y
#define sceneLightCount int(sourceFogSettings.z)
#define sceneFogColor sourceFogColor.xyz
#define sceneFogParams sourceFogParams.xyz
#define sceneLight0Pos sourceLight0Position.xyz
#define sceneLight0Atten sourceLight0Attenuation.xyz
#define sceneLight0Diffuse sourceLight0Diffuse.xyz
#define sceneLight1Pos sourceLight1Position.xyz
#define sceneLight1Atten sourceLight1Attenuation.xyz
#define sceneLight1Diffuse sourceLight1Diffuse.xyz
`;

/**
 * Vertex-stage declaration; compute `sceneLitColor` and `sceneFogFactor`.
 * The world matrix is intentionally not declared here: shaders that include
 * Babylon's `instancesDeclaration` already receive it, and the others declare
 * their own to avoid a duplicate uniform error.
 */
export const SCENE_ENVIRONMENT_VERTEX_DECLARATION = `precision highp float;
${ENVIRONMENT_DECLARATION}
uniform vec3 cameraPosition;
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
${ENVIRONMENT_DECLARATION}
varying float sceneFogFactor;
`;

export const SCENE_ENVIRONMENT_FRAGMENT_APPLY =
  '  if (sceneFogEnabled > 0.5) gl_FragColor.rgb = mix(sceneFogColor, gl_FragColor.rgb, sceneFogFactor);';

/**
 * Scene-scoped resolved environment. WeakMap keeps it tied to the live scene
 * so a later scene never inherits the previous map's fog or lights.
 */
const sceneEnvironments = new WeakMap<Scene, SceneShaderEnvironment>();
const environmentBuffers = new WeakMap<Scene, UniformBuffer>();

function environmentBuffer(scene: Scene): UniformBuffer {
  let buffer = environmentBuffers.get(scene);
  if (!buffer) {
    buffer = new UniformBuffer(scene.getEngine(), undefined, false, 'source-environment', false, false);
    for (const name of ENVIRONMENT_FIELDS) buffer.addUniform(name, 4);
    buffer.create();
    environmentBuffers.set(scene, buffer);
    scene.onDisposeObservable.addOnce(() => {buffer!.dispose(); environmentBuffers.delete(scene);});
    updateEnvironmentBuffer(buffer, sceneEnvironments.get(scene));
  }
  return buffer;
}

function updateEnvironmentBuffer(buffer: UniformBuffer, environment?: SceneShaderEnvironment): void {
  buffer.updateFloat4('sourceFogSettings', environment?.fogEnabled ?? 0,
    environment?.fogMode ?? 0, environment?.lights.length ?? 0, 0);
  buffer.updateFloat4('sourceFogColor', ...(environment?.fogColor ?? [0, 0, 0] as const), 0);
  buffer.updateFloat4('sourceFogParams', ...(environment?.fogParams ?? [0, 0, 0] as const), 0);
  for (let index = 0; index < 2; index++) {
    const light = environment?.lights[index];
    buffer.updateFloat4(`sourceLight${index}Position`, -(light?.position[0] ?? 0),
      light?.position[1] ?? 0, light?.position[2] ?? 0, 0);
    buffer.updateFloat4(`sourceLight${index}Attenuation`, ...(light?.attenuation ?? [0, 0, 0] as const), 0);
    buffer.updateFloat4(`sourceLight${index}Diffuse`, ...(light?.diffuse ?? [0, 0, 0] as const), 0);
  }
  buffer.update();
}

/** Drop the registered environment; the next map registers its own. */
export function resetSceneShaderEnvironment(scene: Scene): void {
  sceneEnvironments.delete(scene);
  const buffer = environmentBuffers.get(scene);
  if (buffer) updateEnvironmentBuffer(buffer);
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.ambientColor = Color3.FromArray(ORIGINAL_SCENE_AMBIENT);
}

/** Bind a material to the current scene environment if the scene has one. */
export function bindSceneEnvironmentIfPresent(material: ShaderMaterial,
  scene: Scene): boolean {
  material.setUniformBuffer('SourceEnvironment', environmentBuffer(scene));
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

/** Publish the environment once for all custom materials in this scene. */
export function bindSceneShaderEnvironment(material: ShaderMaterial,
  environment: SceneShaderEnvironment): void {
  const scene = material.getScene();
  sceneEnvironments.set(scene, environment);
  const buffer = environmentBuffer(scene);
  material.setUniformBuffer('SourceEnvironment', buffer);
  updateEnvironmentBuffer(buffer, environment);
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
  updateEnvironmentBuffer(environmentBuffer(scene), sceneEnvironments.get(scene));
}
