import {Constants, Material, Matrix, Mesh, Scene, ShaderMaterial, Texture, Vector4} from '@babylonjs/core';
import type {EffectNativeMatrix} from '../common/effect-native-space';
import {orderSceneModels} from '../../scene-model-order';
import {
  bindSceneEnvironmentIfPresent, SCENE_ENVIRONMENT_FRAGMENT_DECLARATION,
  SCENE_ENVIRONMENT_UNIFORMS, SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../../scene-environment';
import {EffectModelVertices} from './effect-model-vertices';

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
  constructor(scene: Scene, texture: Texture, state: EffectModelDeviceState,
    vertices: EffectModelVertices, indices: readonly number[]) {
    this.material = new ShaderMaterial('original-effect-model', scene, {
      vertexSource: `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
attribute vec3 position;
attribute vec2 uv;
${vertices.colors ? 'attribute vec4 color;' : 'uniform vec4 sourceAmbient;'}
${vertices.animated ? `attribute float sourceVertexId;
uniform sampler2D sourceFrames;
uniform vec2 sourceFrameSize;
uniform vec4 sourceFrameSample;
vec4 modelTexel(float index) {
  vec2 texel = vec2(mod(index, sourceFrameSize.x), floor(index / sourceFrameSize.x));
  return texelFetch(sourceFrames, ivec2(texel), 0);
}` : ''}
uniform mat4 worldViewProjection;
varying vec2 vUV;
varying vec4 vColor;
uniform mat4 world;
void main(){
${vertices.animated ? `  float first = (sourceFrameSample.x + sourceVertexId) * 2.0;
  float second = (sourceFrameSample.y + sourceVertexId) * 2.0;
  vec3 nativePosition = sourceFrameSample.w * modelTexel(first).xyz
    + sourceFrameSample.z * modelTexel(second).xyz;
  vec3 localPosition = vec3(-nativePosition.x, nativePosition.yz);
  vUV = sourceFrameSample.w * modelTexel(first + 1.0).xy
    + sourceFrameSample.z * modelTexel(second + 1.0).xy;` : '  vec3 localPosition = position; vUV = uv;'}
  vec4 worldPosition=world*vec4(localPosition,1.0);
  gl_Position=worldViewProjection*vec4(localPosition,1.0);
  vColor=clamp(${vertices.colors ? 'color' : 'sourceAmbient'},0.0,1.0);
  sceneFogFactor=sceneFog(worldPosition.xyz);
}`,
      fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D modelTexture;
void main(){
  vec4 color=texture2D(modelTexture,vUV)*vColor;
${state.alphaTest ? 'if(color.a<=100.0/255.0)discard;' : ''}
  if(sceneFogEnabled>0.5)color.rgb=mix(sceneFogColor,color.rgb,sceneFogFactor);
  gl_FragColor=color;
}`,
    }, {attributes: ['position', 'uv', ...(vertices.colors ? ['color'] : []),
      ...(vertices.animated ? ['sourceVertexId'] : [])],
      uniforms: ['world', 'worldViewProjection', 'sourceAmbient',
        ...(vertices.animated ? ['sourceFrameSize', 'sourceFrameSample'] : []), ...SCENE_ENVIRONMENT_UNIFORMS],
      samplers: ['modelTexture', ...(vertices.animated ? ['sourceFrames'] : [])], needAlphaBlending: state.blend});
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
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    vertices.geometry(indices).applyToMesh(this.mesh);
    if (vertices.animated) this.mesh.setVerticesData('sourceVertexId', vertices.vertexIds, false, 1);
    this.mesh.setBoundingInfo(vertices.bounds());
    for (const subMesh of this.mesh.subMeshes) subMesh.setBoundingInfo(vertices.bounds());
    vertices.bind(this.material);
    orderSceneModels(scene, [{mesh: this.mesh, priority: 0}]);
  }

  update(matrix: EffectNativeMatrix, ambient: readonly number[]): void {
    // R * nativeWorld * R maps the native local/world X reflection to Babylon.
    this.reflectedMatrix.set(matrix);
    for (const index of [1, 2, 3, 4, 8, 12]) this.reflectedMatrix[index] *= -1;
    Matrix.FromArrayToRef(this.reflectedMatrix, 0, this.matrix);
    this.mesh.freezeWorldMatrix(this.matrix);
    Vector4.FromArrayToRef(ambient, 0, this.ambient);
    this.material.setVector4('sourceAmbient', this.ambient);
  }

  dispose(): void {this.mesh.dispose(); this.material.dispose(false, false);}
}
