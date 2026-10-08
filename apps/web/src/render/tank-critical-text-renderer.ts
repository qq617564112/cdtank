import type {Scene} from '@babylonjs/core';
import type {CastleDamageTextRecord, CastleDamageTextRenderer, CastleDamageTextViewport} from '../assets/scenes/scene-castle-damage-text';
import {SceneCastleDamageTextRenderer, type CastleDamageTextFont} from './scene-castle-damage-text-renderer';

export interface CriticalTextImage {
  asset: string;
  Width: string;
  Height: string;
  attributes: Record<string, string>;
}

/** Published UI metrics supply Web dimensions; native GPU pixel equivalence remains separate. */
export function criticalTextLayout(record: Readonly<CastleDamageTextRecord>, viewport: CastleDamageTextViewport,
                                   font: CastleDamageTextFont, image: CriticalTextImage) {
  const height = (size: number, attributes: Record<string, string>): number => {
    const factor = attributes.AutoScaled === 'true' ? viewport.height / Number(attributes.NativeVertRes) : 1;
    return Math.fround(Math.round(Math.fround(size * Math.fround(factor))) * record.scale);
  };
  const imageHeight = height(Number(image.Height), image.attributes);
  const lineHeight = height(Math.max(...font.glyphs.map(glyph => glyph.height)), font.attributes);
  return {imageY: Math.fround(record.y - imageHeight * 0.5),
    textY: Math.fround(record.y - lineHeight * 0.5)};
}

/** Original selectors2/3: vector mark behind the Critical or Combo numeric outlines. */
export class TankCriticalTextRenderer implements CastleDamageTextRenderer {
  private readonly glyphs: SceneCastleDamageTextRenderer;
  private readonly imageRenderer: SceneCastleDamageTextRenderer;
  private readonly images = new Map<number, number>();
  private readonly textWidths = new Map<number, number[]>();

  constructor(scene: Scene, private readonly font: CastleDamageTextFont,
              private readonly image: CriticalTextImage) {
    const fontName = font.name === 'Combo' ? 'Combo' : 'Critical';
    this.glyphs = new SceneCastleDamageTextRenderer(scene, font, fontName, 1);
    this.imageRenderer = new SceneCastleDamageTextRenderer(scene, {
      name: fontName, attributes: {...image.attributes, Type: 'Static'},
      glyphs: [{codepoint: 0, asset: image.asset, width: Number(image.Width), height: Number(image.Height)}],
    }, fontName);
  }

  async load(): Promise<void> {
    try {await Promise.all([this.glyphs.load(), this.imageRenderer.load()]);}
    catch (error) {this.dispose(); throw error;}
  }

  create(text: string): number {
    const handle = this.glyphs.create(text);
    this.images.set(handle, this.imageRenderer.create('\0'));
    this.textWidths.set(handle, [...text].map(character =>
      this.font.glyphs.find(glyph => glyph.codepoint === character.codePointAt(0))?.width ?? 0));
    return handle;
  }

  draw(record: Readonly<CastleDamageTextRecord>, viewport: CastleDamageTextViewport): void {
    const imageHandle = this.images.get(record.handle);
    if (imageHandle === undefined) return;
    const layout = criticalTextLayout(record, viewport, this.font, this.image);
    this.imageRenderer.draw({...record, handle: imageHandle, y: layout.imageY}, viewport);
    const combo = this.font.name === 'Combo';
    this.glyphs.draw({...record, x: combo
      ? record.x - 46 * record.scale - this.scaledTextWidth(record.handle, viewport, record.scale) / 2 : record.x,
      y: layout.textY - (combo ? 17 * record.scale : 0)}, viewport);
  }

  private scaledTextWidth(handle: number, viewport: CastleDamageTextViewport, scale: number): number {
    const horizontal = viewport.width / Number(this.font.attributes.NativeHorzRes);
    return (this.textWidths.get(handle) ?? []).reduce((total, width) => Math.fround(total
      + Math.fround(Math.round(width * horizontal) * scale)), 0);
  }

  release(handle: number): void {
    const imageHandle = this.images.get(handle);
    if (imageHandle !== undefined) this.imageRenderer.release(imageHandle);
    this.images.delete(handle);
    this.textWidths.delete(handle);
    this.glyphs.release(handle);
  }

  dispose(): void {
    this.images.clear();
    this.textWidths.clear();
    this.glyphs.dispose();
    this.imageRenderer.dispose();
  }
}
