import {AssetContainer, Constants, PBRMaterial, ShaderMaterial} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';

/** Original intact Breach geom_c1: opaque texture × packed vertex diffuse. */
export class SceneBreachMaterial {
  private readonly replacements: {mesh: AssetContainer['meshes'][number];
    original: PBRMaterial; material: ShaderMaterial}[] = [];

  register(asset: AssetContainer, model: 'obj05467' | 'obj05442' | 'obj05460' | 'obj05469' | 'obj05430' | 'obj05425' | 'obj05426' | 'obj05427' | 'obj05428' | 'obj05422' | 'obj05423' | 'obj05423' = 'obj05467'): void {
    const names = {obj05467: 'object08/0', obj05442: 'object04/0', obj05460: 'object10/0', obj05469: 'cylinder02/0', obj05430: 'anangua04/0', obj05425: 'object03/0', obj05426: 'object03/0', obj05427: 'object04/0', obj05428: 'object01/0', obj05422: 'cone78/0', obj05423: 'cone78/0', obj05423: 'cone78/0'};
    const prefixes = {obj05467: 'breach21-intact', obj05442: 'breach18-intact', obj05460: 'breach20-intact', obj05469: 'breach22-intact', obj05430: 'breach11-intact', obj05425: 'breach02-intact', obj05426: 'breach02-05426-intact', obj05427: 'breach02-05427-intact', obj05428: 'breach02-05428-intact', obj05422: 'breach02-05422-intact', obj05423: 'breach06-05423-intact', obj05423: 'breach06-05423-intact'};
    const meshName = names[model];
    const mesh = asset.meshes.find(value => value.name === meshName);
    if (!mesh || !(mesh.material instanceof PBRMaterial) || !mesh.material.albedoTexture) {
      throw new Error(`原 Breach ${model} 模型或纹理缺失`);
    }
    const original = mesh.material;
    const texture = original.albedoTexture!;
    const material = new ShaderMaterial(`${prefixes[model]}/${meshName}`, asset.scene, {
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
    material.alphaMode = Constants.ALPHA_DISABLE;
    material.depthFunction = Constants.LESS;
    material.forceDepthWrite = true;
    material.backFaceCulling = original.backFaceCulling;
    material.metadata = {sourceBreachModel: model, sourceBreachShader: 'geom_c1.gbf',
      sourceBreachKind: 0};
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
