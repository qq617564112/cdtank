import {Constants, Material, Mesh, Scene, ShaderMaterial, Texture, VertexBuffer, VertexData} from '@babylonjs/core';
import {expandEffectQuad} from './effect-quad';
import {unpackEffectColor} from './effect-color';
import type {EffectVec3} from './types';
import {effectStripTriangleIndices, EffectStripVertex} from './effect-quad';

export interface EffectQuadData {
  corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3];
  uv: readonly [number, number, number, number];
  packedColor: number;
}

export interface EffectRenderPass {
  states: readonly {name: string; value: string}[];
}

/** Renderer for resolved world-space GBF passes; native XYZ inputs. */
export class EffectSpriteMesh {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private disposed = false;
  private vertexCount = 0;
  private indexCount = 0;

  constructor(scene: Scene, pass: EffectRenderPass, texture: Texture) {
    const states = new Map(pass.states.map(s => [s.name, s.value]));
    // Unresolved defaults are not silently replaced with Babylon defaults.
    for (const [name, expected] of Object.entries({FVF: 'XYZ|DIFFUSE|TEX1',
      Lighting: 'FALSE', AlphaTestEnable: 'FALSE',
      AlphaBlendEnable: 'TRUE', SrcBlend: 'SRCALPHA', ZWriteEnable: 'FALSE',
      'ColorOp[0]': 'MODULATE', 'ColorArg1[0]': 'TEXTURE', 'ColorArg2[0]': 'DIFFUSE',
      'AlphaOp[0]': 'MODULATE', 'AlphaArg1[0]': 'TEXTURE', 'AlphaArg2[0]': 'DIFFUSE',
      'AddressU[0]': 'WRAP', 'AddressV[0]': 'WRAP'})) {
      if (states.get(name) !== expected) throw new Error(`Unresolved/unsupported effect state ${name}`);
    }
    const additive = states.get('DestBlend') === 'ONE';
    if (!additive && states.get('DestBlend') !== 'INVSRCALPHA') throw new Error('Unsupported effect blend');
    if (!['TRUE', 'FALSE'].includes(states.get('ZEnable') ?? '')) throw new Error('Unresolved depth test');
    const filter = states.get('MinFilter[0]');
    if (!['POINT', 'LINEAR'].includes(filter ?? '') || states.get('MagFilter[0]') !== filter) {
      throw new Error('Unsupported effect filtering');
    }
    const cull = states.get('CullMode');
    if (!['NONE', 'CW', 'CCW'].includes(cull ?? '')) throw new Error('Unresolved effect culling');
    texture.updateSamplingMode(filter === 'POINT' ? Texture.NEAREST_SAMPLINGMODE : Texture.BILINEAR_SAMPLINGMODE);
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    this.material = new ShaderMaterial('original-effect', scene, {
      vertexSource: 'precision highp float; attribute vec3 position; attribute vec2 uv; attribute vec4 color; uniform mat4 worldViewProjection; varying vec2 vUV; varying vec4 vColor; void main(){gl_Position=worldViewProjection*vec4(position,1.0);vUV=uv;vColor=color;}',
      fragmentSource: 'precision highp float; varying vec2 vUV; varying vec4 vColor; uniform sampler2D effectTexture; void main(){gl_FragColor=texture2D(effectTexture,vUV)*vColor;}',
    }, {attributes: ['position', 'uv', 'color'], uniforms: ['worldViewProjection'],
      samplers: ['effectTexture'], needAlphaBlending: true});
    this.material.setTexture('effectTexture', texture);
    this.material.backFaceCulling = cull !== 'NONE';
    this.material.sideOrientation = cull === 'CW' ? Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
    this.material.disableDepthWrite = true;
    this.material.depthFunction = states.get('ZEnable') === 'TRUE' ? Constants.LEQUAL : Constants.ALWAYS;
    // RGB factors match the GBF. Separate-alpha device state is still unrecovered;
    // Babylon's alpha-channel accumulation is retained pending source evidence.
    this.material.alphaMode = additive ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
    this.mesh = new Mesh('original-effect-quad', scene);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
  }

  update(corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3],
    uv: readonly [number, number, number, number], packedColor: number): void {
    this.updateQuads([{corners, uv, packedColor}]);
  }

  /** Keep particle/history order in one draw using the original quad diagonal. */
  updateQuads(quads: readonly EffectQuadData[]): void {
    if (this.disposed) return;
    this.mesh.setEnabled(quads.length > 0);
    if (quads.length === 0) return;
    const vertices = quads.flatMap(quad => expandEffectQuad(quad.corners, quad.uv, quad.packedColor, false));
    const data = new VertexData();
    data.positions = vertices.flatMap(v => [-v.position[0], v.position[1], v.position[2]]);
    data.uvs = vertices.flatMap(v => v.uv);
    data.colors = vertices.flatMap(v => unpackEffectColor(v.color));
    data.indices = vertices.map((_, index) => index);
    this.applyVertices(data, vertices.length);
  }

  updateTriangleStrip(vertices: readonly EffectStripVertex[]): void {
    if (this.disposed) return;
    this.mesh.setEnabled(vertices.length >= 3);
    if (vertices.length < 3) return;
    const data = new VertexData();
    data.positions = vertices.flatMap(vertex => [-vertex.position[0], vertex.position[1], vertex.position[2]]);
    data.uvs = vertices.flatMap(vertex => vertex.uv);
    data.colors = vertices.flatMap(vertex => unpackEffectColor(vertex.color));
    data.indices = effectStripTriangleIndices(vertices.length);
    this.applyVertices(data, vertices.length);
  }

  private applyVertices(data: VertexData, vertexCount: number): void {
    if (vertexCount !== this.vertexCount || data.indices!.length !== this.indexCount || !this.mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) {
      data.applyToMesh(this.mesh, true);
      this.vertexCount = vertexCount;
      this.indexCount = data.indices!.length;
    } else {
      this.mesh.updateVerticesData(VertexBuffer.PositionKind, data.positions!, true);
      this.mesh.updateVerticesData(VertexBuffer.UVKind, data.uvs!);
      this.mesh.updateVerticesData(VertexBuffer.ColorKind, data.colors!);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.material.dispose(false, false); // caller owns the texture
  }
}
