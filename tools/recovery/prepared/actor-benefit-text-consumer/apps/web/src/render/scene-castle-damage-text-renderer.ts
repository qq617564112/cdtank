import {Constants, Mesh, Scene, ShaderMaterial, Texture, Vector2, VertexData} from '@babylonjs/core';
import type {CastleDamageTextRecord, CastleDamageTextRenderer, CastleDamageTextViewport} from '../assets/scenes/scene-castle-damage-text';

export interface CastleDamageTextGlyph {
  codepoint: number;
  asset: string;
  width: number;
  height: number;
}

/** Original Damage.font and its existing published images; no system-font substitution. */
export interface CastleDamageTextFont {
  name: string;
  attributes: Record<string, string>;
  glyphs: readonly CastleDamageTextGlyph[];
}

interface GlyphResource {glyph: CastleDamageTextGlyph; texture: Texture;}
interface GlyphDraw {resource: GlyphResource; mesh: Mesh; material: ShaderMaterial;}

/** Web screen-space drawing provider for original Damage bitmap glyphs. */
export class SceneCastleDamageTextRenderer implements CastleDamageTextRenderer {
  private readonly resources = new Map<number, GlyphResource>();
  private readonly draws = new Map<number, GlyphDraw[]>();
  private readonly pending = new Set<(error: Error) => void>();
  private sequence = 0;
  private disposed = false;

  constructor(private readonly scene: Scene, private readonly font: CastleDamageTextFont,
              fontName: 'Damage' | 'Benefit' = 'Damage') {
    if (font.name !== fontName || font.attributes.Type !== 'Static') {
      throw new Error(`原${fontName}字体定义缺失`);
    }
  }

  /** The scene owner awaits this before accepting the Castle's ordinary damage events. */
  async load(): Promise<void> {
    if (this.disposed) throw new Error('Castle文字资源已释放');
    try {
      await Promise.all(this.font.glyphs.map(async glyph => {
        await new Promise<void>((resolve, reject) => {
          const cancel = (error: Error): void => {reject(error);};
          this.pending.add(cancel);
          const texture = new Texture(`/${glyph.asset}`, this.scene, true, false,
            Texture.BILINEAR_SAMPLINGMODE, () => {
              this.pending.delete(cancel);
              resolve();
            }, (message, error) => {
              this.pending.delete(cancel);
              reject(error ?? new Error(message ?? '原Damage图字载入失败'));
            });
          texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
          this.resources.set(glyph.codepoint, {glyph, texture});
        });
      }));
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  create(text: string): number {
    const glyphs = [...text].map(character => this.resources.get(character.codePointAt(0)!));
    const draws: GlyphDraw[] = [];
    for (const resource of glyphs) {
      // Original static numeric fonts have only ten digits. Unmapped signs stay blank.
      if (!resource || this.disposed) continue;
      const material = new ShaderMaterial('castle-damage-text', this.scene, {
        vertexSource: 'precision highp float; attribute vec3 position; attribute vec2 uv; uniform vec2 viewport; varying vec2 vUV; void main(){gl_Position=vec4(position.x*2.0/viewport.x-1.0,1.0-position.y*2.0/viewport.y,0.0,1.0);vUV=uv;}',
        fragmentSource: 'precision highp float; varying vec2 vUV; uniform sampler2D glyph; uniform float textAlpha; void main(){vec4 c=texture2D(glyph,vUV);gl_FragColor=vec4(c.rgb,c.a*textAlpha);}',
      }, {attributes: ['position', 'uv'], uniforms: ['viewport', 'textAlpha'],
        samplers: ['glyph'], needAlphaBlending: true});
      material.setTexture('glyph', resource.texture);
      material.backFaceCulling = false;
      material.disableDepthWrite = true;
      material.depthFunction = Constants.ALWAYS;
      material.alphaMode = Constants.ALPHA_COMBINE;
      const mesh = new Mesh('castle-damage-text-glyph', this.scene);
      mesh.material = material;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.isPickable = false;
      mesh.renderingGroupId = 3;
      mesh.setEnabled(false);
      draws.push({resource, mesh, material});
    }
    const handle = ++this.sequence;
    this.draws.set(handle, draws);
    return handle;
  }

  draw(record: Readonly<CastleDamageTextRecord>, viewport: CastleDamageTextViewport): void {
    const draws = this.draws.get(record.handle);
    if (!draws) return;
    const horizontal = viewport.width / Number(this.font.attributes.NativeHorzRes);
    const vertical = viewport.height / Number(this.font.attributes.NativeVertRes);
    const dimensions = draws.map(({resource}) => ({
      width: Math.fround(Math.round(resource.glyph.width * horizontal) * record.scale),
      height: Math.fround(Math.round(resource.glyph.height * vertical) * record.scale),
    }));
    let width = 0;
    for (const dimension of dimensions) width = Math.fround(width + dimension.width);
    let x = Math.fround(record.x - width * 0.5);
    for (const [index, {mesh, material}] of draws.entries()) {
      mesh.setEnabled(record.alpha > 0);
      if (record.alpha <= 0) continue;
      const {width, height} = dimensions[index];
      const vertices = new VertexData();
      vertices.positions = [x, record.y, 0, x + width, record.y, 0,
        x + width, record.y + height, 0, x, record.y + height, 0];
      vertices.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
      vertices.indices = [0, 1, 2, 0, 2, 3];
      vertices.applyToMesh(mesh);
      material.setFloat('textAlpha', record.alpha);
      material.setVector2('viewport', new Vector2(viewport.width, viewport.height));
      x = Math.fround(x + width);
    }
  }

  release(handle: number): void {
    for (const {mesh, material} of this.draws.get(handle) ?? []) {
      mesh.dispose();
      material.dispose(false, false);
    }
    this.draws.delete(handle);
  }

  dispose(): void {
    this.disposed = true;
    for (const cancel of this.pending) cancel(new Error('Castle文字资源已释放'));
    this.pending.clear();
    for (const handle of this.draws.keys()) this.release(handle);
    for (const {texture} of this.resources.values()) texture.dispose();
    this.resources.clear();
  }
}
