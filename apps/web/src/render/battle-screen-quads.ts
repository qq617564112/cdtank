import {Constants, Mesh, ShaderMaterial, UtilityLayerRenderer, Vector2, Vector3, VertexBuffer} from '@babylonjs/core';
import type {BaseTexture, Scene} from '@babylonjs/core';
import {decodeImageRegion, type ImageRegion} from '../assets/image-resources';
import {setDynamicMeshIndexCount} from './webgpu-draw-cache';

export type ScreenUv = readonly [number, number, number, number];
export type ScreenColour = readonly [number, number, number, number];
export const WHITE: ScreenColour = [1, 1, 1, 1];

const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
uniform vec2 viewport;
varying vec2 vUv;
varying vec2 vScreen;
varying vec4 vColour;
varying float vMask;
void main() {
  gl_Position = vec4(position.x / viewport.x * 2.0 - 1.0,
    1.0 - position.y / viewport.y * 2.0, 0.0, 1.0);
  vUv = uv;
  vScreen = position.xy;
  vColour = color;
  vMask = position.z;
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D image;
uniform vec3 clipCircle;
varying vec2 vUv;
varying vec2 vScreen;
varying vec4 vColour;
varying float vMask;
void main() {
  vec4 source = texture2D(image, vUv);
  float coverage = 1.0;
  if (clipCircle.z > 0.0) {
    coverage = 1.0 - smoothstep(clipCircle.z - 1.0, clipCircle.z,
      length(vScreen - clipCircle.xy));
    if (coverage < 0.003) discard;
  }
  vec4 colour = vec4(mix(source.rgb * vColour.rgb, vColour.rgb, vMask), source.a * vColour.a);
  colour.a *= coverage;
  if (colour.a < 0.003) discard;
  gl_FragColor = colour;
}`;

/** Screen meshes render after the world and never participate in picking. */
export function createBattleScreenLayer(scene: Scene): UtilityLayerRenderer {
  const layer = new UtilityLayerRenderer(scene, false);
  layer.shouldRender = false;
  layer.pickingEnabled = false;
  // Screen quads always pass depth testing and never write depth.
  layer.utilityLayerScene.autoClearDepthAndStencil = false;
  return layer;
}

/** One texture and draw call for a batch of screen-space rectangles. */
export class BattleScreenQuads {
  readonly material: ShaderMaterial;
  private readonly mesh: Mesh;
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private colours = new Float32Array(0);
  private uploadCount = -1;
  private positionUpload = this.positions;
  private uvUpload = this.uvs;
  private colourUpload = this.colours;
  private capacity = 0;
  private count = 0;
  private readonly viewport = Vector2.Zero();
  private readonly clip = Vector3.Zero();

  constructor(scene: Scene, name: string, texture: BaseTexture, order: number,
    fragmentSource = FRAGMENT, uniforms: readonly string[] = []) {
    this.material = new ShaderMaterial(name, scene, {vertexSource: VERTEX, fragmentSource}, {
      attributes: ['position', 'uv', 'color'], uniforms: ['viewport', 'clipCircle', ...uniforms],
      samplers: ['image'], needAlphaBlending: true,
    });
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.material.depthFunction = Constants.ALWAYS;
    this.material.setTexture('image', texture);
    this.material.setVector3('clipCircle', Vector3.Zero());
    this.mesh = new Mesh(name, scene);
    this.mesh.material = this.material;
    this.mesh.alphaIndex = order;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.doNotSyncBoundingInfo = true;
    this.mesh.setEnabled(false);
  }

  begin(width: number, height: number): void {
    this.count = 0;
    this.viewport.set(width, height);
    this.material.setVector2('viewport', this.viewport);
  }

  clipCircle(x: number, y: number, radius: number): void {
    this.clip.set(x, y, radius);
    this.material.setVector3('clipCircle', this.clip);
  }

  quad(x: number, y: number, width: number, height: number, uv: ScreenUv,
    colour: ScreenColour = WHITE, mask = false, angle = 0): void {
    this.reserve(this.count + 1);
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    for (let corner = 0; corner < 4; corner++) {
      const right = corner === 1 || corner === 2;
      const bottom = corner >= 2;
      const dx = (right ? .5 : -.5) * width, dy = (bottom ? .5 : -.5) * height;
      const vertex = this.count * 4 + corner;
      this.positions[vertex * 3] = x + width / 2 + dx * cosine - dy * sine;
      this.positions[vertex * 3 + 1] = y + height / 2 + dx * sine + dy * cosine;
      this.positions[vertex * 3 + 2] = mask ? 1 : 0;
      this.uvs[vertex * 2] = uv[right ? 2 : 0];
      this.uvs[vertex * 2 + 1] = uv[bottom ? 3 : 1];
      for (let channel = 0; channel < 4; channel++) this.colours[vertex * 4 + channel] = colour[channel];
    }
    this.count++;
  }

  end(): void {
    this.mesh.setEnabled(this.count > 0);
    if (!this.count) return;
    const geometry = this.mesh.geometry!;
    if (this.uploadCount !== this.count) {
      this.positionUpload = this.positions.subarray(0, this.count * 12);
      this.uvUpload = this.uvs.subarray(0, this.count * 8);
      this.colourUpload = this.colours.subarray(0, this.count * 16);
      this.uploadCount = this.count;
    }
    geometry.updateVerticesDataDirectly(VertexBuffer.PositionKind, this.positionUpload, 0);
    geometry.updateVerticesDataDirectly(VertexBuffer.UVKind, this.uvUpload, 0);
    geometry.updateVerticesDataDirectly(VertexBuffer.ColorKind, this.colourUpload, 0);
    setDynamicMeshIndexCount(this.mesh, this.count * 6);
  }

  clear(): void {this.mesh.setEnabled(false);}

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }

  private reserve(required: number): void {
    if (required <= this.capacity) return;
    const capacity = Math.max(16, this.capacity * 2);
    const positions = new Float32Array(capacity * 12);
    const uvs = new Float32Array(capacity * 8);
    const colours = new Float32Array(capacity * 16);
    positions.set(this.positions);
    uvs.set(this.uvs);
    colours.set(this.colours);
    this.positions = positions;
    this.uvs = uvs;
    this.colours = colours;
    this.uploadCount = -1;
    this.positionUpload = positions;
    this.uvUpload = uvs;
    this.colourUpload = colours;
    this.capacity = capacity;
    this.mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
    this.mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
    this.mesh.setVerticesData(VertexBuffer.ColorKind, colours, true);
    const indices: number[] = [];
    for (let quad = 0; quad < capacity; quad++) {
      const vertex = quad * 4;
      indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
    }
    this.mesh.setIndices(indices);
  }
}

/** Source images are rasterized into an atlas once, before battle readiness. */
export function loadBattleOverlayImage(asset: string): Promise<ImageRegion> {
  return decodeImageRegion(`/${asset}`);
}
