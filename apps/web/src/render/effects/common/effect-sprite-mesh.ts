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

interface SharedEffectMaterial {
  readonly material: ShaderMaterial;
  owners: number;
  disposed: boolean;
}

const sharedEffectMaterials = new WeakMap<Scene, WeakMap<Texture, Map<string, SharedEffectMaterial>>>();

/** Mesh-specific appearance stays in vertex data; materials share only fixed state. */
function acquireEffectMaterial(scene: Scene, pass: EffectRenderPass, texture: Texture,
  billboard: boolean): SharedEffectMaterial {
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
  let textures = sharedEffectMaterials.get(scene);
  if (!textures) {
    textures = new WeakMap();
    sharedEffectMaterials.set(scene, textures);
  }
  let variants = textures.get(texture);
  if (!variants) {
    variants = new Map();
    textures.set(texture, variants);
  }
  const key = `${billboard};${cull};${additive};${states.get('ZEnable')};${filter}`;
  const existing = variants.get(key);
  if (existing) {
    existing.owners++;
    return existing;
  }
  const material = new ShaderMaterial('original-effect', scene, {
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
  material.setTexture('effectTexture', texture);
  material.backFaceCulling = cull !== 'NONE';
  // GBF names the culled winding; Babylon names the retained front face.
  material.sideOrientation = cull === 'CCW' ? Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
  material.disableDepthWrite = true;
  material.depthFunction = states.get('ZEnable') === 'TRUE' ? Constants.LEQUAL : Constants.ALWAYS;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  // RGB factors match the GBF. Separate-alpha device state is still unrecovered;
  // Babylon's alpha-channel accumulation is retained pending source evidence.
  material.alphaMode = additive ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
  const shared: SharedEffectMaterial = {material, owners: 1, disposed: false};
  const cache = variants;
  cache.set(key, shared);
  material.onDisposeObservable.addOnce(() => {
    shared.disposed = true;
    cache.delete(key);
  });
  return shared;
}

function releaseEffectMaterial(shared: SharedEffectMaterial): void {
  if (--shared.owners === 0 && !shared.disposed) shared.material.dispose(false, false);
}

/** Renderer for resolved world-space GBF passes; native XYZ inputs. */
export class EffectSpriteMesh {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private readonly sharedMaterial: SharedEffectMaterial;
  private disposed = false;
  private capacity = 0;
  private count = 0;
  private topology?: 'quads' | 'strip';
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private colors = new Float32Array(0);
  private shapes = new Float32Array(0);
  private uploadCount = -1;
  private positionUpload = this.positions;
  private uvUpload = this.uvs;
  private colourUpload = this.colors;
  private shapeUpload = this.shapes;
  private positionsChanged = false;
  private uvsChanged = false;
  private colorsChanged = false;
  private shapesChanged = false;
  private readonly minimum = new Vector3();
  private readonly maximum = new Vector3();
  private readonly bounds = new BoundingInfo(Vector3.Zero(), Vector3.Zero());
  private readonly contextRestoredObserver;

  constructor(scene: Scene, pass: EffectRenderPass, texture: Texture, private readonly billboard = false) {
    this.sharedMaterial = acquireEffectMaterial(scene, pass, texture, billboard);
    this.material = this.sharedMaterial.material;
    this.mesh = new Mesh('original-effect-quad', scene);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    // Scene surfaces finish first; source depth testing still occludes world effects.
    scene.setRenderingAutoClearDepthStencil(1, false);
    this.mesh.renderingGroupId = 1;
    this.contextRestoredObserver = scene.getEngine().onContextRestoredObservable.add(() => {
      if (!this.capacity) return;
      // Prefix uploads may have restored less than the retained CPU capacity.
      this.mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true);
      this.mesh.setVerticesData(VertexBuffer.UVKind, this.uvs, true);
      this.mesh.setVerticesData(VertexBuffer.ColorKind, this.colors, true);
      if (this.billboard) this.mesh.setVerticesData('particleShape', this.shapes, true, 2);
      this.positionsChanged = this.uvsChanged = false;
      this.colorsChanged = this.shapesChanged = false;
      const indexCount = this.topology === 'quads' ? this.count / 4 * 6 : Math.max(0, this.count - 2) * 3;
      if (indexCount) this.bounds.reConstruct(this.minimum, this.maximum, this.mesh.getWorldMatrix());
      this.mesh.setBoundingInfo(this.bounds);
      setDynamicMeshIndexCount(this.mesh, indexCount);
    });
  }

  update(corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3],
    uv: readonly [number, number, number, number], packedColor: number): void {
    this.updateQuads([{corners, uv, packedColor}]);
  }

  /** Allocate the expected quad capacity and compile while battle resources load. */
  async prepare(quadCount = 1): Promise<void> {
    this.reserve(Math.max(1, quadCount) * 4, 'quads');
    this.mesh.setEnabled(false);
    await this.material.forceCompilationAsync(this.mesh);
  }

  clear(): void {
    if (this.disposed) return;
    this.count = 0;
    this.mesh.setEnabled(false);
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
    const x = -position[0], y = position[1], z = position[2];
    const red = ((color >>> 16) & 255) / 255, green = ((color >>> 8) & 255) / 255;
    const blue = (color & 255) / 255, alpha = (color >>> 24) / 255;
    const radians = Math.fround(angle) * Math.fround(0.01745329238474369);
    for (let corner = 0; corner < 4; corner++) {
      const index = this.count++;
      this.writePosition(index, x, y, z);
      this.writeUv(index, uv[corner === 1 || corner === 2 ? 0 : 2], uv[corner >= 2 ? 3 : 1]);
      this.writeColor(index, red, green, blue, alpha);
      this.writeShape(index, size, radians);
    }
    const radius = Math.abs(size) * Math.SQRT2;
    this.include(x - radius, y - radius, z - radius);
    this.include(x + radius, y + radius, z + radius);
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
    this.writePosition(index, x, y, z);
    this.writeUv(index, u, v);
    this.writeColor(index, ((color >>> 16) & 255) / 255, ((color >>> 8) & 255) / 255,
      (color & 255) / 255, (color >>> 24) / 255);
    this.include(x, y, z);
  }

  private writePosition(index: number, x: number, y: number, z: number): void {
    const offset = index * 3;
    if (this.positionsChanged) {
      this.positions[offset] = x; this.positions[offset + 1] = y; this.positions[offset + 2] = z;
      return;
    }
    const previousX = this.positions[offset], previousY = this.positions[offset + 1], previousZ = this.positions[offset + 2];
    this.positions[offset] = x; this.positions[offset + 1] = y; this.positions[offset + 2] = z;
    this.positionsChanged = !Object.is(previousX, this.positions[offset]) || !Object.is(previousY, this.positions[offset + 1])
      || !Object.is(previousZ, this.positions[offset + 2]);
  }

  private writeUv(index: number, u: number, v: number): void {
    const offset = index * 2;
    if (this.uvsChanged) {
      this.uvs[offset] = u; this.uvs[offset + 1] = v;
      return;
    }
    const previousU = this.uvs[offset], previousV = this.uvs[offset + 1];
    this.uvs[offset] = u; this.uvs[offset + 1] = v;
    // Compare the stored Float32 values, including the sign of zero.
    this.uvsChanged = !Object.is(previousU, this.uvs[offset]) || !Object.is(previousV, this.uvs[offset + 1]);
  }

  private writeColor(index: number, red: number, green: number, blue: number, alpha: number): void {
    const offset = index * 4;
    if (this.colorsChanged) {
      this.colors[offset] = red; this.colors[offset + 1] = green;
      this.colors[offset + 2] = blue; this.colors[offset + 3] = alpha;
      return;
    }
    const previousRed = this.colors[offset], previousGreen = this.colors[offset + 1];
    const previousBlue = this.colors[offset + 2], previousAlpha = this.colors[offset + 3];
    this.colors[offset] = red; this.colors[offset + 1] = green;
    this.colors[offset + 2] = blue; this.colors[offset + 3] = alpha;
    this.colorsChanged = !Object.is(previousRed, this.colors[offset]) || !Object.is(previousGreen, this.colors[offset + 1])
      || !Object.is(previousBlue, this.colors[offset + 2]) || !Object.is(previousAlpha, this.colors[offset + 3]);
  }

  private writeShape(index: number, size: number, angle: number): void {
    const offset = index * 2;
    if (this.shapesChanged) {
      this.shapes[offset] = size; this.shapes[offset + 1] = angle;
      return;
    }
    const previousSize = this.shapes[offset], previousAngle = this.shapes[offset + 1];
    this.shapes[offset] = size; this.shapes[offset + 1] = angle;
    this.shapesChanged = !Object.is(previousSize, this.shapes[offset]) || !Object.is(previousAngle, this.shapes[offset + 1]);
  }

  private end(indexCount: number): void {
    this.mesh.setEnabled(indexCount > 0);
    if (!indexCount) return;
    const geometry = this.mesh.geometry!;
    if (this.uploadCount !== this.count) {
      this.positionUpload = this.positions.subarray(0, this.count * 3);
      this.uvUpload = this.uvs.subarray(0, this.count * 2);
      this.colourUpload = this.colors.subarray(0, this.count * 4);
      if (this.billboard) this.shapeUpload = this.shapes.subarray(0, this.count * 2);
      this.uploadCount = this.count;
    }
    // Value updates keep the same layout and GPU buffers; reserve/restore rebuild them.
    if (this.positionsChanged) {
      geometry.getVertexBuffer(VertexBuffer.PositionKind)!.updateDirectly(this.positionUpload, 0);
      this.positionsChanged = false;
    }
    if (this.uvsChanged) {
      geometry.getVertexBuffer(VertexBuffer.UVKind)!.updateDirectly(this.uvUpload, 0);
      this.uvsChanged = false;
    }
    if (this.colorsChanged) {
      geometry.getVertexBuffer(VertexBuffer.ColorKind)!.updateDirectly(this.colourUpload, 0);
      this.colorsChanged = false;
    }
    if (this.billboard && this.shapesChanged) {
      geometry.getVertexBuffer('particleShape')!.updateDirectly(this.shapeUpload, 0);
      this.shapesChanged = false;
    }
    this.bounds.reConstruct(this.minimum, this.maximum, this.mesh.getWorldMatrix());
    this.mesh.setBoundingInfo(this.bounds);
    setDynamicMeshIndexCount(this.mesh, indexCount);
  }

  private reserve(required: number, topology: 'quads' | 'strip'): void {
    if (!required || (required <= this.capacity && topology === this.topology)) return;
    let capacity = Math.max(16, this.capacity);
    while (capacity < required) capacity *= 2;
    const positions = new Float32Array(capacity * 3), uvs = new Float32Array(capacity * 2);
    const colors = new Float32Array(capacity * 4);
    positions.set(this.positions); uvs.set(this.uvs); colors.set(this.colors);
    this.positions = positions; this.uvs = uvs; this.colors = colors;
    this.uploadCount = -1;
    this.positionUpload = positions; this.uvUpload = uvs; this.colourUpload = colors;
    this.capacity = capacity; this.topology = topology;
    this.positionsChanged = this.uvsChanged = true;
    this.colorsChanged = this.shapesChanged = true;
    const indices = new Uint32Array(topology === 'quads' ? capacity / 4 * 6 : (capacity - 2) * 3);
    if (topology === 'quads') {
      for (let vertex = 0; vertex < capacity; vertex += 4) {
        const index = vertex / 4 * 6;
        indices[index] = vertex; indices[index + 1] = vertex + 1; indices[index + 2] = vertex + 3;
        indices[index + 3] = vertex + 3; indices[index + 4] = vertex + 1; indices[index + 5] = vertex + 2;
      }
    } else {
      for (let vertex = 2; vertex < capacity; vertex++) {
        const index = (vertex - 2) * 3;
        indices[index] = vertex % 2 ? vertex - 1 : vertex - 2;
        indices[index + 1] = vertex % 2 ? vertex - 2 : vertex - 1;
        indices[index + 2] = vertex;
      }
    }
    const data = new VertexData();
    data.positions = positions; data.uvs = uvs; data.colors = colors; data.indices = indices;
    data.applyToMesh(this.mesh, true);
    if (this.billboard) {
      const shapes = new Float32Array(capacity * 2);
      shapes.set(this.shapes);
      this.shapes = shapes; this.shapeUpload = shapes;
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
    this.mesh.getScene().getEngine().onContextRestoredObservable.remove(this.contextRestoredObserver);
    this.mesh.dispose();
    releaseEffectMaterial(this.sharedMaterial); // caller owns the texture
  }
}
