import {Constants, Material, Matrix, Mesh, Scene, ShaderMaterial, ShadowDepthWrapper, Texture, Vector4} from '@babylonjs/core';
import '@babylonjs/core/Shaders/shadowMap.vertex';
import '@babylonjs/core/Shaders/shadowMap.fragment';
import '@babylonjs/core/Shaders/ShadersInclude/shadowMapFragmentSoftTransparentShadow';
import type {EffectNativeMatrix} from '../common/effect-native-space';
import {orderSceneModels} from '../../scene-model-order';
import {
  bindSceneEnvironmentIfPresent, SCENE_ENVIRONMENT_FRAGMENT_DECLARATION,
  SCENE_ENVIRONMENT_UNIFORMS, SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../../scene-environment';
import {EffectModelVertices} from './effect-model-vertices';
import {bindSceneShadowMaterial, sceneShadowLight, SCENE_SHADOW_VERTEX_DECLARATION,
  SCENE_SHADOW_FRAGMENT_DECLARATION, SCENE_SHADOW_FRAGMENT_BEGIN,
  SCENE_SHADOW_FRAGMENT_APPLY} from '../../scene-shadow-light';

export interface EffectModelDeviceState {
  cull: 'CW' | 'CCW' | 'NONE';
  depthWrite: boolean;
  depthTest: boolean;
  blend: boolean;
  alphaTest: boolean;
}

/** Native model XYZ/UV submissions with explicitly resolved GBF device state. */
export class EffectModelMesh {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private readonly matrix = Matrix.Identity();
  private readonly reflectedMatrix = new Float32Array(16);
  private readonly ambient = new Vector4();
  private readonly shadowMaterial?: ShaderMaterial;
  constructor(scene: Scene, texture: Texture, state: EffectModelDeviceState,
    vertices: EffectModelVertices, indices: readonly number[]) {
    const sceneShadows = Boolean(sceneShadowLight(scene));
    const vertexSource = `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
${sceneShadows ? SCENE_SHADOW_VERTEX_DECLARATION : ''}
attribute vec3 position;
attribute vec2 uv;
${vertices.colors ? 'attribute vec4 color;' : 'uniform vec4 sourceAmbient;'}
${vertices.animated ? 'uniform vec4 sourceFrameSample;' : ''}
${vertices.usesFrameTexture ? `attribute float sourceVertexId;
uniform sampler2D sourceFrames;
uniform sampler2D sourceFrameV;
uniform vec2 sourceFrameSize;
ivec2 modelCoordinate(float index) {
  vec2 texel = vec2(mod(index, sourceFrameSize.x), floor(index / sourceFrameSize.x));
  return ivec2(texel);
}` : ''}
uniform mat4 worldViewProjection;
varying vec2 vUV;
varying vec4 vColor;
uniform mat4 world;
void main(){
${vertices.usesFrameTexture ? `  ivec2 first = modelCoordinate(sourceFrameSample.x + sourceVertexId);
  ivec2 second = modelCoordinate(sourceFrameSample.y + sourceVertexId);
  vec4 firstVertex = texelFetch(sourceFrames, first, 0);
  vec4 secondVertex = texelFetch(sourceFrames, second, 0);
  vec3 nativePosition = sourceFrameSample.w * firstVertex.xyz
    + sourceFrameSample.z * secondVertex.xyz;
  vec3 localPosition = vec3(-nativePosition.x, nativePosition.yz);
  vUV = sourceFrameSample.w * vec2(firstVertex.w, texelFetch(sourceFrameV, first, 0).r)
    + sourceFrameSample.z * vec2(secondVertex.w, texelFetch(sourceFrameV, second, 0).r);` : vertices.animated ? `  vec3 nativeVertex = vec3(-position.x, position.yz);
  vec3 nativePosition = sourceFrameSample.w * nativeVertex + sourceFrameSample.z * nativeVertex;
  vec3 localPosition = vec3(-nativePosition.x, nativePosition.yz);
  vUV = sourceFrameSample.w * uv + sourceFrameSample.z * uv;` : '  vec3 localPosition = position; vUV = uv;'}
  vec4 worldPosition=world*vec4(localPosition,1.0);
${sceneShadows ? '  sceneShadowWorldPosition=worldPosition.xyz; sceneShadowWorldNormal=vec3(0.0);' : ''}
  gl_Position=worldViewProjection*vec4(localPosition,1.0);
  vColor=clamp(${vertices.colors ? 'color' : 'sourceAmbient'},0.0,1.0);
  sceneFogFactor=sceneFog(worldPosition.xyz);
}`;
    const attributes = ['position', 'uv', ...(vertices.colors ? ['color'] : []),
      ...(vertices.usesFrameTexture ? ['sourceVertexId'] : [])];
    const uniforms = ['world', 'worldViewProjection', 'sourceAmbient',
      ...(vertices.animated ? ['sourceFrameSample'] : []),
      ...(vertices.usesFrameTexture ? ['sourceFrameSize'] : []), ...SCENE_ENVIRONMENT_UNIFORMS];
    const samplers = ['modelTexture', ...(vertices.usesFrameTexture ? ['sourceFrames', 'sourceFrameV'] : [])];
    this.material = new ShaderMaterial('original-effect-model', scene, {vertexSource,
      fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
${sceneShadows ? SCENE_SHADOW_FRAGMENT_DECLARATION : ''}
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D modelTexture;
void main(){
${sceneShadows ? SCENE_SHADOW_FRAGMENT_BEGIN : ''}
  vec4 color=texture2D(modelTexture,vUV)*vColor;
${state.alphaTest ? 'if(color.a<=100.0/255.0)discard;' : ''}
  gl_FragColor=color;
${sceneShadows ? SCENE_SHADOW_FRAGMENT_APPLY : ''}
  if(sceneFogEnabled>0.5)gl_FragColor.rgb=mix(sceneFogColor,gl_FragColor.rgb,sceneFogFactor);
}`,
    }, {attributes, uniforms: [...uniforms, ...(sceneShadows ? ['sceneShadowReceiver'] : [])],
      samplers: [...samplers, ...(sceneShadows ? ['sceneShadowTexture'] : [])], needAlphaBlending: state.blend});
    this.material.setTexture('modelTexture', texture);
    this.material.backFaceCulling = state.cull !== 'NONE';
    // GBF names the culled winding; Babylon names the retained front face.
    this.material.sideOrientation = state.cull === 'CCW' ? Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
    this.material.disableDepthWrite = !state.depthWrite;
    this.material.forceDepthWrite = state.depthWrite;
    this.material.depthFunction = state.depthTest ? Constants.LESS : Constants.ALWAYS;
    this.material.transparencyMode = state.blend ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
    this.material.alphaMode = state.blend ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
    this.mesh = new Mesh('original-effect-model', scene);
    bindSceneEnvironmentIfPresent(this.material, scene);
    if (sceneShadows) {
      bindSceneShadowMaterial(this.material, texture);
      // Keep the dedicated depth effect separate from colour-pass submeshes.
      this.shadowMaterial = new ShaderMaterial('scene-model-shadow-depth', scene, {vertexSource,
        fragmentSource: `precision highp float;
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D modelTexture;
void main(){
  vec4 colour=texture2D(modelTexture,vUV)*vColor;
${state.alphaTest ? '  if(colour.a<=100.0/255.0)discard;' : ''}
#define SHADOWDEPTH_SOFTTRANSPARENTSHADOW
  gl_FragColor=colour;
}`}, {attributes, uniforms: [...uniforms], samplers: [...samplers]}, false);
      this.shadowMaterial.setTexture('modelTexture', texture);
      bindSceneEnvironmentIfPresent(this.shadowMaterial, scene);
      vertices.bind(this.shadowMaterial);
      this.material.shadowDepthWrapper = new ShadowDepthWrapper(this.shadowMaterial, scene,
        {standalone: true, remappedVariables: ['worldPos', 'worldPosition', 'alpha', 'colour.a']});
    }
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    vertices.apply(this.mesh, indices);
    this.mesh.setBoundingInfo(vertices.bounds());
    for (const subMesh of this.mesh.subMeshes) subMesh.setBoundingInfo(vertices.bounds());
    vertices.bind(this.material);
    orderSceneModels(scene, [{mesh: this.mesh, priority: 0}]);
  }

  update(matrix: EffectNativeMatrix, ambient: readonly number[]): void {
    // R * nativeWorld * R maps the native local/world X reflection to Babylon.
    this.reflectedMatrix.set(matrix);
    this.reflectedMatrix[1] *= -1;
    this.reflectedMatrix[2] *= -1;
    this.reflectedMatrix[3] *= -1;
    this.reflectedMatrix[4] *= -1;
    this.reflectedMatrix[8] *= -1;
    this.reflectedMatrix[12] *= -1;
    Matrix.FromArrayToRef(this.reflectedMatrix, 0, this.matrix);
    this.mesh.freezeWorldMatrix(this.matrix);
    Vector4.FromArrayToRef(ambient, 0, this.ambient);
    this.material.setVector4('sourceAmbient', this.ambient);
    this.shadowMaterial?.setVector4('sourceAmbient', this.ambient);
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.shadowDepthWrapper?.dispose();
    this.shadowMaterial?.dispose(false, false);
    this.material.dispose(false, false);
  }
}
