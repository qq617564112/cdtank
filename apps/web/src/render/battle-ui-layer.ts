import './battle-ui-layer.css';
import {DynamicTexture, Texture} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import {decodeImage} from '../assets/image-resources';
import {BattleScreenQuads, createBattleScreenLayer} from './battle-screen-quads';
import type {BattleVectorShape, VectorRectangle} from './battle-screen-vectors';
import {BattleUiRaster} from './battle-ui-raster';

export interface BattleImageDraw {
  shape: BattleVectorShape;
  viewport: readonly [number, number];
  rectangle: VectorRectangle;
  clip: VectorRectangle;
  tint: VectorRectangle;
}

export interface BattleImageEntry {
  readonly order: number;
  readonly group: number;
  draw?: BattleImageDraw;
  painted?: BattleImageDraw;
}

interface UiRoot {element: HTMLElement; backdrop?: string; observer: MutationObserver;}
const layers = new WeakMap<Scene, BattleUiLayer>();
const ROOTS = [
  '#original-battle-hud', '.battle-chat', '[data-match-panel][data-phase="PLAYING"]',
  '[data-match-panel][data-phase="FINISHED"]',
  '[data-battle-scoreboard]', '.battle-summary-viewport', 'dialog[data-battle-ending]',
  'dialog[data-confirm-binding="web-battle-leave"]', 'dialog[data-summary-equipment-kind]',
  'dialog[data-summary-title-grant]',
  'body:has([data-formal-battle-page], [data-battle-ending], [data-battle-summary-page]) .game-status',
].join(',');
const INPUT_EVENTS = ['input', 'scroll', 'focusin', 'focusout', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'load', 'selectionchange'];

function sameDraw(left?: BattleImageDraw, right?: BattleImageDraw): boolean {
  if (!left || !right) return left === right;
  return left.shape === right.shape && ['viewport', 'rectangle', 'clip', 'tint'].every(key => {
    const property = key as 'viewport' | 'rectangle' | 'clip' | 'tint';
    return left[property].every((value, index) => value === right[property][index]);
  });
}

/** One GPU screen layer for source imagery and every visible battle control. */
export class BattleUiLayer {
  private readonly layer;
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d')!;
  private readonly texture: DynamicTexture;
  private readonly quads: BattleScreenQuads;
  private readonly raster = new BattleUiRaster(this.context, (url, tint) => this.image(url, tint));
  private readonly entries = new Set<BattleImageEntry>();
  private readonly roots = new Map<HTMLElement, UiRoot>();
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loading = new Set<string>();
  private readonly coloured = new Map<string, HTMLCanvasElement>();
  private readonly resizeObserver = new ResizeObserver(() => {this.dirty = true;});
  private dirty = true;
  private animated = false;
  private caretPhase = -1;
  private disposed = false;
  private readonly invalidate = (event?: Event) => {
    if (event?.target instanceof Element && !event.target.closest('[data-battle-ui-draw]')) return;
    this.dirty = true;
  };

