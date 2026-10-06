import {AssetContainer, Constants, PBRMaterial, ShaderMaterial} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';

/** Original General geom_c1: opaque texture × packed vertex diffuse. */
export class SceneGeneralMaterial {
  private readonly replacements: {mesh: AssetContainer['meshes'][number];
    original: PBRMaterial; material: ShaderMaterial}[] = [];

  register(asset: AssetContainer, model: 'obj05431' | 'obj05424' = 'obj05431'): void {
    const meshName = model === 'obj05431' ? 'anangua04/0' : 'box01/0';
    const mesh = asset.meshes.find(value => value.name === meshName);
    if (!mesh || !(mesh.material instanceof PBRMaterial) || !mesh.material.albedoTexture) {
      throw new Error(`原 General ${model} 模型或纹理缺失`);
    }
    const original = mesh.material;
    const texture = original.albedoTexture!;
    const material = new ShaderMaterial(`${model === 'obj05431' ? 'general11' : 'general06'}/${meshName}`, asset.scene, {
      vertexSource: `precision highp float;
attribute vec3 position; attribute vec2 uv; attribute vec4 color;
uniform mat4 viewProjection;
#include<instancesDeclaration>
varying vec2 sourceUv; varying vec4 sourceDiffuse;
void main() {
#include<instancesVertex>
  sourceUv = uv; sourceDiffuse = color;
  gl_Position = viewProjection * finalWorld * vec4(position, 1.0);
}`,
      fragmentSource: `precision highp float;
uniform sampler2D sourceTexture;
varying vec2 sourceUv; varying vec4 sourceDiffuse;
void main() { gl_FragColor = texture2D(sourceTexture, sourceUv) * sourceDiffuse; }`,
    }, {attributes: ['position', 'uv', 'color'], uniforms: ['world', 'viewProjection'],
      samplers: ['sourceTexture'], needAlphaBlending: false, needAlphaTesting: false});
    texture.wrapU = texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
    material.setTexture('sourceTexture', texture);
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
