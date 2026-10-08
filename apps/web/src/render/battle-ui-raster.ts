type Tint = readonly [number, number, number];
type ImageSource = HTMLImageElement | HTMLCanvasElement;
export type BattleUiImage = (url: string, tint?: Tint) => ImageSource | undefined;

const number = (value: string): number => parseFloat(value) || 0;
const transparent = (value: string): boolean => value === 'transparent' || value === 'rgba(0, 0, 0, 0)';

function filterTint(filter: string): Tint {
  const reference = /url\(["']?[^)]*#([^"')]+)["']?\)/.exec(filter);
  const node = reference && document.getElementById(reference[1]);
  const matrix = node?.querySelector('feColorMatrix')?.getAttribute('values')?.trim().split(/\s+/).map(Number);
  if (matrix) return [matrix[0], matrix[6], matrix[12]];
  return ['R', 'G', 'B'].map(channel =>
    Number(node?.querySelector(`feFunc${channel}`)?.getAttribute('slope') ?? 1)) as [number, number, number];
}

function colour(value: string, tint: Tint): string {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) return value;
  return `rgba(${channels[0] * tint[0]},${channels[1] * tint[1]},${channels[2] * tint[2]},${channels[3] ?? 1})`;
}

/** Paint the battle's source controls while DOM retains layout and interaction. */
export class BattleUiRaster {
  private readonly range = document.createRange();

  constructor(private readonly context: CanvasRenderingContext2D, private readonly image: BattleUiImage) {}

