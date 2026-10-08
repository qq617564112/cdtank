import {Vector2} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import {decodeImage} from '../assets/image-resources';
import type {CastleDamageTextRecord, CastleDamageTextRenderer, CastleDamageTextViewport} from '../assets/scenes/scene-castle-damage-text';
import {BattleScreenVector, type BattleVectorShape} from './battle-screen-vectors';

export interface CastleDamageTextGlyph {
  codepoint: number;
  asset: string;
  width: number;
  height: number;
}

/** Original numeric font mappings and dimensions. */
export interface CastleDamageTextFont {
  name: string;
  attributes: Record<string, string>;
  glyphs: readonly CastleDamageTextGlyph[];
}

interface GlyphResource {glyph: CastleDamageTextGlyph; shape: BattleVectorShape;}
interface GlyphDraw {resource: GlyphResource; vector: BattleScreenVector;}

/** Original numeric images and marks with their source palettes and metrics. */
export class SceneCastleDamageTextRenderer implements CastleDamageTextRenderer {
  private readonly resources = new Map<number, GlyphResource>();
  private readonly draws = new Map<number, GlyphDraw[]>();
  private sequence = 0;
  private disposed = false;

  constructor(private readonly scene: Scene, private readonly font: CastleDamageTextFont,
              fontName: 'Damage' | 'Benefit' | 'Critical' | 'Combo' = 'Damage',
              private readonly alphaIndex = 0) {
    if (font.name !== fontName || font.attributes.Type !== 'Static') {
      throw new Error(`原${fontName}字体定义缺失`);
    }
  }

  /** The scene owner awaits the original images before accepting text events. */
  async load(): Promise<void> {
    if (this.disposed) throw new Error('Castle文字资源已释放');
    try {
      const {BATTLE_TEXT_VECTORS} = await import('./battle-text-vector-geometry');
      await Promise.all(this.font.glyphs.map(glyph => decodeImage(`/${glyph.asset}`)));
      if (this.disposed) throw new Error('Castle文字资源已释放');
      for (const glyph of this.font.glyphs) {
        const shape = BATTLE_TEXT_VECTORS[glyph.asset];
        if (!shape) throw new Error(`原战斗文字图片资源缺失：${glyph.asset}`);
        this.resources.set(glyph.codepoint, {glyph, shape});
      }
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
      draws.push({resource,
        vector: new BattleScreenVector(this.scene, 'castle-damage-text-glyph', this.alphaIndex, 3)});
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
    const screen = new Vector2(viewport.width, viewport.height);
    for (const [index, {resource, vector}] of draws.entries()) {
      if (record.alpha <= 0) {vector.clear(); continue;}
      const {width, height} = dimensions[index];
      vector.draw(resource.shape, screen, [x, record.y, width, height], undefined, [1, 1, 1, record.alpha]);
      x = Math.fround(x + width);
    }
  }

  release(handle: number): void {
    for (const {vector} of this.draws.get(handle) ?? []) vector.dispose();
    this.draws.delete(handle);
  }

  dispose(): void {
    this.disposed = true;
    for (const handle of this.draws.keys()) this.release(handle);
    this.resources.clear();
  }
}
