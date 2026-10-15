import type {Observer, Scene, Vector2} from '@babylonjs/core';
import {battleUiLayer, type BattleImageDraw, type BattleImageEntry} from './battle-ui-layer';

/** Published original image and its source coordinate system. */
export interface BattleVectorShape {
  readonly width: number;
  readonly height: number;
  readonly asset: string;
}
export type VectorRectangle = readonly [number, number, number, number];
const WHITE: VectorRectangle = [1, 1, 1, 1];

interface VectorDraw extends BattleImageDraw {
  viewport: [number, number];
  rectangle: [number, number, number, number];
  clip: [number, number, number, number];
  tint: [number, number, number, number];
}

/** Source images share the battle GPU layer, clipping, tint and draw order. */
export class BattleScreenVector {
  private readonly layer;
  private readonly entry: BattleImageEntry;
  private readonly disposeObserver: Observer<Scene>;
  private disposed = false;
  private drawState?: VectorDraw;

  constructor(private readonly scene: Scene, _name: string, order: number, renderingGroupId = 0) {
    this.layer = battleUiLayer(scene);
    this.entry = {order, group: renderingGroupId};
    this.layer.add(this.entry);
    this.disposeObserver = scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  draw(shape: BattleVectorShape, viewport: Vector2, rectangle: VectorRectangle,
    clip?: VectorRectangle, tint: VectorRectangle = WHITE): void {
    if (this.disposed) return;
    const x0 = clip ? clip[0] : 0, y0 = clip ? clip[1] : 0;
    const x1 = clip ? clip[2] : shape.width, y1 = clip ? clip[3] : shape.height;
    if (rectangle[2] <= 0 || rectangle[3] <= 0 || viewport.x <= 0 || viewport.y <= 0
      || x1 <= x0 || y1 <= y0) {
      this.clear();
      return;
    }
    const draw = this.drawState ??= {shape, viewport: [0, 0], rectangle: [0, 0, 0, 0],
      clip: [0, 0, 0, 0], tint: [1, 1, 1, 1]};
    draw.shape = shape;
    draw.viewport[0] = viewport.x; draw.viewport[1] = viewport.y;
    draw.clip[0] = x0; draw.clip[1] = y0; draw.clip[2] = x1; draw.clip[3] = y1;
    for (let channel = 0; channel < 4; channel++) {
      draw.rectangle[channel] = rectangle[channel]; draw.tint[channel] = tint[channel];
    }
    this.entry.draw = draw;
  }

  clear(): void {this.entry.draw = undefined;}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onDisposeObservable.remove(this.disposeObserver);
    this.clear();
    this.drawState = undefined;
    this.layer.remove(this.entry);
  }
}
