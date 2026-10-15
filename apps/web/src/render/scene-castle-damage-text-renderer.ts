import {Vector2} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import {battleUiLayer} from './battle-ui-layer';
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
interface GlyphDraw {resource: GlyphResource; vector: BattleScreenVector; width: number; height: number;}

/** Original numeric images and marks with their source palettes and metrics. */
export class SceneCastleDamageTextRenderer implements CastleDamageTextRenderer {
  private readonly resources = new Map<number, GlyphResource>();
  private readonly draws = new Map<number, GlyphDraw[]>();
  private zeroValueResource?: GlyphResource;
  private sequence = 0;
  private disposed = false;
  private readonly screen = new Vector2();
  private readonly rectangle: [number, number, number, number] = [0, 0, 0, 0];
  private readonly tint: [number, number, number, number] = [1, 1, 1, 1];

  constructor(private readonly scene: Scene, private readonly font: CastleDamageTextFont,
              fontName: 'Damage' | 'Benefit' | 'Critical' | 'Combo' = 'Damage',
              private readonly alphaIndex = 0, private readonly zeroValueImage?: BattleVectorShape) {
    if (font.name !== fontName || font.attributes.Type !== 'Static') {
      throw new Error(`原${fontName}字体定义缺失`);
    }
  }

  /** The scene owner awaits the original images before accepting text events. */
  async load(): Promise<void> {
    if (this.disposed) throw new Error('Castle文字资源已释放');
    try {
      for (const glyph of this.font.glyphs) {
        const shape: BattleVectorShape = {asset: glyph.asset, width: glyph.width, height: glyph.height};
        this.resources.set(glyph.codepoint, {glyph, shape});
      }
      const shapes = [...this.resources.values()].map(resource => resource.shape);
      if (this.zeroValueImage) {
        const glyph = {codepoint: 48, ...this.zeroValueImage};
        this.zeroValueResource = {glyph, shape: this.zeroValueImage};
        shapes.push(this.zeroValueImage);
      }
      await battleUiLayer(this.scene).prepare(shapes);
      if (this.disposed) throw new Error('Castle文字资源已释放');
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  create(text: string): number {
    const glyphs = text === '0' && this.zeroValueResource ? [this.zeroValueResource]
      : [...text].map(character => this.resources.get(character.codePointAt(0)!));
    const draws: GlyphDraw[] = [];
    for (const resource of glyphs) {
      // Original static numeric fonts have only ten digits. Unmapped signs stay blank.
      if (!resource || this.disposed) continue;
      draws.push({resource, width: 0, height: 0,
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
    let width = 0;
    for (const draw of draws) {
      draw.width = Math.fround(Math.round(draw.resource.glyph.width * horizontal) * record.scale);
      draw.height = Math.fround(Math.round(draw.resource.glyph.height * vertical) * record.scale);
      width = Math.fround(width + draw.width);
    }
    let x = Math.fround(record.x - width * 0.5);
    const screen = this.screen;
    screen.set(viewport.width, viewport.height);
    const rectangle = this.rectangle, tint = this.tint;
    tint[3] = record.alpha;
    for (const {resource, vector, width, height} of draws) {
      if (record.alpha <= 0) {vector.clear(); continue;}
      rectangle[0] = x; rectangle[1] = record.y; rectangle[2] = width; rectangle[3] = height;
      vector.draw(resource.shape, screen, rectangle, undefined, tint);
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
    this.zeroValueResource = undefined;
  }
}
