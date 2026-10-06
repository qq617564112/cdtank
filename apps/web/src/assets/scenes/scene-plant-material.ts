import {BaseTexture, Constants, Scene, ShaderMaterial, Vector4} from '@babylonjs/core';
import {mv3Ambient} from '../../render/materials/mv3-material';

/** plant80 ambient modulation; sway stays in the owned CPU vertex producer. */
export function createScenePlantMaterial(scene: Scene, properties: readonly number[],
  texture: BaseTexture): ShaderMaterial {
  const material = new ShaderMaterial('source-plant-material', scene, {
    vertexSource: `precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 sourceUv;
void main() {
  sourceUv = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`,
    fragmentSource: `precision highp float;
uniform sampler2D sourceTexture;
uniform vec4 sourceAmbient;
varying vec2 sourceUv;
void main() {
  vec4 result = texture2D(sourceTexture, sourceUv) * clamp(sourceAmbient, 0.0, 1.0);
  if (result.a <= 50.0 / 255.0) discard;
  gl_FragColor = result;
}`,
  }, {attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'sourceAmbient'],
    samplers: ['sourceTexture'], needAlphaBlending: true, needAlphaTesting: true});
  const updateAmbient = (): void => {
    const ambient = scene.ambientColor.equalsFloats(0, 0, 0)
      ? [0.2, 0.2, 0.2] : scene.ambientColor.asArray();
    material.setVector4('sourceAmbient', Vector4.FromArray(mv3Ambient(properties, 1, ambient)));
  };
  updateAmbient();
  material.onBindObservable.add(updateAmbient);
  texture.wrapU = texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
  material.setTexture('sourceTexture', texture);
  material.alphaMode = Constants.ALPHA_COMBINE;
  material.depthFunction = Constants.LESS;
  material.forceDepthWrite = true;
  material.backFaceCulling = false;
  material.metadata = {sourcePlantShader: 'Data/gfxscript/plant80.gbf',
    sourceAlphaRef: 50, sourceProperties: [...properties],
    scope: 'Original ambient formula; scene ambient is the current formal graphics provider.'};
  return material;
}
