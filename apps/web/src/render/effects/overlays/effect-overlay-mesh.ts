import {Constants, Material, Mesh, Scene, ShaderMaterial, Texture, Vector2, VertexData, VertexBuffer} from '@babylonjs/core';
import {effectOverlayVertices, EffectOverlayRectangle} from './effect-overlay-draw';
import {EffectRenderPass} from '../common/effect-sprite-mesh';
import {unpackEffectColor} from '../common/effect-color';

/** Original textured UI rectangle in XYZRHW screen pixels. */
export class EffectOverlayMesh {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

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
        vertexSource: 'precision highp float; attribute vec3 position; attribute vec2 uv; attribute vec4 color; uniform vec2 viewport; varying vec2 vUV; varying vec4 vColor; void main(){gl_Position=vec4(position.x*2.0/viewport.x-1.0,1.0-position.y*2.0/viewport.y,position.z*2.0-1.0,1.0);vUV=uv;vColor=color;}',
        fragmentSource: 'precision highp float; varying vec2 vUV; varying vec4 vColor; uniform sampler2D effectTexture; void main(){gl_FragColor=texture2D(effectTexture,vUV)*vColor;}',
      }, {attributes: ['position', 'uv', 'color'], uniforms: ['viewport'], samplers: ['effectTexture'], needAlphaBlending: true});
      material.setTexture('effectTexture', texture);
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
    const vertices = effectOverlayVertices(draw);
    const data = new VertexData();
    data.positions = vertices.flatMap(vertex => vertex.position);
    data.uvs = vertices.flatMap(vertex => vertex.uv);
    data.colors = vertices.flatMap(vertex => unpackEffectColor(vertex.color));
    data.indices = vertices.map((_, index) => index);
    if (!this.mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) data.applyToMesh(this.mesh, true);
    else {
      this.mesh.updateVerticesData(VertexBuffer.PositionKind, data.positions);
      this.mesh.updateVerticesData(VertexBuffer.UVKind, data.uvs);
      this.mesh.updateVerticesData(VertexBuffer.ColorKind, data.colors);
    }
    const engine = this.scene.getEngine();
    this.material.setVector2('viewport', new Vector2(engine.getRenderWidth(), engine.getRenderHeight()));
  }

  dispose(): void {this.mesh.dispose(); this.material.dispose(false, false);}
}