  paint(element: HTMLElement, tint: Tint = [1, 1, 1], flipX = false, flipY = false): void {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility !== 'visible' || element.hidden) return;
    const rect = element.getBoundingClientRect();
    // Source forms and wrappers may have no box while their positioned children draw.
    const context = this.context;
    context.save();
    context.globalAlpha *= Number(style.opacity);
    const ownTint = filterTint(style.filter);
    const nextTint: Tint = [tint[0] * ownTint[0], tint[1] * ownTint[1], tint[2] * ownTint[2]];
    const blur = /blur\([\d.]+px\)/.exec(style.filter)?.[0];
    if (blur) context.filter = blur;
    const transform = style.transform === 'none' ? undefined : new DOMMatrixReadOnly(style.transform);
    const mirroredX = flipX !== (transform !== undefined && transform.a < 0);
    const mirroredY = flipY !== (transform !== undefined && transform.d < 0);
    const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1;
    const scaleY = element.offsetHeight ? rect.height / element.offsetHeight : scaleX;
    this.clip(style, rect, scaleX, scaleY);
    this.box(style, rect, scaleX, scaleY, nextTint, mirroredX, mirroredY);
    this.pseudo(element, '::before', rect, scaleX, scaleY, nextTint);
    if (element instanceof HTMLImageElement) {
      if (element.complete && element.naturalWidth) this.picture(element, rect, mirroredX, mirroredY, nextTint);
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      this.input(element, style, rect, scaleX, scaleY, nextTint);
    } else if (element instanceof HTMLSelectElement) {
      this.select(element, style, rect, scaleX, scaleY, nextTint);
    }
    const children = [...element.childNodes].map((node, index) => ({node, index,
      order: node instanceof HTMLElement ? number(getComputedStyle(node).zIndex) : 0}));
    children.sort((left, right) => left.order - right.order || left.index - right.index);
    for (const {node} of children) {
      if (node instanceof HTMLElement && !node.dataset.battleUiDraw) this.paint(node, nextTint, mirroredX, mirroredY);
      else if (node instanceof Text) this.text(node, style, rect, scaleX, scaleY, nextTint);
    }
    this.pseudo(element, '::after', rect, scaleX, scaleY, nextTint);
    context.restore();
  }

  private clip(style: CSSStyleDeclaration, rect: DOMRect, scaleX: number, scaleY: number): void {
    const context = this.context;
    const inset = /^inset\(([^)]+)\)$/.exec(style.clipPath);
    if (inset) {
      const values = inset[1].split(/\s+/);
      const edges = [values[0], values[1] ?? values[0], values[2] ?? values[0], values[3] ?? values[1] ?? values[0]];
      const offsets = edges.map((value, index) => value.endsWith('%')
        ? number(value) / 100 * (index % 2 ? rect.width : rect.height)
        : number(value) * (index % 2 ? scaleX : scaleY));
      context.beginPath();
      context.rect(rect.left + offsets[3], rect.top + offsets[0],
        Math.max(0, rect.width - offsets[1] - offsets[3]), Math.max(0, rect.height - offsets[0] - offsets[2]));
      context.clip();
    }
    if ([style.overflowX, style.overflowY].some(value => ['hidden', 'auto', 'scroll', 'clip'].includes(value))) {
      context.beginPath();
      context.rect(rect.left, rect.top, rect.width, rect.height);
      context.clip();
    }
  }

  private box(style: CSSStyleDeclaration, rect: DOMRect, scaleX: number, scaleY: number,
    tint: Tint, flipX = false, flipY = false): void {
    const context = this.context;
    if (!transparent(style.backgroundColor)) {
      context.fillStyle = colour(style.backgroundColor, tint);
      context.fillRect(rect.left, rect.top, rect.width, rect.height);
    }
    const url = /^url\(["']?(.*?)["']?\)$/.exec(style.backgroundImage)?.[1];
    const image = url ? this.image(url, tint) : undefined;
    if (image) {
      const dimensions = style.backgroundSize.split(' ');
      const size = (value: string | undefined, extent: number, scale: number, native: number) =>
        !value || value === 'auto' ? native * scale
          : value.endsWith('%') ? number(value) / 100 * extent : number(value) * scale;
      const width = size(dimensions[0], rect.width, scaleX, image.width);
      const height = size(dimensions[1], rect.height, scaleY, image.height);
      const position = (value: string, extent: number, imageExtent: number, scale: number) =>
        value.endsWith('%') ? number(value) / 100 * (extent - imageExtent) : number(value) * scale;
      const x = position(style.backgroundPositionX, rect.width, width, scaleX);
      const y = position(style.backgroundPositionY, rect.height, height, scaleY);
      context.save();
      context.beginPath(); context.rect(rect.left, rect.top, rect.width, rect.height); context.clip();
      context.translate(rect.left + (flipX ? rect.width : 0), rect.top + (flipY ? rect.height : 0));
      context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      const repeatX = ['repeat', 'repeat-x'].includes(style.backgroundRepeat);
      const repeatY = ['repeat', 'repeat-y'].includes(style.backgroundRepeat);
      for (let top = y; top < rect.height && height > 0; top += height) {
        for (let left = x; left < rect.width && width > 0; left += width) {
          context.drawImage(image, left, top, width, height);
          if (!repeatX) break;
        }
        if (!repeatY) break;
      }
      context.restore();
    }
    const borders = [
      [style.borderTopWidth, style.borderTopColor, rect.left, rect.top, rect.width, number(style.borderTopWidth) * scaleY],
      [style.borderBottomWidth, style.borderBottomColor, rect.left, rect.bottom - number(style.borderBottomWidth) * scaleY, rect.width, number(style.borderBottomWidth) * scaleY],
      [style.borderLeftWidth, style.borderLeftColor, rect.left, rect.top, number(style.borderLeftWidth) * scaleX, rect.height],
      [style.borderRightWidth, style.borderRightColor, rect.right - number(style.borderRightWidth) * scaleX, rect.top, number(style.borderRightWidth) * scaleX, rect.height],
    ] as const;
    for (const [width, color, left, top, w, h] of borders) {
      if (!number(width) || transparent(color)) continue;
      context.fillStyle = colour(color, tint); context.fillRect(left, top, w, h);
    }
    if (style.outlineStyle !== 'none' && number(style.outlineWidth)) {
      const width = number(style.outlineWidth) * scaleX, offset = number(style.outlineOffset) * scaleX + width / 2;
      context.strokeStyle = style.outlineColor; context.lineWidth = width;
      context.strokeRect(rect.left - offset, rect.top - offset, rect.width + offset * 2, rect.height + offset * 2);
    }
  }

  private pseudo(element: HTMLElement, pseudo: '::before' | '::after', rect: DOMRect,
    scaleX: number, scaleY: number, tint: Tint): void {
    const style = getComputedStyle(element, pseudo);
    if (style.content !== '""' || style.display === 'none') return;
    const left = number(style.left) * scaleX, top = number(style.top) * scaleY;
    const width = style.width === 'auto' ? rect.width - left - number(style.right) * scaleX : number(style.width) * scaleX;
    const height = style.height === 'auto' ? rect.height - top - number(style.bottom) * scaleY : number(style.height) * scaleY;
    this.box(style, new DOMRect(rect.left + left, rect.top + top, width, height), scaleX, scaleY, tint);
  }

  private picture(image: HTMLImageElement, rect: DOMRect, flipX: boolean, flipY: boolean, tint: Tint): void {
    const context = this.context;
    const source = this.image(image.currentSrc || image.src, tint);
    if (!source) return;
    context.save();
    context.translate(rect.left + (flipX ? rect.width : 0), rect.top + (flipY ? rect.height : 0));
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(source, 0, 0, rect.width, rect.height);
    context.restore();
  }

  private font(style: CSSStyleDeclaration, tint: Tint): TextMetrics {
    const context = this.context;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = colour(style.color, tint);
    context.textBaseline = 'alphabetic';
    return context.measureText('国M');
  }

  private drawText(text: string, x: number, y: number, style: CSSStyleDeclaration): void {
    const context = this.context;
    const shadows = [...style.textShadow.matchAll(/(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/g)];
    for (const shadow of shadows.reverse()) {
      context.save();
      context.fillStyle = shadow[1];
      context.shadowColor = shadow[1]; context.shadowBlur = number(shadow[4] ?? '0');
      context.fillText(text, x + number(shadow[2]), y + number(shadow[3]));
      context.restore();
    }
    const strokeWidth = number(style.getPropertyValue('-webkit-text-stroke-width'));
    if (strokeWidth > 0) {
      context.save();
      context.strokeStyle = style.getPropertyValue('-webkit-text-stroke-color');
      context.lineWidth = strokeWidth;
      context.lineJoin = 'round';
      context.strokeText(text, x, y);
      context.restore();
    }
    context.fillText(text, x, y);
  }

  private text(node: Text, style: CSSStyleDeclaration, box: DOMRect, scaleX: number, scaleY: number, tint: Tint): void {
    if (!node.data.trim()) return;
    const context = this.context;
    context.save();
    const metrics = this.font(style, tint);
    const ascent = metrics.fontBoundingBoxAscent;
    this.range.selectNodeContents(node);
    const ellipsis = style.textOverflow === 'ellipsis' && this.range.getBoundingClientRect().width > box.width;
    const ellipsisWidth = context.measureText('…').width * scaleX;
    let offset = 0;
    for (const glyph of node.data) {
      this.range.setStart(node, offset); this.range.setEnd(node, offset + glyph.length);
      offset += glyph.length;
      const rect = this.range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      context.save();
      context.translate(rect.left, rect.top); context.scale(scaleX, scaleY);
      if (ellipsis && rect.right > box.right - ellipsisWidth) {
        this.drawText('…', 0, ascent, style); context.restore(); break;
      }
      this.drawText(glyph, 0, ascent, style); context.restore();
    }
    context.restore();
  }

  private input(element: HTMLInputElement | HTMLTextAreaElement, style: CSSStyleDeclaration,
    rect: DOMRect, scaleX: number, scaleY: number, tint: Tint): void {
    const context = this.context;
    context.save();
    const metrics = this.font(style, tint);
    const value = element.value || element.placeholder;
    const left = number(style.paddingLeft) + number(style.borderLeftWidth);
    const top = number(style.paddingTop) + number(style.borderTopWidth);
    const height = rect.height / scaleY - top - number(style.paddingBottom) - number(style.borderBottomWidth);
    const baseline = top + (height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
    context.beginPath(); context.rect(rect.left, rect.top, rect.width, rect.height); context.clip();
    context.translate(rect.left, rect.top); context.scale(scaleX, scaleY);
    const start = element.selectionStart ?? 0, end = element.selectionEnd ?? start;
    const x = left - element.scrollLeft;
    if (document.activeElement === element && start !== end) {
      context.fillStyle = '#265da8';
      context.fillRect(x + context.measureText(value.slice(0, start)).width, top,
        context.measureText(value.slice(start, end)).width, height);
      context.fillStyle = colour(style.color, tint);
    }
    if (!element.value) context.fillStyle = getComputedStyle(element, '::placeholder').color;
    this.drawText(value, x, baseline, style);
    if (document.activeElement === element && start === end && !transparent(style.caretColor)
      && Math.floor(performance.now() / 500) % 2 === 0) {
      context.fillStyle = style.caretColor;
      context.fillRect(x + context.measureText(value.slice(0, start)).width, top, 1, height);
    }
    context.restore();
  }

  private select(element: HTMLSelectElement, style: CSSStyleDeclaration,
    rect: DOMRect, scaleX: number, scaleY: number, tint: Tint): void {
    const context = this.context;
    context.save();
    const metrics = this.font(style, tint);
    context.translate(rect.left, rect.top); context.scale(scaleX, scaleY);
    const height = rect.height / scaleY, width = rect.width / scaleX;
    const baseline = (height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
    this.drawText(element.selectedOptions[0]?.label ?? '', number(style.paddingLeft) + number(style.borderLeftWidth), baseline, style);
    context.beginPath();
    context.moveTo(width - 12, height / 2 - 2); context.lineTo(width - 4, height / 2 - 2);
    context.lineTo(width - 8, height / 2 + 2); context.closePath(); context.fill();
    context.restore();
  }
}
