import {AssetContainer, Constants, PBRMaterial, ShaderMaterial} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';

const materialModels = ['obj05467', 'obj05442', 'obj05460', 'obj05469', 'obj05466',
  'obj05430', 'obj05425', 'obj05426', 'obj05427', 'obj05428', 'obj05422', 'obj05421',
  'obj05423', 'obj05424', 'obj05443', 'obj05433', 'obj05429', 'obj05468', 'obj05445',
  'obj05462', 'obj05461', 'obj05432', 'obj05434', 'obj05435', 'obj05436'] as const;
type SceneBreachMaterialModel = typeof materialModels[number];

export function sceneBreachMaterialModel(model: string): SceneBreachMaterialModel | undefined {
  return materialModels.find(value => value === model);
}

/** Original intact Breach texture × packed vertex diffuse, with named kind1 alpha. */
export class SceneBreachMaterial {
  private readonly replacements: {mesh: AssetContainer['meshes'][number];
    original: PBRMaterial; material: ShaderMaterial}[] = [];

  register(asset: AssetContainer, model: SceneBreachMaterialModel = 'obj05467'): void {
    const names = {obj05467: 'object08/0', obj05442: 'object04/0', obj05460: 'object10/0', obj05469: 'cylinder02/0', obj05466: 'object04/0', obj05430: 'anangua04/0', obj05425: 'object03/0', obj05426: 'object03/0', obj05427: 'object04/0', obj05428: 'object01/0', obj05422: 'cone78/0', obj05421: 'object568041500/0', obj05423: 'cone78/0', obj05424: 'box01/0', obj05443: 'object568041500/0', obj05433: 'object02/0', obj05429: 'object01/0', obj05468: 'object02/0', obj05445: 'line02/0', obj05462: 'cylinder257/0', obj05461: 'cylinder744/0', obj05432: 'object02/0', obj05434: 'plane02/0', obj05435: 'plane02/0', obj05436: 'plane02/0'};
    const prefixes = {obj05467: 'breach21-intact', obj05442: 'breach18-intact', obj05460: 'breach20-intact', obj05469: 'breach22-intact', obj05466: 'breach04-intact', obj05430: 'breach11-intact', obj05425: 'breach02-intact', obj05426: 'breach02-05426-intact', obj05427: 'breach02-05427-intact', obj05428: 'breach02-05428-intact', obj05422: 'breach02-05422-intact', obj05421: 'breach06-05421-intact', obj05423: 'breach06-05423-intact', obj05424: 'breach18-05424-intact', obj05443: 'breach06-05443-intact', obj05433: 'breach06-05433-intact', obj05429: 'breach10-05429-intact', obj05468: 'breach07-21-05468-intact', obj05445: 'breach07-05445-intact', obj05462: 'breach07-05462-intact', obj05461: 'breach20-05461-intact', obj05432: 'breach05-06-05432-intact', obj05434: 'breach20-05434-intact', obj05435: 'breach20-05435-intact', obj05436: 'breach20-05436-intact'};
    const transparent = model === 'obj05434' || model === 'obj05435' || model === 'obj05436';
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
void main() {
  vec4 result = texture2D(sourceTexture, sourceUv) * sourceDiffuse;
#ifdef SOURCE_ALPHA_TEST
  if (result.a <= 100.0 / 255.0) discard;
#endif
  gl_FragColor = result;
}`,
    }, {attributes: ['position', 'uv', 'color'], uniforms: ['world', 'viewProjection'],
      samplers: ['sourceTexture'], defines: transparent ? ['SOURCE_ALPHA_TEST'] : [],
      needAlphaBlending: transparent, needAlphaTesting: transparent});
    texture.wrapU = texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
    material.setTexture('sourceTexture', texture);
    material.transparencyMode = transparent ? ShaderMaterial.MATERIAL_ALPHATESTANDBLEND : ShaderMaterial.MATERIAL_OPAQUE;
    material.alphaMode = transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
    material.depthFunction = Constants.LESS;
    material.forceDepthWrite = true;
    material.backFaceCulling = original.backFaceCulling;
    material.metadata = {sourceBreachModel: model, sourceBreachShader: transparent ? 'geom_t_c1.gbf' : 'geom_c1.gbf',
      sourceBreachKind: transparent ? 1 : 0};
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
