import {DynamicTexture, Texture} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import {decodeImageRegion, type ImageRegion} from '../assets/image-resources';
import {BattleScreenQuads, createBattleScreenLayer, type ScreenUv} from './battle-screen-quads';
import type {BattleVectorShape, VectorRectangle} from './battle-screen-vectors';

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
}

interface ImageAtlas {texture: DynamicTexture; width: number; height: number;}
interface ImageResource {atlas: ImageAtlas; uv: ScreenUv;}
const layers = new WeakMap<Scene, BattleUiLayer>();

/** Source sheets upload once; animated HUD images only update GPU quad buffers. */
export class BattleUiLayer {
  private readonly layer;
  private readonly entries = new Set<BattleImageEntry>();
  private readonly atlases = new Map<ImageRegion['image'], ImageAtlas>();
  private readonly images = new Map<string, ImageResource>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly batches = new Map<number, Map<ImageAtlas, BattleScreenQuads>>();
  private disposed = false;

  constructor(private readonly scene: Scene) {
    this.layer = createBattleScreenLayer(scene);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  add(entry: BattleImageEntry): void {this.entries.add(entry);}
  remove(entry: BattleImageEntry): void {this.entries.delete(entry);}

  prepare(shapes: readonly BattleVectorShape[]): Promise<void> {
    return Promise.all(shapes.map(shape => this.loadImage(shape.asset))).then(() => {});
  }

  /** Called after the world, minimap and world-space nameplates have rendered. */
  render(): void {
    if (this.disposed) return;
    const engine = this.scene.getEngine(), width = engine.getRenderWidth(), height = engine.getRenderHeight();
    for (const batches of this.batches.values()) {
      for (const batch of batches.values()) batch.begin(width, height);
    }
    let visible = false;
    for (const entry of this.entries) {
      const draw = entry.draw;
      if (!draw || draw.tint[3] <= 0) continue;
      const image = this.images.get(draw.shape.asset);
      if (!image) {
        void this.loadImage(draw.shape.asset).catch(error => {console.error('战斗图片载入失败', error);});
        continue;
      }
      const [left, top, imageWidth, imageHeight] = draw.rectangle;
      const x0 = Math.max(0, draw.clip[0]), y0 = Math.max(0, draw.clip[1]);
      const x1 = Math.min(draw.shape.width, draw.clip[2]), y1 = Math.min(draw.shape.height, draw.clip[3]);
      if (x1 <= x0 || y1 <= y0) continue;
      const xRatio = width / draw.viewport[0], yRatio = height / draw.viewport[1];
      const uv = image.uv, du = uv[2] - uv[0], dv = uv[3] - uv[1];
      const order = (entry.group === 3 ? 1 : entry.order >= 10 ? 6 : 3.9) + entry.order / 1000;
      const batch = this.batch(image.atlas, order, width, height);
      batch.quad((left + x0 / draw.shape.width * imageWidth) * xRatio,
        (top + y0 / draw.shape.height * imageHeight) * yRatio,
        (x1 - x0) / draw.shape.width * imageWidth * xRatio,
        (y1 - y0) / draw.shape.height * imageHeight * yRatio,
        [uv[0] + x0 / draw.shape.width * du, uv[1] + y0 / draw.shape.height * dv,
          uv[0] + x1 / draw.shape.width * du, uv[1] + y1 / draw.shape.height * dv], draw.tint);
      visible = true;
    }
    for (const batches of this.batches.values()) {
      for (const batch of batches.values()) batch.end();
    }
    if (visible) this.layer.render();
  }

  private batch(atlas: ImageAtlas, order: number, width: number, height: number): BattleScreenQuads {
    let batches = this.batches.get(order);
    if (!batches) {batches = new Map(); this.batches.set(order, batches);}
    let batch = batches.get(atlas);
    if (!batch) {
      batch = new BattleScreenQuads(this.layer.utilityLayerScene, `battle-images-${order}`, atlas.texture, order);
      batches.set(atlas, batch);
      batch.begin(width, height);
    }
    return batch;
  }

  private loadImage(asset: string): Promise<void> {
    if (this.images.has(asset) || this.disposed) return Promise.resolve();
    const pending = this.loading.get(asset);
    if (pending) return pending;
    const loading = decodeImageRegion(`/${asset}`).then(region => {
      if (this.disposed) return;
      let atlas = this.atlases.get(region.image);
      if (!atlas) {
        const width = region.image.width, height = region.image.height;
        const texture = new DynamicTexture(`battle-images-${this.atlases.size}`, {width, height},
          this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
        texture.hasAlpha = true;
        texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
        texture.getContext().drawImage(region.image, 0, 0);
        texture.update(false);
        atlas = {texture, width, height};
        this.atlases.set(region.image, atlas);
      }
      this.images.set(asset, {atlas, uv: [region.x / atlas.width, region.y / atlas.height,
        (region.x + region.width) / atlas.width, (region.y + region.height) / atlas.height]});
    }).finally(() => {this.loading.delete(asset);});
    this.loading.set(asset, loading);
    return loading;
  }

  private dispose(): void {
    this.disposed = true;
    for (const batches of this.batches.values()) {
      for (const batch of batches.values()) batch.dispose();
    }
    for (const atlas of this.atlases.values()) atlas.texture.dispose();
    this.layer.dispose();
    this.entries.clear(); this.batches.clear(); this.images.clear(); this.atlases.clear(); this.loading.clear();
  }
}

export function battleUiLayer(scene: Scene): BattleUiLayer {
  let layer = layers.get(scene);
  if (!layer) {layer = new BattleUiLayer(scene); layers.set(scene, layer);}
  return layer;
}
