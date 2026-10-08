import type {Scene, Vector2} from '@babylonjs/core';
import {battleUiLayer, type BattleImageEntry} from './battle-ui-layer';

/** Published original image and its source coordinate system. */
export interface BattleVectorShape {
  readonly width: number;
  readonly height: number;
  readonly asset: string;
}
export type VectorRectangle = readonly [number, number, number, number];

/** Source images share the battle GPU layer, clipping, tint and draw order. */
export class BattleScreenVector {
  private readonly layer;
  private readonly entry: BattleImageEntry;
  private disposed = false;

  constructor(scene: Scene, _name: string, order: number, renderingGroupId = 0) {
    this.layer = battleUiLayer(scene);
    this.entry = {order, group: renderingGroupId};
    this.layer.add(this.entry);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  draw(shape: BattleVectorShape, viewport: Vector2, rectangle: VectorRectangle,
    clip: VectorRectangle = [0, 0, shape.width, shape.height], tint: VectorRectangle = [1, 1, 1, 1]): void {
    if (this.disposed) return;
    if (rectangle[2] <= 0 || rectangle[3] <= 0 || viewport.x <= 0 || viewport.y <= 0
      || clip[2] <= clip[0] || clip[3] <= clip[1]) {
      this.clear();
      return;
    }
    this.entry.draw = {shape, viewport: [viewport.x, viewport.y], rectangle: [...rectangle], clip: [...clip], tint: [...tint]};
  }

  clear(): void {this.entry.draw = undefined;}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.layer.remove(this.entry);
  }
}