  constructor(private readonly scene: Scene) {
    this.layer = createBattleScreenLayer(scene);
    this.texture = new DynamicTexture('battle-ui', this.canvas, this.layer.utilityLayerScene,
      false, Texture.BILINEAR_SAMPLINGMODE);
    this.texture.hasAlpha = true;
    this.quads = new BattleScreenQuads(this.layer.utilityLayerScene, 'battle-ui', this.texture, 0);
    for (const event of INPUT_EVENTS) {
      document.addEventListener(event, this.invalidate, true);
    }
    window.addEventListener('resize', this.invalidate);
    document.fonts.addEventListener('loadingdone', this.invalidate);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  add(entry: BattleImageEntry): void {this.entries.add(entry); this.dirty = true;}
  remove(entry: BattleImageEntry): void {this.entries.delete(entry); this.dirty = true;}

  /** Called after the world, minimap and world-space nameplates have rendered. */
  render(): void {
    if (this.disposed) return;
    const screen = this.scene.getEngine().getRenderingCanvas();
    if (!screen) return;
    const bounds = screen.getBoundingClientRect();
    if (!bounds.width || !bounds.height || getComputedStyle(screen).visibility !== 'visible') {
      this.quads.clear();
      this.releaseRoots();
      return;
    }
    this.reconcileRoots();
    const engine = this.scene.getEngine(), width = engine.getRenderWidth(), height = engine.getRenderHeight();
    if (width !== this.canvas.width || height !== this.canvas.height) {
      this.texture.scaleTo(width, height); this.dirty = true;
    }
    const animated = [...this.roots.keys()].some(root => root.getAnimations({subtree: true})
      .some(animation => animation.playState === 'running'));
    const caretPhase = document.activeElement instanceof HTMLInputElement
      && [...this.roots.keys()].some(root => root.contains(document.activeElement))
      ? Math.floor(performance.now() / 500) % 2 : -1;
    const changed = [...this.entries].some(entry => !sameDraw(entry.draw, entry.painted));
    if (this.dirty || changed || animated || this.animated || caretPhase !== this.caretPhase) {
      const context = this.context;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.setTransform(width / bounds.width, 0, 0, height / bounds.height,
        -bounds.left * width / bounds.width, -bounds.top * height / bounds.height);
      const paints: {order: number; paint(): void}[] = [];
      for (const entry of this.entries) {
        entry.painted = entry.draw;
        if (!entry.draw) continue;
        paints.push({order: (entry.group === 3 ? 1 : entry.order >= 10 ? 6 : 3.9) + entry.order / 1000,
          paint: () => this.paintImage(entry.draw!, bounds)});
      }
      let modalOrder = 100;
      for (const root of this.roots.values()) {
        const order = root.element instanceof HTMLDialogElement ? modalOrder++
          : root.element.id === 'original-battle-hud' ? 4 : Number(getComputedStyle(root.element).zIndex) || 3;
        paints.push({order, paint: () => {
          if (root.backdrop && root.element instanceof HTMLDialogElement && root.element.open) {
            context.fillStyle = root.backdrop;
            context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
          }
          this.raster.paint(root.element);
        }});
      }
      paints.sort((left, right) => left.order - right.order);
      for (const paint of paints) paint.paint();
      this.texture.update(false);
      this.quads.begin(width, height);
      this.quads.quad(0, 0, width, height, [0, 0, 1, 1]);
      this.quads.end();
      this.dirty = false;
      this.animated = animated;
      this.caretPhase = caretPhase;
    }
    this.layer.render();
  }

  private reconcileRoots(): void {
    const present = new Set(document.querySelectorAll<HTMLElement>(ROOTS));
    for (const [element, root] of this.roots) {
      if (present.has(element)) continue;
      root.observer.disconnect(); this.resizeObserver.unobserve(element);
      element.removeAttribute('data-battle-ui-draw'); this.roots.delete(element); this.dirty = true;
    }
    for (const element of present) {
      if (this.roots.has(element)) continue;
      const backdrop = element instanceof HTMLDialogElement ? getComputedStyle(element, '::backdrop').backgroundColor : undefined;
      element.dataset.battleUiDraw = 'webgl';
      const observer = new MutationObserver(records => {
        if (records.some(record => {
          if (record.type !== 'attributes') return true;
          const name = record.attributeName!;
          return !['data-world', 'data-chat-emote-elapsed'].includes(name)
            && record.oldValue !== (record.target as Element).getAttribute(name);
        })) this.dirty = true;
      });
      observer.observe(element, {subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true});
      this.resizeObserver.observe(element);
      this.roots.set(element, {element, backdrop, observer}); this.dirty = true;
    }
  }

  private image(url: string, tint: readonly [number, number, number] = [1, 1, 1]): HTMLImageElement | HTMLCanvasElement | undefined {
    const image = this.images.get(url);
    if (!image) {
      if (!this.loading.has(url)) {
        this.loading.add(url);
        void decodeImage(url).then(decoded => {
          if (!this.disposed) {this.images.set(url, decoded); this.dirty = true;}
        }).catch(error => {console.error(error);});
      }
      return;
    }
    if (tint.every(value => value === 1)) return image;
    const key = `${url}:${tint.join(',')}`;
    let canvas = this.coloured.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel++) pixels.data[index + channel] *= tint[channel];
      }
      context.putImageData(pixels, 0, 0); this.coloured.set(key, canvas);
    }
    return canvas;
  }

  private paintImage(draw: BattleImageDraw, bounds: DOMRect): void {
    const image = this.image(`/${draw.shape.asset}`, [draw.tint[0], draw.tint[1], draw.tint[2]]);
    if (!image) return;
    const xRatio = bounds.width / draw.viewport[0], yRatio = bounds.height / draw.viewport[1];
    const [x, y, width, height] = draw.rectangle;
    const left = bounds.left + x * xRatio, top = bounds.top + y * yRatio;
    const w = width * xRatio, h = height * yRatio, context = this.context;
    context.save();
    context.globalAlpha = draw.tint[3]; context.beginPath();
    context.rect(left + draw.clip[0] / draw.shape.width * w, top + draw.clip[1] / draw.shape.height * h,
      (draw.clip[2] - draw.clip[0]) / draw.shape.width * w, (draw.clip[3] - draw.clip[1]) / draw.shape.height * h);
    context.clip(); context.drawImage(image, left, top, w, h); context.restore();
  }

  private releaseRoots(): void {
    for (const root of this.roots.values()) {
      root.observer.disconnect(); root.element.removeAttribute('data-battle-ui-draw');
    }
    this.roots.clear(); this.resizeObserver.disconnect(); this.dirty = true;
  }

  private dispose(): void {
    this.disposed = true; this.releaseRoots();
    for (const event of INPUT_EVENTS) {
      document.removeEventListener(event, this.invalidate, true);
    }
    window.removeEventListener('resize', this.invalidate);
    document.fonts.removeEventListener('loadingdone', this.invalidate);
    this.quads.dispose(); this.texture.dispose(); this.layer.dispose();
    this.entries.clear(); this.images.clear(); this.coloured.clear();
  }
}

export function battleUiLayer(scene: Scene): BattleUiLayer {
  let layer = layers.get(scene);
  if (!layer) {layer = new BattleUiLayer(scene); layers.set(scene, layer);}
  return layer;
}
