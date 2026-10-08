import {Constants, Material, Mesh, Scene, ShaderMaterial, Texture, VertexData} from '@babylonjs/core';
import {EffectNativeMatrix, transformEffectPosition} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';
import {orderSceneModels} from '../../scene-model-order';
import {
  bindSceneEnvironmentIfPresent, SCENE_ENVIRONMENT_FRAGMENT_DECLARATION,
  SCENE_ENVIRONMENT_UNIFORMS, SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../../scene-environment';

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
  constructor(scene: Scene, texture: Texture, state: EffectModelDeviceState) {
    this.material = new ShaderMaterial('original-effect-model', scene, {
      vertexSource: `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
attribute vec3 position; attribute vec2 uv; attribute vec4 color;
uniform mat4 worldViewProjection; varying vec2 vUV; varying vec4 vColor;
uniform mat4 world;
void main(){
  vec4 worldPosition=world*vec4(position,1.0);
  gl_Position=worldViewProjection*worldPosition;
  vUV=uv;vColor=clamp(color,0.0,1.0);
  sceneFogFactor=sceneFog(worldPosition.xyz);
}`,
      fragmentSource: `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
varying vec2 vUV; varying vec4 vColor; uniform sampler2D modelTexture;
void main(){
  vec4 color=texture2D(modelTexture,vUV)*vColor;
${state.alphaTest ? 'if(color.a<=100.0/255.0)discard;' : ''}
  if(sceneFogEnabled>0.5)color.rgb=mix(sceneFogColor,color.rgb,sceneFogFactor);
  gl_FragColor=color;
}`,
    }, {attributes: ['position', 'uv', 'color'],
      uniforms: ['world', 'worldViewProjection', ...SCENE_ENVIRONMENT_UNIFORMS],
      samplers: ['modelTexture'], needAlphaBlending: state.blend});
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
    orderSceneModels(scene, [{mesh: this.mesh, priority: 0}]);
  }

  update(vertices: readonly number[][], indices: readonly number[], matrix: EffectNativeMatrix,
    ambient: readonly number[], colors?: readonly number[][]): void {
    const data = new VertexData();
    data.positions = vertices.flatMap(vertex => {
      const position = transformEffectPosition(matrix, vertex.slice(0, 3) as EffectVec3);
      return [-position[0], position[1], position[2]];
    });
    data.uvs = vertices.flatMap(vertex => vertex.slice(6, 8));
    data.colors = vertices.flatMap((_, index) => [...(colors?.[index] ?? ambient)]);
    data.indices = [...indices];
    data.applyToMesh(this.mesh, true);
  }

  dispose(): void {this.mesh.dispose(); this.material.dispose(false, false);}
}
