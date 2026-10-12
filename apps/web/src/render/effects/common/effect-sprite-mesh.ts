import {BoundingInfo, Constants, Material, Mesh, Scene, ShaderMaterial, Texture, Vector3, VertexBuffer, VertexData} from '@babylonjs/core';
import type {EffectVec3} from './types';
import type {EffectStripVertex} from './effect-quad';
import {setDynamicMeshIndexCount} from '../../webgpu-draw-cache';

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
  private capacity = 0;
  private count = 0;
  private topology?: 'quads' | 'strip';
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private colors = new Float32Array(0);
  private shapes = new Float32Array(0);
  private readonly minimum = new Vector3();
  private readonly maximum = new Vector3();
  private readonly bounds = new BoundingInfo(Vector3.Zero(), Vector3.Zero());

  constructor(scene: Scene, pass: EffectRenderPass, texture: Texture, private readonly billboard = false) {
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
      vertexSource: `precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
${billboard ? `attribute vec2 billboardCorner;
attribute vec2 particleShape;
uniform mat4 worldView;
uniform mat4 projection;` : 'uniform mat4 worldViewProjection;'}
varying vec2 vUV;
varying vec4 vColor;
void main(){
${billboard ? `  vec4 viewPosition = worldView * vec4(position, 1.0);
  float cosine = cos(particleShape.y), sine = sin(particleShape.y);
  vec2 corner = billboardCorner * particleShape.x;
  viewPosition.xy += vec2(-corner.x * cosine + corner.y * sine,
    corner.x * sine + corner.y * cosine);
  gl_Position = projection * viewPosition;` : '  gl_Position=worldViewProjection*vec4(position,1.0);'}
  vUV=uv;vColor=color;
}`,
      fragmentSource: `precision highp float;
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D effectTexture;
void main(){
  vec4 texel=texture2D(effectTexture,vUV);
  if(vColor.a==0.0)discard;
  if(texel.a==0.0)discard;
  gl_FragColor=texel*vColor;
}`,
    }, {attributes: ['position', 'uv', 'color', ...(billboard ? ['billboardCorner', 'particleShape'] : [])],
      uniforms: billboard ? ['worldView', 'projection'] : ['worldViewProjection'],
      samplers: ['effectTexture'], needAlphaBlending: true});
    this.material.setTexture('effectTexture', texture);
    this.material.backFaceCulling = cull !== 'NONE';
    // GBF names the culled winding; Babylon names the retained front face.
    this.material.sideOrientation = cull === 'CCW' ? Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
    this.material.disableDepthWrite = true;
    this.material.depthFunction = states.get('ZEnable') === 'TRUE' ? Constants.LEQUAL : Constants.ALWAYS;
    this.material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    // RGB factors match the GBF. Separate-alpha device state is still unrecovered;
    // Babylon's alpha-channel accumulation is retained pending source evidence.
    this.material.alphaMode = additive ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
    this.mesh = new Mesh('original-effect-quad', scene);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    // Scene surfaces finish first; source depth testing still occludes world effects.
    scene.setRenderingAutoClearDepthStencil(1, false);
    this.mesh.renderingGroupId = 1;
  }

  update(corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3],
    uv: readonly [number, number, number, number], packedColor: number): void {
    this.updateQuads([{corners, uv, packedColor}]);
  }

  /** Keep particle/history order in one draw using the original quad diagonal. */
  updateQuads(quads: readonly EffectQuadData[]): void {
    if (this.disposed) return;
    this.begin();
    this.reserve(quads.length * 4, 'quads');
    for (const quad of quads) {
      for (let corner = 0; corner < 4; corner++) {
        const position = quad.corners[corner];
        this.vertex(-Math.fround(position[0]), Math.fround(position[1]), Math.fround(position[2]),
          quad.uv[corner === 1 || corner === 2 ? 2 : 0], quad.uv[corner >= 2 ? 3 : 1], quad.packedColor);
      }
    }
    this.end(quads.length * 6);
  }

  updateTriangleStrip(vertices: readonly EffectStripVertex[]): void {
    if (this.disposed) return;
    this.begin();
    this.reserve(vertices.length, 'strip');
    for (const vertex of vertices) {
      this.vertex(-vertex.position[0], vertex.position[1], vertex.position[2], vertex.uv[0], vertex.uv[1], vertex.color);
    }
    this.end(Math.max(0, vertices.length - 2) * 3);
  }

  beginBillboards(): void {this.begin();}

  billboardQuad(position: EffectVec3, size: number, angle: number,
    uv: readonly [number, number, number, number], color: number): void {
    this.reserve(this.count + 4, 'quads');
    for (let corner = 0; corner < 4; corner++) {
      const index = this.count;
      this.vertex(-position[0], position[1], position[2],
        uv[corner === 1 || corner === 2 ? 0 : 2], uv[corner >= 2 ? 3 : 1], color);
      this.shapes[index * 2] = size;
      this.shapes[index * 2 + 1] = Math.fround(angle) * Math.fround(0.01745329238474369);
    }
    const radius = Math.abs(size) * Math.SQRT2;
    this.include(-position[0] - radius, position[1] - radius, position[2] - radius);
    this.include(-position[0] + radius, position[1] + radius, position[2] + radius);
  }

  endBillboards(): void {this.end(this.count / 4 * 6);}

  private begin(): void {
    this.count = 0;
    this.minimum.set(Infinity, Infinity, Infinity);
    this.maximum.set(-Infinity, -Infinity, -Infinity);
  }

  private include(x: number, y: number, z: number): void {
    this.minimum.x = Math.min(this.minimum.x, x); this.maximum.x = Math.max(this.maximum.x, x);
    this.minimum.y = Math.min(this.minimum.y, y); this.maximum.y = Math.max(this.maximum.y, y);
    this.minimum.z = Math.min(this.minimum.z, z); this.maximum.z = Math.max(this.maximum.z, z);
  }

  private vertex(x: number, y: number, z: number, u: number, v: number, color: number): void {
    const index = this.count++;
    this.positions[index * 3] = x; this.positions[index * 3 + 1] = y; this.positions[index * 3 + 2] = z;
    this.uvs[index * 2] = u; this.uvs[index * 2 + 1] = v;
    this.colors[index * 4] = ((color >>> 16) & 255) / 255;
    this.colors[index * 4 + 1] = ((color >>> 8) & 255) / 255;
    this.colors[index * 4 + 2] = (color & 255) / 255;
    this.colors[index * 4 + 3] = (color >>> 24) / 255;
    this.include(x, y, z);
  }

  private end(indexCount: number): void {
    this.mesh.setEnabled(indexCount > 0);
    if (!indexCount) return;
    const geometry = this.mesh.geometry!;
    geometry.updateVerticesDataDirectly(VertexBuffer.PositionKind, this.positions.subarray(0, this.count * 3), 0);
    geometry.updateVerticesDataDirectly(VertexBuffer.UVKind, this.uvs.subarray(0, this.count * 2), 0);
    geometry.updateVerticesDataDirectly(VertexBuffer.ColorKind, this.colors.subarray(0, this.count * 4), 0);
    if (this.billboard) geometry.updateVerticesDataDirectly('particleShape', this.shapes.subarray(0, this.count * 2), 0);
    this.bounds.reConstruct(this.minimum, this.maximum, this.mesh.getWorldMatrix());
    this.mesh.setBoundingInfo(this.bounds);
    setDynamicMeshIndexCount(this.mesh, indexCount);
  }

  private reserve(required: number, topology: 'quads' | 'strip'): void {
    if (!required || (required <= this.capacity && topology === this.topology)) return;
    let capacity = Math.max(16, this.capacity);
    while (capacity < required) capacity *= 2;
    const positions = new Float32Array(capacity * 3), uvs = new Float32Array(capacity * 2);
    const colors = new Float32Array(capacity * 4), shapes = new Float32Array(capacity * 2);
    positions.set(this.positions); uvs.set(this.uvs); colors.set(this.colors); shapes.set(this.shapes);
    this.positions = positions; this.uvs = uvs; this.colors = colors; this.shapes = shapes;
    this.capacity = capacity; this.topology = topology;
    const indices = new Uint32Array(topology === 'quads' ? capacity / 4 * 6 : (capacity - 2) * 3);
    if (topology === 'quads') {
      for (let vertex = 0; vertex < capacity; vertex += 4) {
        indices.set([vertex, vertex + 1, vertex + 3, vertex + 3, vertex + 1, vertex + 2], vertex / 4 * 6);
      }
    } else {
      for (let vertex = 2; vertex < capacity; vertex++) {
        indices.set(vertex % 2 ? [vertex - 1, vertex - 2, vertex] : [vertex - 2, vertex - 1, vertex], (vertex - 2) * 3);
      }
    }
    const data = new VertexData();
    data.positions = positions; data.uvs = uvs; data.colors = colors; data.indices = indices;
    data.applyToMesh(this.mesh, true);
    if (this.billboard) {
      const corners = new Float32Array(capacity * 2);
      for (let vertex = 0; vertex < capacity; vertex++) {
        const corner = vertex % 4;
        corners[vertex * 2] = corner === 1 || corner === 2 ? 1 : -1;
        corners[vertex * 2 + 1] = corner >= 2 ? 1 : -1;
      }
      this.mesh.setVerticesData('billboardCorner', corners, false, 2);
      this.mesh.setVerticesData('particleShape', shapes, true, 2);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.material.dispose(false, false); // caller owns the texture
  }
}
