import {Constants, Material, Mesh, Scene, ShaderMaterial, Texture, VertexData} from '@babylonjs/core';
import {EffectNativeMatrix, transformEffectPosition} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';

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
      vertexSource: 'precision highp float; attribute vec3 position; attribute vec2 uv; attribute vec4 color; uniform mat4 worldViewProjection; varying vec2 vUV; varying vec4 vColor; void main(){gl_Position=worldViewProjection*vec4(position,1.0);vUV=uv;vColor=clamp(color,0.0,1.0);}',
      fragmentSource: `precision highp float; varying vec2 vUV; varying vec4 vColor; uniform sampler2D modelTexture; void main(){vec4 color=texture2D(modelTexture,vUV)*vColor;${state.alphaTest ? 'if(color.a<=100.0/255.0)discard;' : ''}gl_FragColor=color;}`,
    }, {attributes: ['position', 'uv', 'color'], uniforms: ['worldViewProjection'],
      samplers: ['modelTexture'], needAlphaBlending: state.blend});
    this.material.setTexture('modelTexture', texture);
    this.material.backFaceCulling = state.cull !== 'NONE';
    // GBF names the culled winding; Babylon names the retained front face.
    this.material.sideOrientation = state.cull === 'CCW' ? Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
    this.material.disableDepthWrite = !state.depthWrite;
    this.material.depthFunction = state.depthTest ? Constants.LESS : Constants.ALWAYS;
    this.material.transparencyMode = state.blend ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
    this.material.alphaMode = state.blend ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
    this.mesh = new Mesh('original-effect-model', scene);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    scene.setRenderingAutoClearDepthStencil(1, false);
    this.mesh.renderingGroupId = 1;
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
