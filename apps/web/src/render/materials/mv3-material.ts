import {AbstractMesh, BaseTexture, Constants, PBRMaterial, Scene, ShaderMaterial, Vector3, Vector4} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexGlobalDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexGlobal';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertex';
import {getDisplayPreferences} from '../../interface/settings/display-preferences';
import {
  bindSceneEnvironmentIfPresent,
  SCENE_ENVIRONMENT_FRAGMENT_APPLY, SCENE_ENVIRONMENT_FRAGMENT_DECLARATION,
  SCENE_ENVIRONMENT_UNIFORMS, SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../scene-environment';
import type {SceneActorToonBinding} from './actor-toon';

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
  const actorToonVertex = actorToon ? `
uniform float actorToonEnabled;
uniform vec3 actorToonLightDirection;
varying float actorToonLight;` : '';
  const actorToonFragment = actorToon ? `
uniform sampler2D actorToonTexture;
uniform float actorToonEnabled;
varying float actorToonLight;` : '';
  const material = new ShaderMaterial('original-mv3-material', scene, {
    vertexSource: `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
${actorToonVertex}
attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
uniform mat4 world; uniform mat4 worldViewProjection; uniform vec4 sourceAmbient;
varying vec2 vUV;
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
void main(){vec3 positionUpdated=position;vec3 normalUpdated=normal;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
vec4 worldPosition=world*vec4(positionUpdated,1.0);
vec3 rawNormal=(world*vec4(normalUpdated,0.0)).xyz;
vec3 worldNormal=dot(rawNormal,rawNormal)>0.0?normalize(rawNormal):vec3(0.0,1.0,0.0);
sceneLitColor=clamp(sceneLight(sourceAmbient.rgb,worldPosition.xyz,worldNormal),0.0,1.0);
sceneFogFactor=sceneFog(worldPosition.xyz);
${actorToon ? 'actorToonLight=actorToonEnabled>0.5?max(dot(worldNormal,actorToonLightDirection),0.0):0.0;' : ''}
gl_Position=worldViewProjection*vec4(positionUpdated,1.0);vUV=uv;}`,
    fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
${actorToonFragment}
varying vec2 vUV; varying vec3 sceneLitColor; uniform vec4 sourceAmbient; uniform float actorOpacity;
${texture ? 'uniform sampler2D sourceTexture;' : ''}
void main(){
vec4 base=${texture ? 'texture2D(sourceTexture,vUV)' : 'vec4(1.0)'};
vec4 color;
${actorToon ? `if(actorToonEnabled>0.5){
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
${SCENE_ENVIRONMENT_FRAGMENT_APPLY}
}`,
  }, {attributes: ['position', 'normal', 'uv'], defines: ['NORMAL'],
    uniforms: ['world', 'worldViewProjection', 'sourceAmbient', 'actorOpacity',
      ...(actorToon ? ['actorToonEnabled', 'actorToonLightDirection'] : []),
      ...SCENE_ENVIRONMENT_UNIFORMS],
    samplers: [...(texture ? ['sourceTexture'] : []), ...(actorToon ? ['actorToonTexture'] : [])],
    needAlphaBlending: transparent});
  const updateAmbient = (): void => {
    const ambient = scene.ambientColor.equalsFloats(0, 0, 0)
      ? [0.2, 0.2, 0.2] : scene.ambientColor.asArray();
    const color = Vector4.FromArray(mv3Ambient(properties, opacity, ambient));
    material.setVector4('sourceAmbient', color);
    material.getEffect()?.setVector4('sourceAmbient', color);
    if (material.metadata?.originalMV3) material.metadata.originalMV3.ambient = ambient;
  };
  updateAmbient();
  material.onBindObservable.add(updateAmbient);
  material.setFloat('actorOpacity', 1);
  if (texture) {
    // default.gbf/newgeom/geom_t: LINEAR min/mag, WRAP U/V; no mip filter.
    texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
    texture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
    texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    material.setTexture('sourceTexture', texture);
  }
  if (actorToon) {
    material.setTexture('actorToonTexture', actorToon.texture);
    const updateActorToon = (): void => {
      const enabled = actorToon.active() && getDisplayPreferences().silhouette;
      const direction = enabled ? actorToon.lightDirection() : undefined;
      const light = direction ? new Vector3(direction[0], direction[1], direction[2]) : undefined;
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
  material.backFaceCulling = true;
  material.depthFunction = Constants.LESS;
  // newgeom/geom_t inherit ZWriteEnable=TRUE from default.gbf.
  material.forceDepthWrite = true;
  material.transparencyMode = transparent ? ShaderMaterial.MATERIAL_ALPHABLEND : ShaderMaterial.MATERIAL_OPAQUE;
  material.alphaMode = transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
  material.metadata = {originalMV3: {properties: [...properties], opacity, script: transparent ? 'geom_t' : 'newgeom',
    ambient: scene.ambientColor.asArray(), scope: actorToon
      ? 'Source material with the registered scene actor toon light and texture'
      : 'Source material formula with scene ambient; original actor lighting and fog remain incomplete'}};
  return material;
}

/** Actor opacity is applied after source alpha rejection and restores the source blend mode. */
export function setMv3ActorOpacity(material: ShaderMaterial, opacity: number): void {
  const transparent = opacity < 1 || material.metadata?.originalMV3?.script === 'geom_t';
  material.setFloat('actorOpacity', opacity);
  material.alpha = opacity;
  material.transparencyMode = transparent ? ShaderMaterial.MATERIAL_ALPHABLEND : ShaderMaterial.MATERIAL_OPAQUE;
  material.alphaMode = transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
}

/** Only source-tagged MV3 imports; POL/CVD and effect-specific materials keep their paths. */
export function applyMv3Materials(scene: Scene, meshes: readonly AbstractMesh[],
  textureOverride?: BaseTexture, texturesBySource?: ReadonlyMap<string, BaseTexture>,
  actorToon?: SceneActorToonBinding): ShaderMaterial[] {
  const replacements = new Map<PBRMaterial | ShaderMaterial, ShaderMaterial>();
  for (const mesh of meshes) {
    const old = mesh.material;
    if (!(old instanceof PBRMaterial) && !(textureOverride && old instanceof ShaderMaterial)) continue;
    const source = (old instanceof PBRMaterial ? old.metadata?.gltf?.extras?.originalMV3 :
      old.metadata?.originalMV3) as {properties?: number[]; textures?: string[]; opacity?: number} | undefined;
    if (!source?.properties || source.properties.length !== 17) continue;
    const texture = textureOverride ?? texturesBySource?.get(source.textures?.[0] ?? '')
      ?? (old instanceof PBRMaterial ? old.albedoTexture : undefined);
    if (source.textures?.[0] && !texture) continue;
    let material = replacements.get(old);
    if (!material) {
      material = createMv3Material(scene, source.properties, texture ?? undefined, source.opacity, actorToon);
      replacements.set(old, material);
    }
    mesh.material = material;
  }
  // Replaced objects no longer render; source and actor textures are borrowed resources.
  for (const old of replacements.keys()) old.dispose(false, false);
  return [...replacements.values()];
}
