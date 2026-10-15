import {AssetContainer, BaseTexture, Constants, PBRMaterial, Scene, ShaderMaterial, Vector3, Vector4} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexGlobalDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexGlobal';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertex';
import {
  bindSceneEnvironmentIfPresent,
  SCENE_ENVIRONMENT_FRAGMENT_APPLY, SCENE_ENVIRONMENT_FRAGMENT_DECLARATION,
  SCENE_ENVIRONMENT_UNIFORMS, SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../scene-environment';
import type {SceneActorToonBinding} from './actor-toon';
import type {SourceMv3Material} from '../../assets/tanks/mv3-model-extras';
import {invalidateMaterialDrawBundles} from '../webgpu-draw-cache';
import {bindSceneShadowMaterial, sceneShadowLight, SCENE_SHADOW_VERTEX_DECLARATION, SCENE_SHADOW_VERTEX_APPLY,
  SCENE_SHADOW_FRAGMENT_DECLARATION, SCENE_SHADOW_FRAGMENT_BEGIN,
  SCENE_SHADOW_FRAGMENT_APPLY} from '../scene-shadow-light';

/** Original 1001b6f0 parameter4, ordinary MV3 with no selected lights/fog. */
export function mv3Ambient(properties: readonly number[], opacity = 1,
  ambient: readonly number[] = [0.2, 0.2, 0.2], emissive = 0): number[] {
  if (properties.length !== 17 || ambient.length !== 3) throw new Error('Invalid original MV3 material');
  return [0, 1, 2].map(axis => Math.fround(
    Math.fround(Math.fround(ambient[axis]) * properties[4 + axis]) +
    Math.fround(Math.fround(emissive) * properties[12 + axis]),
  )).concat(Math.fround(Math.fround(opacity) * properties[7]));
}

/**
 * newgeom/geom_t COLOR=ambient, stage0 TEXTURE*CURRENT. The original selector
 * swaps to the geom_1L/geom_2L and geom_f1/geom_F2/geom_f3 families when the
 * scene has selected lights or fog; this single shader supplies the same
 * registers so no GBF combination is copied per material.
 */
export function createMv3Material(scene: Scene, properties: readonly number[], texture?: BaseTexture,
  opacity = 1, actorToon?: SceneActorToonBinding): ShaderMaterial {
  const transparent = properties[3] < 1 || opacity < 1;
  const sceneShadows = Boolean(sceneShadowLight(scene));
  const originalToon = sceneShadows ? undefined : actorToon;
  const actorToonVertex = originalToon ? `
uniform float actorToonEnabled;
uniform vec3 actorToonLightDirection;
varying float actorToonLight;` : '';
  const actorToonFragment = originalToon ? `
uniform sampler2D actorToonTexture;
uniform float actorToonEnabled;
varying float actorToonLight;` : '';
  const material = new ShaderMaterial('original-mv3-material', scene, {
    vertexSource: `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
${sceneShadows ? SCENE_SHADOW_VERTEX_DECLARATION : ''}
${actorToonVertex}
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 worldViewProjection;
uniform vec4 sourceAmbient;
varying vec2 vUV;
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
void main(){vec3 positionUpdated=position;vec3 normalUpdated=normal;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
vec4 worldPosition=world*vec4(positionUpdated,1.0);
vec3 rawNormal=(world*vec4(normalUpdated,0.0)).xyz;
vec3 worldNormal=dot(rawNormal,rawNormal)>0.0?normalize(rawNormal):vec3(0.0,1.0,0.0);
${sceneShadows ? SCENE_SHADOW_VERTEX_APPLY : ''}
sceneLitColor=clamp(sceneLight(sourceAmbient.rgb,worldPosition.xyz,worldNormal),0.0,1.0);
sceneFogFactor=sceneFog(worldPosition.xyz);
${originalToon ? 'actorToonLight=actorToonEnabled>0.5?max(dot(worldNormal,actorToonLightDirection),0.0):0.0;' : ''}
gl_Position=worldViewProjection*vec4(positionUpdated,1.0);vUV=uv;}`,
    fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
${sceneShadows ? SCENE_SHADOW_FRAGMENT_DECLARATION : ''}
${actorToonFragment}
varying vec2 vUV;
varying vec3 sceneLitColor;
uniform vec4 sourceAmbient;
uniform float actorOpacity;
uniform vec3 sourceColorFilter;
${texture ? 'uniform sampler2D sourceTexture;' : ''}
void main(){
${sceneShadows ? SCENE_SHADOW_FRAGMENT_BEGIN : ''}
vec4 base=${texture ? 'texture2D(sourceTexture,vUV)' : 'vec4(1.0)'};
base.rgb=clamp(base.rgb*sourceColorFilter,0.0,1.0);
vec4 color;
${originalToon ? `if(actorToonEnabled>0.5){
vec3 toon=texture2D(actorToonTexture,vec2(actorToonLight,1.0)).rgb;
color=base*vec4(sourceAmbient.rgb*toon,sourceAmbient.a);
}else{
color=base*vec4(clamp(sceneLitColor,0.0,1.0),1.0);
color.a=base.a*sourceAmbient.a;
}` : `color=base*vec4(clamp(sceneLitColor,0.0,1.0),1.0);
color.a=base.a*sourceAmbient.a;`}
${transparent ? 'if(floor(color.a*255.0+0.5)<=100.0)discard;' : ''}
color.a*=actorOpacity;
gl_FragColor=color;
${sceneShadows ? SCENE_SHADOW_FRAGMENT_APPLY : ''}
${SCENE_ENVIRONMENT_FRAGMENT_APPLY}
}`,
  }, {attributes: ['position', 'normal', 'uv'], defines: ['NORMAL'],
    uniforms: ['world', 'worldViewProjection', 'sourceAmbient', 'actorOpacity', 'sourceColorFilter',
      ...(sceneShadows ? ['sceneShadowReceiver'] : []),
      ...(originalToon ? ['actorToonEnabled', 'actorToonLightDirection'] : []),
      ...SCENE_ENVIRONMENT_UNIFORMS],
    samplers: [...(texture ? ['sourceTexture'] : []), ...(originalToon ? ['actorToonTexture'] : []),
      ...(sceneShadows ? ['sceneShadowTexture'] : [])],
    needAlphaBlending: transparent});
  const ambientColor = new Vector4();
  let red = NaN, green = NaN, blue = NaN;
  const updateAmbient = (): void => {
    const current = scene.ambientColor;
    if (red === current.r && green === current.g && blue === current.b) return;
    red = current.r; green = current.g; blue = current.b;
    const ambient = scene.ambientColor.equalsFloats(0, 0, 0)
      ? [0.2, 0.2, 0.2] : scene.ambientColor.asArray();
    Vector4.FromArrayToRef(mv3Ambient(properties, opacity, ambient), 0, ambientColor);
    material.setVector4('sourceAmbient', ambientColor);
    material.getEffect()?.setVector4('sourceAmbient', ambientColor);
    if (material.metadata?.originalMV3) material.metadata.originalMV3.ambient = ambient;
  };
  updateAmbient();
  material.onBindObservable.add(updateAmbient);
  material.setFloat('actorOpacity', 1);
  material.setVector3('sourceColorFilter', Vector3.One());
  if (texture) {
    // default.gbf/newgeom/geom_t: LINEAR min/mag, WRAP U/V; no mip filter.
    texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
    texture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
    texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    material.setTexture('sourceTexture', texture);
  }
  if (originalToon) {
    material.setTexture('actorToonTexture', originalToon.texture);
    const toonLight = new Vector3();
    const updateActorToon = (): void => {
      const enabled = originalToon.active();
      const direction = enabled ? originalToon.lightDirection() : undefined;
      const light = direction ? toonLight.set(direction[0], direction[1], direction[2]) : undefined;
      material.setFloat('actorToonEnabled', enabled ? 1 : 0);
      if (light) material.setVector3('actorToonLightDirection', light);
      // ShaderMaterial uploads its cached uniforms before onBindObservable fires,
      // so push the current values onto the bound effect to cover this draw.
      const effect = material.getEffect();
      if (!effect) return;
      effect.setFloat('actorToonEnabled', enabled ? 1 : 0);
      if (light) effect.setVector3('actorToonLightDirection', light);
    };
    updateActorToon();
    material.onBindObservable.add(updateActorToon);
  }
  // Battle scene registers its environment before actors load; tools that do
  // not register one keep the original ambient-only color (light count 0).
  bindSceneEnvironmentIfPresent(material, scene);
  if (texture) material.getAlphaTestTexture = () => texture;
  if (sceneShadows) bindSceneShadowMaterial(material, texture);
  material.backFaceCulling = true;
  material.depthFunction = Constants.LESS;
  // newgeom/geom_t inherit ZWriteEnable=TRUE from default.gbf.
  material.forceDepthWrite = true;
  material.transparencyMode = transparent ? ShaderMaterial.MATERIAL_ALPHABLEND : ShaderMaterial.MATERIAL_OPAQUE;
  material.alphaMode = transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
  material.metadata = {originalMV3: {properties: [...properties], opacity, script: transparent ? 'geom_t' : 'newgeom',
    ambient: scene.ambientColor.asArray(), scope: sceneShadows
      ? 'Source material colour with shared scene lighting and shadows'
      : originalToon ? 'Source material with the registered scene actor toon light and texture'
        : 'Source material formula with scene ambient'}};
  return material;
}

/** Actor opacity is applied after source alpha rejection and restores the source blend mode. */
export function setMv3ActorOpacity(material: ShaderMaterial, opacity: number): void {
  const transparent = opacity < 1 || material.metadata?.originalMV3?.script === 'geom_t';
  const mode = transparent ? ShaderMaterial.MATERIAL_ALPHABLEND : ShaderMaterial.MATERIAL_OPAQUE;
  if (material.transparencyMode !== mode) invalidateMaterialDrawBundles(material);
  material.setFloat('actorOpacity', opacity);
  material.alpha = opacity;
  material.transparencyMode = mode;
  material.alphaMode = transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
}

type Mv3MaterialFactory = (properties: readonly number[], texture: BaseTexture | undefined,
  opacity: number) => ShaderMaterial;

/** Replaced source materials are released only when the container owns them. */
function replaceMv3Materials(assets: AssetContainer, materialFor: Mv3MaterialFactory,
  textureOverride?: BaseTexture, texturesBySource?: ReadonlyMap<string, BaseTexture>): ShaderMaterial[] {
  const replacements = new Map<PBRMaterial | ShaderMaterial | SourceMv3Material, ShaderMaterial>();
  for (const mesh of assets.meshes) {
    const old = mesh.material;
    const source = (old instanceof PBRMaterial ? old.metadata?.gltf?.extras?.originalMV3 :
      textureOverride && old instanceof ShaderMaterial ? old.metadata?.originalMV3 :
        !old ? mesh._internalMetadata?.originalMV3Material : undefined) as SourceMv3Material | undefined;
    if (!source?.properties || source.properties.length !== 17) continue;
    const texture = textureOverride ?? texturesBySource?.get(source.textures?.[0] ?? '')
      ?? (old instanceof PBRMaterial ? old.albedoTexture : undefined);
    if (source.textures?.[0] && !texture) continue;
    const sourceKey = old instanceof PBRMaterial || old instanceof ShaderMaterial ? old : source;
    let material = replacements.get(sourceKey);
    if (!material) {
      material = materialFor(source.properties, texture ?? undefined, source.opacity ?? 1);
      replacements.set(sourceKey, material);
    }
    mesh.material = material;
  }
  for (const old of replacements.keys()) {
    if (!(old instanceof PBRMaterial) && !(old instanceof ShaderMaterial)) continue;
    const index = assets.materials.indexOf(old);
    if (index < 0) continue;
    assets.materials.splice(index, 1);
    old.dispose(false, false);
  }
  return [...new Set(replacements.values())];
}

/** Only source-tagged MV3 imports; POL/CVD and effect-specific materials keep their paths. */
export function applyMv3Materials(scene: Scene, assets: AssetContainer,
  textureOverride?: BaseTexture, texturesBySource?: ReadonlyMap<string, BaseTexture>,
  actorToon?: SceneActorToonBinding): ShaderMaterial[] {
  const materials = replaceMv3Materials(assets,
    (properties, texture, opacity) => createMv3Material(scene, properties, texture, opacity, actorToon),
    textureOverride, texturesBySource);
  assets.materials.push(...materials);
  return materials;
}

interface SharedMv3Material {
  readonly properties: readonly number[];
  readonly texture: BaseTexture | undefined;
  readonly opacity: number;
  readonly material: ShaderMaterial;
}

/** One actor component owns matching materials across its action containers. */
export class Mv3MaterialResources {
  private readonly entries: SharedMv3Material[] = [];

  constructor(private readonly scene: Scene, private readonly actorToon?: SceneActorToonBinding) {}

  apply(assets: AssetContainer, textureOverride?: BaseTexture,
    texturesBySource?: ReadonlyMap<string, BaseTexture>): ShaderMaterial[] {
    return replaceMv3Materials(assets, (properties, texture, opacity) => {
      for (const entry of this.entries) {
        if (entry.texture === texture && entry.opacity === opacity
          && entry.properties.every((value, index) => value === properties[index])) return entry.material;
      }
      const material = createMv3Material(this.scene, properties, texture, opacity, this.actorToon);
      this.entries.push({properties, texture, opacity, material});
      return material;
    }, textureOverride, texturesBySource);
  }

  dispose(): void {
    for (const entry of this.entries) entry.material.dispose(false, false);
    this.entries.length = 0;
  }
}
