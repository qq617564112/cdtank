import {AssetContainer, Constants, PBRMaterial, ShaderMaterial, type BaseTexture} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';
import {
  bindSceneEnvironmentIfPresent, SCENE_ENVIRONMENT_FRAGMENT_APPLY,
  SCENE_ENVIRONMENT_FRAGMENT_DECLARATION, SCENE_ENVIRONMENT_UNIFORMS,
  SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../../render/scene-environment';
import {bindSceneShadowMaterial, SCENE_SHADOW_VERTEX_DECLARATION, SCENE_SHADOW_VERTEX_APPLY,
  SCENE_SHADOW_FRAGMENT_DECLARATION, SCENE_SHADOW_FRAGMENT_BEGIN,
  SCENE_SHADOW_FRAGMENT_APPLY} from '../../render/scene-shadow-light';

/** Native POL mesh/part names; each listed part is FVF21, kind0. */
const SOURCE_MESHES = {
  obj05431: 'anangua04/0',
  obj05424: 'box01/0',
  obj05460: 'object10/0',
  obj05420: 'cone56/0',
  obj05459: 'box35/0',
  obj05023: 'object235/0',
  'obj05023/scr': 'object230/0',
} as const;

export type SceneGeneralMaterialModel = keyof typeof SOURCE_MESHES;

export function sceneGeneralMaterialModel(model: string): SceneGeneralMaterialModel | undefined {
  return (Object.keys(SOURCE_MESHES) as SceneGeneralMaterialModel[]).find(value => value === model);
}

/** Original geom_c1: opaque texture × packed vertex diffuse. */
export class SceneGeneralMaterial {
  private readonly replacements: {mesh: AssetContainer['meshes'][number];
    original: PBRMaterial; material: ShaderMaterial}[] = [];

  /** A supplied texture retains its caller's sampler and ownership. */
  register(asset: AssetContainer, model: SceneGeneralMaterialModel = 'obj05431', textureOverride?: BaseTexture): void {
    const meshName = SOURCE_MESHES[model];
    const mesh = asset.meshes.find(value => value.name === meshName);
    if (!mesh || !(mesh.material instanceof PBRMaterial) || (!textureOverride && !mesh.material.albedoTexture)) {
      throw new Error(`原 General ${model} 模型或纹理缺失`);
    }
    const original = mesh.material;
    const texture = textureOverride ?? original.albedoTexture!;
    const material = new ShaderMaterial(`source-pol/${model}/${meshName}`, asset.scene, {
      vertexSource: `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
${SCENE_SHADOW_VERTEX_DECLARATION}
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 color;
uniform mat4 viewProjection;
#include<instancesDeclaration>
varying vec2 sourceUv;
varying vec4 sourceDiffuse;
void main() {
#include<instancesVertex>
  sourceUv = uv; sourceDiffuse = color;
  vec4 worldPosition = finalWorld * vec4(position, 1.0);
  vec3 worldNormal = normalize(mat3(finalWorld) * normal);
${SCENE_SHADOW_VERTEX_APPLY}
  sceneLitColor = vec3(1.0);
  sceneFogFactor = sceneFog(worldPosition.xyz);
  gl_Position = viewProjection * finalWorld * vec4(position, 1.0);
}`,
      fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
${SCENE_SHADOW_FRAGMENT_DECLARATION}
uniform sampler2D sourceTexture;
varying vec2 sourceUv;
varying vec4 sourceDiffuse;
void main() {
${SCENE_SHADOW_FRAGMENT_BEGIN}
  gl_FragColor = texture2D(sourceTexture, sourceUv) * sourceDiffuse;
${SCENE_SHADOW_FRAGMENT_APPLY}
${SCENE_ENVIRONMENT_FRAGMENT_APPLY}
}`,
    }, {attributes: ['position', 'normal', 'uv', 'color'],
      uniforms: ['world', 'viewProjection', 'sceneShadowReceiver', ...SCENE_ENVIRONMENT_UNIFORMS],
      samplers: ['sourceTexture', 'sceneShadowTexture'], needAlphaBlending: false, needAlphaTesting: false});
    if (!textureOverride) {
      texture.wrapU = texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
      texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
    }
    material.setTexture('sourceTexture', texture);
    bindSceneEnvironmentIfPresent(material, asset.scene);
    bindSceneShadowMaterial(material, texture);
    material.transparencyMode = ShaderMaterial.MATERIAL_OPAQUE;
    material.alphaMode = Constants.ALPHA_DISABLE;
    material.depthFunction = Constants.LESS;
    material.forceDepthWrite = true;
    material.backFaceCulling = original.backFaceCulling;
    material.metadata = {sourceGeneralModel: model, sourceGeneralShader: 'geom_c1.gbf',
      sourceGeneralKind: 0};
    mesh.material = material;
    this.replacements.push({mesh, original, material});
  }

  dispose(): void {
    for (const {mesh, original, material} of this.replacements) {
      if (!mesh.isDisposed()) mesh.material = original;
      material.dispose(false, false);
    }
    this.replacements.length = 0;
  }
}
