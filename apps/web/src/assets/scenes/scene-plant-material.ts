import {BaseTexture, Constants, Scene, ShaderMaterial, Vector4} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';
import {mv3Ambient} from '../../render/materials/mv3-material';
import {
  bindSceneEnvironmentIfPresent, SCENE_ENVIRONMENT_FRAGMENT_APPLY,
  SCENE_ENVIRONMENT_FRAGMENT_DECLARATION, SCENE_ENVIRONMENT_UNIFORMS,
  SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../../render/scene-environment';

/** plant80 ambient modulation and local-X sway on shared source geometry. */
export function createScenePlantMaterial(scene: Scene, properties: readonly number[],
  texture: BaseTexture): ShaderMaterial {
  const material = new ShaderMaterial('source-plant-material', scene, {
    vertexSource: `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
attribute vec3 position;
attribute vec2 uv;
uniform mat4 viewProjection;
#include<instancesDeclaration>
#ifdef INSTANCES
attribute vec2 plantSway;
#else
uniform vec2 plantSwayFallback;
#endif
uniform SourcePlantClock {
  vec4 sourcePlantClock;
};
uniform vec4 sourceAmbient;
varying vec2 sourceUv;
void main() {
  sourceUv = uv;
#include<instancesVertex>
#ifdef INSTANCES
  vec2 sway = plantSway;
#else
  vec2 sway = plantSwayFallback;
#endif
  float phase = mod(sway.x + sourcePlantClock.x * 2.0, 6.28318);
  float parameter = cos(phase) / sway.y * 0.15;
  vec3 displaced = position;
  displaced.x += (parameter * position.y) * position.y;
  vec4 worldPosition = finalWorld * vec4(displaced, 1.0);
  // plant80 is ambient modulation; keep the source ambient term and only add
  // the scene fog register.
  sceneLitColor = vec3(1.0);
  sceneFogFactor = sceneFog(worldPosition.xyz);
  gl_Position = viewProjection * worldPosition;
}`,
    fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
uniform sampler2D sourceTexture;
uniform vec4 sourceAmbient;
varying vec2 sourceUv;
void main() {
  vec4 result = texture2D(sourceTexture, sourceUv) * clamp(sourceAmbient, 0.0, 1.0);
  if (result.a <= 50.0 / 255.0) discard;
  gl_FragColor = result;
${SCENE_ENVIRONMENT_FRAGMENT_APPLY}
}`,
  }, {attributes: ['position', 'uv', 'plantSway'],
    uniforms: ['world', 'viewProjection', 'plantSwayFallback', 'sourceAmbient', ...SCENE_ENVIRONMENT_UNIFORMS],
    samplers: ['sourceTexture'], needAlphaBlending: true, needAlphaTesting: true});
  bindSceneEnvironmentIfPresent(material, scene);
  const color = new Vector4();
  let red = NaN, green = NaN, blue = NaN;
  const updateAmbient = (): void => {
    const current = scene.ambientColor;
    if (red === current.r && green === current.g && blue === current.b) return;
    red = current.r; green = current.g; blue = current.b;
    const ambient = scene.ambientColor.equalsFloats(0, 0, 0)
      ? [0.2, 0.2, 0.2] : scene.ambientColor.asArray();
    Vector4.FromArrayToRef(mv3Ambient(properties, 1, ambient), 0, color);
    material.setVector4('sourceAmbient', color);
    material.getEffect()?.setVector4('sourceAmbient', color);
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
