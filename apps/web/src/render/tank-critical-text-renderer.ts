import type {Scene} from '@babylonjs/core';
import type {CastleDamageTextRecord, CastleDamageTextRenderer, CastleDamageTextViewport} from '../assets/scenes/scene-castle-damage-text';
import {copyCastleDamageTextRecordToRef} from '../assets/scenes/scene-castle-damage-text';
import {SceneCastleDamageTextRenderer, type CastleDamageTextFont} from './scene-castle-damage-text-renderer';

export interface CriticalTextImage {
  asset: string;
  Width: string;
  Height: string;
  attributes: Record<string, string>;
}

function scaledHeight(size: number, attributes: Record<string, string>,
  viewport: CastleDamageTextViewport, scale: number): number {
  const factor = attributes.AutoScaled === 'true' ? viewport.height / Number(attributes.NativeVertRes) : 1;
  return Math.fround(Math.round(Math.fround(size * Math.fround(factor))) * scale);
}

/** Combo offsets use the attached image's scale alongside the published font metrics. */
class CriticalTextLayoutState {
  private readonly maximumHeight: number;
  private readonly result = {imageY: 0, textX: 0, textY: 0};

  constructor(private readonly font: CastleDamageTextFont, private readonly image: CriticalTextImage) {
    this.maximumHeight = Math.max(...font.glyphs.map(glyph => glyph.height));
  }

  update(record: Readonly<CastleDamageTextRecord>, viewport: CastleDamageTextViewport) {
    const image = this.image, font = this.font;
    const imageHeight = scaledHeight(Number(image.Height), image.attributes, viewport, record.scale);
    const lineHeight = scaledHeight(this.maximumHeight, font.attributes, viewport, record.scale);
    const combo = font.name === 'Combo';
    const horizontal = image.attributes.AutoScaled === 'true'
      ? viewport.width / Number(image.attributes.NativeHorzRes) : 1;
    const offsetX = combo ? Math.fround(Math.round(46 * horizontal) * record.scale) : 0;
    const offsetY = combo ? scaledHeight(17, image.attributes, viewport, record.scale) : 0;
    const result = this.result;
    result.imageY = Math.fround(record.y - imageHeight * 0.5);
    result.textX = Math.fround(record.x - offsetX);
    result.textY = Math.fround(record.y - lineHeight * 0.5 - offsetY);
    return result;
  }
}

/** Original selectors2/3: vector mark behind the Critical or Combo numeric outlines. */
export class TankCriticalTextRenderer implements CastleDamageTextRenderer {
  private readonly glyphs: SceneCastleDamageTextRenderer;
  private readonly imageRenderer: SceneCastleDamageTextRenderer;
  private readonly images = new Map<number, number>();
  private readonly textWidths = new Map<number, number[]>();
  private readonly layout: CriticalTextLayoutState;
  private readonly imageRecord: CastleDamageTextRecord = {handle: 0, x: 0, y: 0, elapsed: 0, alpha: 1, scale: 1};
  private readonly textRecord: CastleDamageTextRecord = {handle: 0, x: 0, y: 0, elapsed: 0, alpha: 1, scale: 1};

  constructor(scene: Scene, private readonly font: CastleDamageTextFont,
              image: CriticalTextImage) {
    this.layout = new CriticalTextLayoutState(font, image);
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
    const layout = this.layout.update(record, viewport);
    const imageRecord = this.imageRecord;
    copyCastleDamageTextRecordToRef(record, imageRecord);
    imageRecord.handle = imageHandle; imageRecord.y = layout.imageY;
    this.imageRenderer.draw(imageRecord, viewport);
    const combo = this.font.name === 'Combo';
    const textRecord = this.textRecord;
    copyCastleDamageTextRecordToRef(record, textRecord);
    textRecord.x = combo ? layout.textX - this.scaledTextWidth(record.handle, viewport, record.scale) / 2 : layout.textX;
    textRecord.y = layout.textY;
    this.glyphs.draw(textRecord, viewport);
    imageRecord.origin = undefined; textRecord.origin = undefined;
  }

  private scaledTextWidth(handle: number, viewport: CastleDamageTextViewport, scale: number): number {
    const horizontal = viewport.width / Number(this.font.attributes.NativeHorzRes);
    let total = 0;
    for (const width of this.textWidths.get(handle)!) {
      total = Math.fround(total + Math.fround(Math.round(width * horizontal) * scale));
    }
    return total;
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
    this.imageRecord.origin = undefined; this.textRecord.origin = undefined;
    this.glyphs.dispose();
    this.imageRenderer.dispose();
  }
}
