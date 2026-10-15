import {Constants, Material, Mesh, Scene, ShaderMaterial, Texture, Vector2, VertexData, VertexBuffer} from '@babylonjs/core';
import type {EffectOverlayRectangle} from './effect-overlay-draw';
import {EffectRenderPass} from '../common/effect-sprite-mesh';

const CORNERS = [0, 1, 2, 2, 1, 3] as const;

/** Original textured UI rectangle in XYZRHW screen pixels. */
export class EffectOverlayMesh {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private readonly positions = new Float32Array(18);
  private readonly uvs = new Float32Array(12);
  private readonly colors = new Float32Array(24);
  private readonly viewport = new Vector2();

  constructor(private readonly scene: Scene, pass: EffectRenderPass, texture: Texture) {
    const states = new Map(pass.states.map(state => [state.name, state.value]));
    for (const [name, value] of Object.entries({FVF: 'XYZRHW|DIFFUSE|TEX1', ZEnable: 'FALSE',
      ZWriteEnable: 'FALSE', Lighting: 'FALSE', AlphaBlendEnable: 'TRUE', SrcBlend: 'SRCALPHA',
      DestBlend: 'INVSRCALPHA', 'ColorOp[0]': 'MODULATE', 'AlphaOp[0]': 'MODULATE',
      'ColorArg1[0]': 'TEXTURE', 'ColorArg2[0]': 'DIFFUSE', 'AlphaArg1[0]': 'TEXTURE',
      'AlphaArg2[0]': 'DIFFUSE', 'MinFilter[0]': 'POINT', 'MagFilter[0]': 'POINT',
      'AddressU[0]': 'CLAMP', 'AddressV[0]': 'CLAMP'})) {
      if (states.get(name) !== value) throw new Error(`Unsupported screen effect state ${name}`);
    }
    const cull = states.get('CullMode');
    if (!['NONE', 'CW', 'CCW'].includes(cull ?? '')) throw new Error('Unresolved screen effect culling');
    if (states.get('AlphaTestEnable') === 'TRUE') throw new Error('Unsupported screen effect alpha test');
    texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    let material: ShaderMaterial | undefined;
    let mesh: Mesh | undefined;
    try {
      material = new ShaderMaterial('original-screen-effect', scene, {
        vertexSource: `precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
uniform vec2 viewport;
varying vec2 vUV;
varying vec4 vColor;
void main(){gl_Position=vec4(position.x*2.0/viewport.x-1.0,1.0-position.y*2.0/viewport.y,position.z,1.0);vUV=uv;vColor=color;}`,
        fragmentSource: `precision highp float;
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D effectTexture;
void main(){gl_FragColor=texture2D(effectTexture,vUV)*vColor;}`,
      }, {attributes: ['position', 'uv', 'color'], uniforms: ['viewport'], samplers: ['effectTexture'], needAlphaBlending: true});
      material.setTexture('effectTexture', texture);
      material.setVector2('viewport', this.viewport);
      material.backFaceCulling = cull !== 'NONE';
      // GBF names the culled winding; Babylon names the retained front face.
      material.sideOrientation = cull === 'CCW' ? Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
      material.disableDepthWrite = true;
      material.depthFunction = Constants.ALWAYS;
      material.transparencyMode = Material.MATERIAL_ALPHABLEND;
      material.alphaMode = Constants.ALPHA_COMBINE;
      mesh = new Mesh('original-screen-effect', scene);
      mesh.material = material;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.isPickable = false;
      scene.setRenderingAutoClearDepthStencil(2, false);
      mesh.renderingGroupId = 2;
      this.material = material;
      this.mesh = mesh;
    } catch (error) {
      mesh?.dispose();
      material?.dispose(false, false);
      throw error;
    }
  }

  update(draw?: EffectOverlayRectangle): void {
    this.mesh.setEnabled(!!draw);
    if (!draw) return;
    const rectangle = draw.rectangle;
    const left = Math.fround(rectangle[0]), bottom = Math.fround(rectangle[1]);
    const right = Math.fround(rectangle[2]), top = Math.fround(rectangle[3]);
    const u0 = Math.fround(rectangle[4]), v0 = Math.fround(rectangle[5]);
    const u1 = Math.fround(rectangle[6]), v1 = Math.fround(rectangle[7]);
    const z = Math.fround(draw.z);
    const red = Math.fround(((draw.color >>> 16) & 255) / 255);
    const green = Math.fround(((draw.color >>> 8) & 255) / 255);
    const blue = Math.fround((draw.color & 255) / 255), alpha = Math.fround((draw.color >>> 24) / 255);
    const positionsChanged = !Object.is(this.positions[0], left) || !Object.is(this.positions[1], bottom)
      || !Object.is(this.positions[2], z) || !Object.is(this.positions[3], right) || !Object.is(this.positions[7], top);
    const uvsChanged = !Object.is(this.uvs[0], u0) || !Object.is(this.uvs[1], v0)
      || !Object.is(this.uvs[2], u1) || !Object.is(this.uvs[5], v1);
    const colorsChanged = !Object.is(this.colors[0], red) || !Object.is(this.colors[1], green)
      || !Object.is(this.colors[2], blue) || !Object.is(this.colors[3], alpha);
    for (let vertex = 0; vertex < CORNERS.length; vertex++) {
      const corner = CORNERS[vertex];
      if (positionsChanged) {
        this.positions[vertex * 3] = corner & 1 ? right : left;
        this.positions[vertex * 3 + 1] = corner & 2 ? top : bottom;
        this.positions[vertex * 3 + 2] = z;
      }
      if (uvsChanged) {
        this.uvs[vertex * 2] = corner & 1 ? u1 : u0;
        this.uvs[vertex * 2 + 1] = corner & 2 ? v1 : v0;
      }
      if (colorsChanged) {
        this.colors[vertex * 4] = red;
        this.colors[vertex * 4 + 1] = green;
        this.colors[vertex * 4 + 2] = blue;
        this.colors[vertex * 4 + 3] = alpha;
      }
    }
    if (!this.mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) {
      const data = new VertexData();
      data.positions = this.positions;
      data.uvs = this.uvs;
      data.colors = this.colors;
      data.indices = [0, 1, 2, 3, 4, 5];
      data.applyToMesh(this.mesh, true);
    } else {
      if (positionsChanged) this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions);
      if (uvsChanged) this.mesh.updateVerticesData(VertexBuffer.UVKind, this.uvs);
      if (colorsChanged) this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors);
    }
    const engine = this.scene.getEngine();
    this.viewport.set(engine.getRenderWidth(), engine.getRenderHeight());
  }

  dispose(): void {this.mesh.dispose(); this.material.dispose(false, false);}
}
