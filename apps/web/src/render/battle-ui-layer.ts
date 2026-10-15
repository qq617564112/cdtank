import {Texture} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import {imageResourceKey} from '../assets/image-cache';
import {decodeImageRegion} from '../assets/image-resources';
import {withResourceTimeout} from '../assets/static-resources';
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

interface ImageAtlas {texture: Texture; width: number; height: number;}
interface ImageResource {atlas: ImageAtlas; uv: ScreenUv;}
const layers = new WeakMap<Scene, BattleUiLayer>();

/** Source sheets upload once; animated HUD images only update GPU quad buffers. */
export class BattleUiLayer {
  private readonly layer;
  private readonly entries = new Set<BattleImageEntry>();
  private readonly atlases = new Map<string, Promise<ImageAtlas>>();
  private readonly images = new Map<string, ImageResource>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly batches = new Map<number, Map<ImageAtlas, BattleScreenQuads>>();
  private readonly quadUv: [number, number, number, number] = [0, 0, 0, 0];
  private revision = 0;
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

  /** Release a battle's resources after its text owners have been disposed. */
  clear(): void {
    this.revision++;
    for (const batches of this.batches.values()) {
      for (const batch of batches.values()) batch.dispose();
    }
    for (const loading of this.atlases.values()) void loading.then(atlas => atlas.texture.dispose(), () => {});
    this.entries.clear(); this.batches.clear(); this.images.clear(); this.atlases.clear(); this.loading.clear();
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
      const quadUv = this.quadUv;
      quadUv[0] = uv[0] + x0 / draw.shape.width * du;
      quadUv[1] = uv[1] + y0 / draw.shape.height * dv;
      quadUv[2] = uv[0] + x1 / draw.shape.width * du;
      quadUv[3] = uv[1] + y1 / draw.shape.height * dv;
      batch.quad((left + x0 / draw.shape.width * imageWidth) * xRatio,
        (top + y0 / draw.shape.height * imageHeight) * yRatio,
        (x1 - x0) / draw.shape.width * imageWidth * xRatio,
        (y1 - y0) / draw.shape.height * imageHeight * yRatio,
        quadUv, draw.tint);
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
    const revision = this.revision;
    const loading = decodeImageRegion(`/${asset}`).then(async region => {
      if (this.disposed || revision !== this.revision) return;
      const key = imageResourceKey(`/${asset}`);
      let atlasLoading = this.atlases.get(key);
      if (!atlasLoading) {
        const pending = this.loadAtlas(key, revision).catch(error => {
          if (this.atlases.get(key) === pending) this.atlases.delete(key);
          throw error;
        });
        this.atlases.set(key, pending);
        atlasLoading = pending;
      }
      const atlas = await atlasLoading;
      if (this.disposed || revision !== this.revision) return;
      this.images.set(asset, {atlas, uv: [region.x / atlas.width, region.y / atlas.height,
        (region.x + region.width) / atlas.width, (region.y + region.height) / atlas.height]});
    }).finally(() => {if (this.loading.get(asset) === loading) this.loading.delete(asset);});
    this.loading.set(asset, loading);
    return loading;
  }

  /** Static source sheets restore from their published URL without a canvas copy. */
  private loadAtlas(url: string, revision: number): Promise<ImageAtlas> {
    let abandoned = false;
    const loading = new Promise<ImageAtlas>((resolve, reject) => {
      // Keep native callbacks alive until upload finishes, including after timeout or scene disposal.
      const created = new Texture(url, this.scene.getEngine(), true, false, Texture.BILINEAR_SAMPLINGMODE,
        () => {
          const {width, height} = created.getSize();
          if (abandoned || this.disposed || revision !== this.revision) created.dispose();
          resolve({texture: created, width, height});
        }, (message, error) => {created.dispose(); reject(error ?? new Error(message));});
      created.hasAlpha = true;
      created.wrapU = created.wrapV = Texture.CLAMP_ADDRESSMODE;
    });
    return withResourceTimeout(loading, url).catch(error => {abandoned = true; throw error;});
  }

  private dispose(): void {
    this.disposed = true;
    this.clear();
    this.layer.dispose();
  }
}

export function battleUiLayer(scene: Scene): BattleUiLayer {
  let layer = layers.get(scene);
  if (!layer) {layer = new BattleUiLayer(scene); layers.set(scene, layer);}
  return layer;
}
